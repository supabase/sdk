/** What the docs schema accepts as a definition `id`. */
export const DEFINITION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Lowercase words separated by hyphens. Splits camelCase first, so
 * `signInWithOtp` and `sign_in_with_otp` give the same slug.
 *
 * A word starts at a capital that follows a lowercase letter or a digit, and
 * at the last capital of a run of capitals that a lowercase letter follows:
 * `JSONValue` is `json-value`. That is the usual rule, and it needs no list
 * of acronyms. Its price is a name such as `OAuth`, which becomes `o-auth`.
 *
 * This is how the name of a function becomes its definition id:
 * `AuthClient.signUp` is `auth-client-sign-up`. Two names can give one slug
 * (`Client.signUp` and `Client.sign_up`). The generator fails on that instead
 * of letting one file overwrite the other.
 */
export const slugify = (text: string): string =>
  text
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z\d]+/g, "-")
    .replace(/^-|-$/g, "");
