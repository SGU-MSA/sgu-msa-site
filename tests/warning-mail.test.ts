import test from "node:test";
import assert from "node:assert/strict";
import { createTransport } from "nodemailer";
import {
  createGmailWarningMailer,
  gmailSmtpOptions,
} from "../src/lib/backend/providers/gmail-mailer";
import { createSampleWarningMailer } from "../src/lib/backend/providers/sample-mailer";
import { createSampleWarningLedger } from "../src/lib/backend/providers/sample-ledger";
import { offWarningMailer } from "../src/lib/backend/providers/off-mailer";
import { offWarningLedger } from "../src/lib/backend/providers/off-ledger";
import { sandboxStore } from "../src/lib/demo/store";

// Daily check WP-4 (docs/contracts/daily-check-notifications.md): the mailer
// and "already emailed" adapters. The Supabase ledger runs against a real
// local stack in scripts/test-backend.ts.
const settings = {
  address: "sgumsa.example@gmail.com",
  appPassword: "abcdefghijklmnop",
};
const email = {
  subject: "SGU MSA website: 1 thing needs attention",
  text: "1. [Prayer] Example.\n",
};

test("gmail: from the MSA Gmail to itself, plain text, no Bcc (D-15)", async () => {
  const messages: string[] = [];
  const json = createTransport({ jsonTransport: true });
  const mailer = createGmailWarningMailer(settings, {
    async sendMail(message) {
      const info = await json.sendMail(message);
      messages.push(String(info.message));
      return info;
    },
  });
  assert.deepEqual(await mailer.send(email), { ok: true, delivery: "email" });
  assert.equal(messages.length, 1);
  const sent = JSON.parse(messages[0]);
  assert.deepEqual(sent.from, {
    address: "sgumsa.example@gmail.com",
    name: "SGU MSA website",
  });
  assert.deepEqual(sent.to, [
    { address: "sgumsa.example@gmail.com", name: "" },
  ]);
  assert.equal(sent.subject, email.subject);
  assert.equal(sent.text, email.text);
  assert.equal(sent.html, undefined);
  assert.equal(sent.bcc, undefined);
  assert.equal(sent.cc, undefined);
  // The app password never travels in the message.
  assert.ok(!messages[0].includes(settings.appPassword));
});

test("gmail: Gmail's SMTP with STARTTLS required and 10-second timeouts", () => {
  assert.deepEqual(gmailSmtpOptions(settings), {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: settings.address, pass: settings.appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
});

test("gmail: a refused login is rejected, anything else unavailable, never the password", async () => {
  const failing = (error: unknown) =>
    createGmailWarningMailer(settings, {
      sendMail: () => Promise.reject(error),
    });
  const auth = Object.assign(
    new Error(`Invalid login ${settings.appPassword}`),
    {
      code: "EAUTH",
    },
  );
  const rejected = await failing(auth).send(email);
  assert.deepEqual(rejected, { ok: false, reason: "rejected" });
  assert.ok(!JSON.stringify(rejected).includes(settings.appPassword));
  for (const error of [
    Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }),
    Object.assign(new Error("dns"), { code: "EDNS" }),
    new Error("no code"),
    null,
  ])
    assert.deepEqual(await failing(error).send(email), {
      ok: false,
      reason: "unavailable",
    });
});

test("off: never sends and remembers nothing", async () => {
  assert.deepEqual(await offWarningMailer.send(email), {
    ok: false,
    reason: "off",
  });
  const read = await offWarningLedger.alreadySent(["iqamah:2026-10-15"]);
  assert.ok("sent" in read && read.sent.size === 0);
  assert.deepEqual(
    await offWarningLedger.record(
      [{ key: "iqamah:2026-10-15", step: "first" }],
      "2026-10-08",
    ),
    { ok: false },
  );
});

test("sample: the sandbox records the email instead of sending it", async () => {
  const seed = new Date("2031-01-01T12:00:00Z");
  const mailer = createSampleWarningMailer(seed);
  assert.deepEqual(await mailer.send(email), { ok: true, delivery: "sandbox" });
  assert.deepEqual(sandboxStore(seed).sentWarnings, [email]);
});

test("sample ledger: reads only the asked keys; a recorded step keeps its first date", async () => {
  const seed = new Date("2031-02-01T12:00:00Z");
  const ledger = createSampleWarningLedger(seed);
  const empty = await ledger.alreadySent(["iqamah:2026-10-15"]);
  assert.ok("sent" in empty && empty.sent.size === 0);
  await ledger.record(
    [{ key: "iqamah:2026-10-15", step: "first" }],
    "2026-10-08",
  );
  await ledger.record([{ key: "other", step: "first" }], "2026-10-08");
  // A doubled run the same night, or a re-send after a failed record.
  await ledger.record(
    [
      { key: "iqamah:2026-10-15", step: "first" },
      { key: "iqamah:2026-10-15", step: "last_call" },
    ],
    "2026-10-14",
  );
  const read = await ledger.alreadySent(["iqamah:2026-10-15", "missing"]);
  assert.ok("sent" in read);
  assert.deepEqual(
    [...read.sent],
    [["iqamah:2026-10-15", { first: "2026-10-08", last_call: "2026-10-14" }]],
  );
});
