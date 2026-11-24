import { describe, expect, test } from "bun:test";
import { DEFINITION_ID, slugify } from "../src/slug.ts";

describe("slugify", () => {
  test("lowercases and joins words with hyphens", () => {
    expect(slugify("Sign up with an email")).toBe("sign-up-with-an-email");
  });

  test("splits camelCase, so both spellings of a name give one slug", () => {
    expect(slugify("signInWithOtp")).toBe("sign-in-with-otp");
    expect(slugify("sign_in_with_otp")).toBe("sign-in-with-otp");
  });

  test("keeps a run of capitals together, up to the word that follows it", () => {
    expect(slugify("JSONValue")).toBe("json-value");
    expect(slugify("AuthMFARecoveryCodes")).toBe("auth-mfa-recovery-codes");
    expect(slugify("signInWithSSO")).toBe("sign-in-with-sso");
    expect(slugify("getURL")).toBe("get-url");
    // The price of a rule without a list of acronyms.
    expect(slugify("signInWithOAuth")).toBe("sign-in-with-o-auth");
  });

  test("starts a word at a capital that follows a digit, not at the digit", () => {
    expect(slugify("storage3")).toBe("storage3");
    expect(slugify("S3Client")).toBe("s3-client");
    expect(slugify("Base64URL")).toBe("base64-url");
  });

  test("drops punctuation at both ends and collapses it inside", () => {
    expect(slugify("  (Example 1): basic!  ")).toBe("example-1-basic");
  });

  test("is empty when nothing is left", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("_")).toBe("");
  });
});

describe("a definition id", () => {
  test("is the name of a function, in lowercase words", () => {
    for (const [name, id] of [
      // Swift: the path through the types, without argument labels.
      ["AuthClient.signUp", "auth-client-sign-up"],
      ["NotesClient.Configuration.init", "notes-client-configuration-init"],
      ["makeClient", "make-client"],
      // Python: the import path.
      [
        "supabase_auth.SyncAuthClient.sign_up",
        "supabase-auth-sync-auth-client-sign-up",
      ],
      [
        "storage3.StorageFileApiClient.from_",
        "storage3-storage-file-api-client-from",
      ],
      ["notes.Folder.__init__", "notes-folder-init"],
    ] as const) {
      expect(slugify(name)).toBe(id);
      expect(id).toMatch(DEFINITION_ID);
    }
  });

  test("can be the same for two names, which generate() rejects", () => {
    expect(slugify("Client.signUp")).toBe(slugify("Client.sign_up"));
  });
});
