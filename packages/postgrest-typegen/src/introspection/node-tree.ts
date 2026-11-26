/**
 * A value in the text form of a `pg_node_tree`: a scalar token, `null` for
 * `<>`, a list, or a node. Integer, OID and bitmapset lists (`(i 1 2)`,
 * `(o 23)`, `(b 3)`) lose their marker and become lists of scalar tokens.
 */
export type NodeTreeValue = string | null | NodeTreeValue[] | NodeTreeNode;

export interface NodeTreeNode {
  type: string;
  fields: Record<string, NodeTreeValue>;
}

interface Token {
  raw: string;
  text: string;
}

const LIST_MARKERS = new Set(["i", "o", "b", "x"]);
const WHITESPACE = " \t\n";
const PUNCTUATION = "(){}";

/**
 * Parse the text form of a `pg_node_tree` (for example
 * `pg_rewrite.ev_action::text`), following the tokenizer of PostgreSQL's
 * `read.c`: tokens are separated by whitespace, `(`, `)`, `{` and `}` are
 * tokens of their own, and a backslash escapes the next character.
 */
export function parseNodeTree(text: string): NodeTreeValue {
  const tokens = tokenize(text);
  let position = 0;

  const peek = (): Token | undefined => tokens[position];
  const next = (): Token => {
    const token = tokens[position++];
    if (token === undefined) {
      throw new Error("Unexpected end of pg_node_tree");
    }
    return token;
  };
  const isFieldEnd = (token: Token | undefined) =>
    token === undefined || token.raw === "}" || token.raw.startsWith(":");

  const parseValue = (): NodeTreeValue => {
    const token = next();
    if (token.raw === "{") {
      const type = next().text;
      const fields: Record<string, NodeTreeValue> = {};
      while (peek()?.raw !== "}") {
        const name = next().raw.slice(1);
        fields[name] = isFieldEnd(peek()) ? null : parseValue();
        // Some fields span several tokens, such as a constant's
        // `:constvalue 4 [ 1 0 0 0 ]`; only the first one is kept.
        while (!isFieldEnd(peek())) {
          parseValue();
        }
      }
      next();
      return { type, fields };
    }
    if (token.raw === "(") {
      const items: NodeTreeValue[] = [];
      const first = peek();
      if (first !== undefined && LIST_MARKERS.has(first.raw)) {
        next();
      }
      while (peek()?.raw !== ")") {
        items.push(parseValue());
      }
      next();
      return items;
    }
    if (token.raw === "<>") {
      return null;
    }
    return token.text;
  };

  const value = parseValue();
  if (position !== tokens.length) {
    throw new Error("Trailing tokens after pg_node_tree");
  }
  return value;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const character = text.charAt(index);
    if (WHITESPACE.includes(character)) {
      index++;
      continue;
    }
    if (PUNCTUATION.includes(character)) {
      tokens.push({ raw: character, text: character });
      index++;
      continue;
    }
    const start = index;
    let unescaped = "";
    while (index < text.length) {
      const current = text.charAt(index);
      if (current === "\\" && index + 1 < text.length) {
        unescaped += text.charAt(index + 1);
        index += 2;
        continue;
      }
      if (WHITESPACE.includes(current) || PUNCTUATION.includes(current)) {
        break;
      }
      unescaped += current;
      index++;
    }
    tokens.push({ raw: text.slice(start, index), text: unescaped });
  }
  return tokens;
}

export function isNode(
  value: NodeTreeValue | undefined,
  type?: string,
): value is NodeTreeNode {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (type === undefined || value.type === type)
  );
}
