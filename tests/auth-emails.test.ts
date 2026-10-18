import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The owner copies these templates and settings into each hosted Supabase project (PR3 contract,
// D-1, D-3, D-16), so the local config and the template files must say the same thing.
const config = readFileSync("supabase/config.toml", "utf8");
const setting = (name: string) =>
  config.match(new RegExp(`^${name} = (.+)$`, "m"))?.[1];

for (const [type, file] of [
  ["invite", "supabase/templates/invite.html"],
  ["recovery", "supabase/templates/recovery.html"],
] as const) {
  test(`${type} email: subject, token-hash link and 24-hour wording`, () => {
    const template = readFileSync(file, "utf8");
    const section = config.split(`[auth.email.template.${type}]`)[1] ?? "";
    const subject = section.match(/^subject = "(.+)"$/m)?.[1];
    assert.ok(subject, `config.toml sets the ${type} subject`);
    assert.equal(
      template.split("\n")[0],
      `<!-- Subject: ${subject} -->`,
      "the template's first line names the same subject",
    );
    assert.match(section, new RegExp(`content_path = "./${file}"`));
    assert.ok(
      template.includes(
        `{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}`,
      ),
      "token-hash link to the dashboard's confirm route",
    );
    assert.match(template, /The link works once and expires in 24 hours\./);
  });
}

test("invite email reads well when the name or inviter is missing", () => {
  const template = readFileSync("supabase/templates/invite.html", "utf8");
  assert.ok(
    template.includes(
      "Assalamu alaikum{{ if .Data.full_name }} {{ .Data.full_name }}{{ end }},",
    ),
    "the greeting drops the name cleanly",
  );
  assert.ok(
    template.includes(
      "{{ if .Data.invited_by }}{{ .Data.invited_by }} added you{{ else }}You have been added{{ end }} to the SGU MSA board dashboard.",
    ),
    "the inviter line has a fallback",
  );
  assert.doesNotMatch(template, /alaikum \{\{ \.Data\.full_name \}\}\./);
});

test("auth settings: 24-hour links and the D-16 password rule", () => {
  assert.equal(setting("otp_expiry"), "86400");
  assert.equal(setting("minimum_password_length"), "12");
  assert.equal(
    setting("password_requirements"),
    '"lower_upper_letters_digits_symbols"',
  );
  assert.equal(setting("site_url"), '"http://localhost:3000"');
  assert.equal(
    setting("additional_redirect_urls"),
    '["http://localhost:3000/admin/auth/confirm"]',
  );
});

// D-25: mail scanners (SGU uses Outlook) open links with GET before the person
// does, so opening the email link must not use the one-time token. Only the
// Continue button's POST (a server action) verifies it. The e2e suites check
// the behaviour (tests/e2e/demo.spec.ts, and on the local stack
// tests/e2e/editor.spec.ts, where a scanner's GET leaves the link working).
test("email links: GET only shows Continue; only the POST action verifies the token", () => {
  const segment = "src/app/admin/auth/confirm";
  assert.ok(
    !existsSync(`${segment}/route.ts`),
    "no route handler that could verify on GET",
  );
  const page = readFileSync(`${segment}/page.tsx`, "utf8");
  assert.doesNotMatch(page, /verifyEmailLink|adminAuth/);
  assert.match(page, /<EmailLinkForm /);
  const form = readFileSync("src/features/admin/PasswordForms.tsx", "utf8");
  assert.match(form, /useActionState\(\s*confirmEmailLinkAction,/);
  const callers = ["src/app", "src/features"]
    .flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => join(dir, file)),
    )
    .filter((file) => readFileSync(file, "utf8").includes("verifyEmailLink("));
  assert.deepEqual(callers, ["src/features/admin/access-actions.ts"]);
  const actions = readFileSync(callers[0], "utf8");
  const action = actions.slice(
    actions.indexOf("export async function confirmEmailLinkAction"),
  );
  assert.match(action.slice(0, action.indexOf("\n}\n")), /verifyEmailLink\(/);
  assert.match(actions, /^"use server";/);
});
