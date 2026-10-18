import test from "node:test";
import assert from "node:assert/strict";
import { passwordHint, passwordSchema } from "../src/lib/backend/password";

// D-16: at least 12 characters with a lower-case letter, a capital letter, a
// number and a symbol (the symbols Supabase Auth counts).
test("passwordSchema accepts passwords that meet D-16", () => {
  for (const password of [
    "Aa1!aaaaaaaa",
    "Correct-Horse-9",
    "zZ9~zZ9~zZ9~",
    "Long passphrase with Spaces 7?",
  ])
    assert.ok(passwordSchema.safeParse(password).success, password);
});

test("passwordSchema refuses each missing part with the D-16 hint", () => {
  for (const password of [
    "",
    "Aa1!aaaaaaa", // 11 characters
    "AA1!AAAAAAAA", // no lower-case
    "aa1!aaaaaaaa", // no capital
    "Aa!!aaaaaaaa", // no number
    "Aa11aaaaaaaa", // no symbol
    "Aa1 aaaaaaaa", // a space is not a symbol
    "Aa1éaaaaaaaa", // nor is an accented letter
  ]) {
    const result = passwordSchema.safeParse(password);
    assert.equal(result.success, false, password);
    assert.equal(result.error?.issues[0].message, passwordHint);
  }
  assert.equal(
    passwordHint,
    "At least 12 characters, including a lower-case letter, a capital letter, a number and a symbol.",
  );
});
