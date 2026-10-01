/**
 * The `EdgeFunctionsMetadata` contract: the document this package produces
 * and out-of-process generators (a generator in another language's SDK repo,
 * fed JSON over a process boundary) consume.
 *
 * ArkType is the single source of truth: each shape is an ArkType schema and
 * the exported type is `typeof schema.infer`. `parseEdgeFunctionsMetadata` is
 * an opt-in runtime validator for consumers that receive the document from
 * somewhere other than `extractEdgeFunctionsMetadata`.
 */
import { scope, type } from "arktype";

/**
 * The language-neutral type language a contract is expressed in. It covers
 * what JSON can carry, so every SDK generator can render every node:
 *
 * - `string`, `number`, `boolean`, `null`, `unknown` are the JSON scalars
 *   plus the escape hatch for `any`/`unknown`.
 * - `literal` is a single string, number or boolean value.
 * - `array` and `tuple` are JSON arrays with one element type or one type per
 *   position.
 * - `object` is a JSON object with named properties; `additionalProperties`
 *   carries the type of any key that is not listed, when the source had an
 *   index signature next to named properties.
 * - `record` is a JSON object whose keys are all of one type (`string` or a
 *   union of string literals) and whose values are all of one type.
 * - `union` is a choice between members.
 * - `reference` names a declaration in the function's `types`, so recursive
 *   and shared types keep their identity.
 * - `unsupported` marks a TypeScript construct the extractor could not
 *   express (a method, a conditional type, a `Date`, ...). `repr` holds the
 *   source text for the reader; generators fall back to their loosest type.
 */
const contractTypes = scope({
  contractType:
    "primitive | literal | array | tuple | object | record | union | reference | unsupported",
  primitive: { kind: "'string' | 'number' | 'boolean' | 'null' | 'unknown'" },
  literal: { kind: "'literal'", value: "string | number | boolean" },
  array: { kind: "'array'", element: "contractType" },
  tuple: { kind: "'tuple'", elements: "contractType[]" },
  property: { name: "string", type: "contractType", optional: "boolean" },
  object: {
    kind: "'object'",
    properties: "property[]",
    "additionalProperties?": "contractType",
  },
  record: { kind: "'record'", key: "contractType", value: "contractType" },
  union: { kind: "'union'", members: "contractType[]" },
  reference: { kind: "'reference'", name: "string" },
  unsupported: { kind: "'unsupported'", repr: "string" },
}).export();

export const contractTypeSchema = contractTypes.contractType;
export type ContractType = typeof contractTypeSchema.infer;
export type ContractProperty = typeof contractTypes.property.infer;

/** A named type referenced from a contract through a `reference` node. */
export const contractDeclarationSchema = type({
  name: "string",
  type: contractTypeSchema,
});
export type ContractDeclaration = typeof contractDeclarationSchema.infer;

/**
 * Something the extractor could not express, or a function it could not
 * read. `path` locates the node in the function's contract, for example
 * `RequestBody.address.zip` or `Shared.id` for a declaration; it is empty
 * when the diagnostic concerns the function as a whole.
 */
export const diagnosticSchema = type({
  slug: "string",
  path: "string",
  message: "string",
});
export type Diagnostic = typeof diagnosticSchema.infer;

/**
 * One Edge Function of the project. Paths are relative to the project root
 * (the directory holding `supabase/`) in POSIX form, the way the Supabase CLI
 * resolves them from `config.toml`.
 */
export const edgeFunctionSchema = type({
  slug: "string",
  entrypoint: "string",
  importMap: "string | null",
  verifyJwt: "boolean",
  /** The exported `RequestBody` type, or `null` when the module has none. */
  requestBody: contractTypeSchema.or("null"),
  /** The exported `ResponseBody` type, or `null` when the module has none. */
  responseBody: contractTypeSchema.or("null"),
  /** Every declaration a `reference` in this function's contract points at. */
  types: contractDeclarationSchema.array(),
});
export type EdgeFunction = typeof edgeFunctionSchema.infer;

/**
 * Bumped whenever the document's shape changes in a way a consumer should
 * branch on. Out-of-process consumers only see the serialized document, so a
 * shape change is otherwise undetectable until something breaks at read time.
 */
export const EDGE_FUNCTIONS_METADATA_VERSION = 1;

/**
 * The complete document: every deployable Edge Function of a project with its
 * contract, plus the diagnostics collected while extracting them.
 */
export const edgeFunctionsMetadataSchema = type({
  version: `${EDGE_FUNCTIONS_METADATA_VERSION}`,
  functions: edgeFunctionSchema.array(),
  diagnostics: diagnosticSchema.array(),
});
export type EdgeFunctionsMetadata = typeof edgeFunctionsMetadataSchema.infer;

/**
 * Serialize the document to the JSON that crosses the process boundary to an
 * out-of-process generator. Kept as a named export so every caller serializes
 * the contract the same way.
 */
export function serializeEdgeFunctionsMetadata(
  metadata: EdgeFunctionsMetadata,
): string {
  return JSON.stringify(metadata);
}

/**
 * Validate an unknown value against {@link edgeFunctionsMetadataSchema} and
 * return it typed. Throws a `TypeError` with ArkType's readable summary when
 * the shape is wrong.
 */
export function parseEdgeFunctionsMetadata(
  data: unknown,
): EdgeFunctionsMetadata {
  const out = edgeFunctionsMetadataSchema(data);
  if (out instanceof type.errors) {
    throw new TypeError(`Invalid EdgeFunctionsMetadata: ${out.summary}`);
  }
  return out;
}
