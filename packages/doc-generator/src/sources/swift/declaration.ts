/** One token of a declaration, as the compiler prints it in a symbol graph. */
export interface Fragment {
  readonly kind: string;
  readonly spelling: string;
  readonly preciseIdentifier?: string;
}

export interface Constraint {
  readonly kind: string;
  readonly lhs: string;
  readonly rhs: string;
}

/**
 * The declaration on one line. The compiler keeps the line breaks a long
 * default value has in the source, and those are layout, not syntax.
 */
export const joinFragments = (fragments: readonly Fragment[]): string =>
  fragments
    .map((fragment) => fragment.spelling)
    .join("")
    .replace(/\s*\n\s*(?=[.,)\]])/g, "")
    .replace(/\s*\n\s*/g, " ");

const renderConstraint = ({ kind, lhs, rhs }: Constraint): string =>
  kind === "sameType" ? `${lhs} == ${rhs}` : `${lhs}: ${rhs}`;

/**
 * The full declaration of a symbol. A member of a constrained extension only
 * exists when the constraints hold, but the compiler prints them on the
 * extension, not on the member, so they are added to its `where` clause here.
 * `eq(_:value:)` of `PostgrestRequestBuilder<Phase>` is the case that matters:
 * it is only there `where Phase: PostgrestFilterablePhase`.
 */
export function renderSignature(
  fragments: readonly Fragment[],
  extensionConstraints: readonly Constraint[],
): string {
  const declaration = joinFragments(fragments);
  const whereAt = declaration.lastIndexOf(" where ");
  const head = whereAt === -1 ? declaration : declaration.slice(0, whereAt);
  // The compiler writes `T : Decodable`; the constraints below are written
  // `T: Decodable`, so both are brought to one form.
  const own =
    whereAt === -1
      ? []
      : declaration
          .slice(whereAt + " where ".length)
          .replaceAll(" : ", ": ")
          .split(", ");
  const inherited = extensionConstraints
    .map(renderConstraint)
    .filter((constraint) => !own.includes(constraint));
  const constraints = [...own, ...inherited];
  return constraints.length === 0
    ? head
    : `${head} where ${constraints.join(", ")}`;
}

const CLOSERS: Readonly<Record<string, string>> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

/**
 * Splits the parameter clause that starts at `open` (the index of its `(`)
 * into one text per parameter. Commas inside brackets, generic arguments and
 * string literals do not separate parameters.
 */
function splitParameters(declaration: string, open: number): string[] {
  const parameters: string[] = [];
  const closers: string[] = [];
  let angle = 0;
  let current = "";
  for (let index = open + 1; index < declaration.length; index++) {
    const char = declaration.charAt(index);
    if (char === '"') {
      const end = endOfString(declaration, index);
      current += declaration.slice(index, end + 1);
      index = end;
      continue;
    }
    if (char === ")" && closers.length === 0) {
      return current.trim() === "" && parameters.length === 0
        ? []
        : [...parameters, current.trim()];
    }
    if (char in CLOSERS) {
      closers.push(CLOSERS[char] ?? "");
    } else if (char === closers.at(-1)) {
      closers.pop();
    } else if (char === "<" && /\w/.test(declaration.charAt(index - 1))) {
      // `<` after a name opens generic arguments; after a space it compares.
      angle++;
    } else if (char === ">" && angle > 0 && declaration[index - 1] !== "-") {
      angle--;
    } else if (char === "," && closers.length === 0 && angle === 0) {
      parameters.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  throw new Error(`Unbalanced parameter clause in "${declaration}"`);
}

/** Index of the quote that closes the string literal opened at `start`. */
function endOfString(text: string, start: number): number {
  for (let index = start + 1; index < text.length; index++) {
    if (text[index] === "\\") {
      index++;
    } else if (text[index] === '"') {
      return index;
    }
  }
  return text.length - 1;
}

/**
 * The default value expression of each parameter of a function or
 * initializer, `undefined` where the caller must pass a value. The symbol
 * graph lists parameters without their defaults, so they are read from the
 * declaration, where the compiler prints them as written.
 */
export function parameterDefaults(
  fragments: readonly Fragment[],
): (string | undefined)[] {
  // The clause is the first `(` after the name, so that the parentheses of an
  // attribute before it are not taken for it.
  const name = fragments.findIndex(
    (fragment) =>
      fragment.kind === "identifier" ||
      (fragment.kind === "keyword" && fragment.spelling === "init"),
  );
  const declaration = joinFragments(fragments);
  const afterName = joinFragments(fragments.slice(0, name + 1)).length;
  const open = declaration.indexOf("(", afterName);
  if (name === -1 || open === -1) {
    return [];
  }
  return splitParameters(declaration, open).map((parameter) => {
    const equals = parameter.indexOf(" = ");
    return equals === -1 ? undefined : parameter.slice(equals + 3).trim();
  });
}

/**
 * A Swift literal as a JSON scalar: `"POST"` is the string `POST`, `600` a
 * number, `true` a boolean. Anything else, `nil` included, is `undefined`
 * and stays source text.
 */
export function swiftLiteral(
  source: string,
): string | number | boolean | undefined {
  if (source === "true" || source === "false") {
    return source === "true";
  }
  if (/^-?\d+(\.\d+)?$/.test(source)) {
    const number = Number(source);
    return Number.isSafeInteger(number) || source.includes(".")
      ? number
      : undefined;
  }
  // A string with an escape or an interpolation is not worth interpreting.
  return /^"([^"\\]*)"$/.exec(source)?.[1];
}
