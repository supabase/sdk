import { describe, expect, test } from "bun:test";

import { parseNodeTree } from "../../src/introspection/node-tree.ts";

describe("parseNodeTree", () => {
  test("parses nodes, lists, nulls and scalars", () => {
    expect(
      parseNodeTree(
        '({QUERY :rtable ({RANGETBLENTRY :rtekind 0 :relid 16384}) :setOperations <> :cols ("id" "name")})',
      ),
    ).toEqual([
      {
        type: "QUERY",
        fields: {
          rtable: [
            { type: "RANGETBLENTRY", fields: { rtekind: "0", relid: "16384" } },
          ],
          setOperations: null,
          cols: ['"id"', '"name"'],
        },
      },
    ]);
  });

  test("drops the marker of integer, OID and bitmapset lists", () => {
    expect(
      parseNodeTree(
        "{VAR :varnullingrels (b) :cols (i 1 2) :types (o 23) :rels (b 3)}",
      ),
    ).toEqual({
      type: "VAR",
      fields: {
        varnullingrels: [],
        cols: ["1", "2"],
        types: ["23"],
        rels: ["3"],
      },
    });
  });

  test("keeps only the length of a constant's value", () => {
    expect(
      parseNodeTree(
        "{CONST :constlen 4 :constvalue 4 [ 1 0 0 0 0 0 0 0 ] :location 7}",
      ),
    ).toEqual({
      type: "CONST",
      fields: { constlen: "4", constvalue: "4", location: "7" },
    });
  });

  test("unescapes tokens without mistaking them for structure", () => {
    expect(
      parseNodeTree(
        "{TARGETENTRY :resname odd\\ \\(name\\} :alias \\<> :empty <>}",
      ),
    ).toEqual({
      type: "TARGETENTRY",
      fields: { resname: "odd (name}", alias: "<>", empty: null },
    });
  });

  test("rejects truncated input", () => {
    expect(() => parseNodeTree("{QUERY :rtable (")).toThrow();
  });
});
