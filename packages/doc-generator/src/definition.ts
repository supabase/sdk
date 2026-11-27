import { GeneratorError } from "./errors.ts";
import {
  type ApiModel,
  type ApiParameter,
  type ApiSymbol,
  type ApiType,
  bySourceOrder,
  type CallableSymbol,
} from "./model.ts";
import { slugify } from "./slug.ts";

/**
 * A parameter, a property or a nested field. The keys are declared in the
 * order of the docs schema, which is the order they are written in.
 */
export interface DefinitionField {
  readonly name: string;
  readonly location: "argument" | "property";
  readonly type?: string;
  readonly required: boolean;
  readonly description?: string;
  readonly default?: string | number | boolean;
  readonly allowed_values?: readonly (string | number | boolean)[];
  readonly variadic?: boolean;
  readonly children?: readonly DefinitionField[];
}

/** The frontmatter of one definition file, keys in schema order. */
export interface Definition {
  readonly id: string;
  readonly kind: "method";
  readonly category: string;
  readonly title: string;
  readonly symbol: string;
  /** Empty when the function has no doc comment. */
  readonly summary: string;
  readonly description?: string;
  readonly signature: string;
  readonly type_params?: readonly string[];
  readonly stability: "stable" | "beta" | "experimental";
  readonly deprecated: boolean;
  readonly parameters: readonly DefinitionField[];
  readonly returns?: { readonly type: string; readonly description?: string };
  readonly throws: readonly {
    readonly type?: string;
    readonly description: string;
  }[];
  readonly examples: readonly {
    readonly id: string;
    readonly title: string;
    readonly lang: string;
    readonly code: string;
  }[];
}

/** The model with the lookups a definition needs. */
export interface ModelIndex {
  readonly language: string;
  readonly byId: ReadonlyMap<string, ApiSymbol>;
  /**
   * The callables that share a name, which are the overloads of one
   * function, each list in source order.
   */
  readonly byName: ReadonlyMap<string, readonly CallableSymbol[]>;
}

export function indexModel(model: ApiModel): ModelIndex {
  const byId = new Map<string, ApiSymbol>();
  const byName = new Map<string, CallableSymbol[]>();
  const duplicates: string[] = [];
  for (const symbol of [...model.symbols].sort(bySourceOrder)) {
    if (byId.has(symbol.id)) {
      duplicates.push(symbol.id);
    }
    byId.set(symbol.id, symbol);
    if (symbol.kind === "callable") {
      byName.set(symbol.name, [...(byName.get(symbol.name) ?? []), symbol]);
    }
  }
  if (duplicates.length > 0) {
    throw new GeneratorError(
      "The API model has more than one symbol with the id:",
      duplicates,
    );
  }
  return { language: model.language, byId, byName };
}

/** Spreads `fields` only when they say something, so the files stay short. */
const when = <T extends object>(condition: boolean, fields: T): Partial<T> =>
  condition ? fields : {};

/**
 * The members of a type as nested fields, de-referenced all the way down. A
 * definition has to stand alone, so a reader never has to follow a type name
 * to another page. `seen` stops a type that contains itself.
 */
function childrenOf(
  type: ApiType | undefined,
  seen: readonly string[],
  index: ModelIndex,
): DefinitionField[] {
  const ref = type?.ref;
  const target = ref === undefined ? undefined : index.byId.get(ref);
  if (ref === undefined || target?.kind !== "type" || seen.includes(ref)) {
    return [];
  }
  return target.properties.flatMap((id): DefinitionField[] => {
    const property = index.byId.get(id);
    if (property?.kind !== "property") {
      return [];
    }
    const children = childrenOf(property.type, [...seen, ref], index);
    return [
      {
        name: property.title,
        location: "property",
        ...when(property.type !== undefined, { type: property.type?.text }),
        required: property.required,
        ...when(property.description !== "", {
          description: property.description,
        }),
        ...when(children.length > 0, { children }),
      },
    ];
  });
}

function parameterField(
  parameter: ApiParameter,
  index: ModelIndex,
): DefinitionField {
  const children = childrenOf(parameter.type, [], index);
  return {
    name: parameter.name,
    location: "argument",
    ...when(parameter.type !== undefined, { type: parameter.type?.text }),
    required: parameter.required,
    ...when(parameter.description !== "", {
      description: parameter.description,
    }),
    ...when(parameter.default !== undefined, { default: parameter.default }),
    ...when((parameter.allowedValues?.length ?? 0) > 0, {
      allowed_values: parameter.allowedValues,
    }),
    ...when(parameter.variadic, { variadic: true }),
    ...when(children.length > 0, { children }),
  };
}

/**
 * Examples need a title and an id that is unique in the definition. An
 * example without a title of its own is numbered, and a repeated title gets
 * its position added to the id.
 */
function examplesOf(lead: CallableSymbol): Definition["examples"] {
  const used = new Set<string>();
  return lead.doc.examples.map((example, position) => {
    const title = example.title ?? `Example ${position + 1}`;
    const slug = slugify(title) || `example-${position + 1}`;
    const id = used.has(slug) ? `${slug}-${position + 1}` : slug;
    used.add(id);
    return {
      id,
      title,
      lang: example.lang,
      code: `${example.code.replace(/\n+$/, "")}\n`,
    };
  });
}

/**
 * The Markdown below the frontmatter: what has no field in the schema. That
 * is the deprecation message, and the signatures the one `signature` field
 * has no room for.
 */
function notesOf(
  lead: CallableSymbol,
  others: readonly CallableSymbol[],
  language: string,
): string {
  const notes: string[] = [];
  const message = lead.deprecated?.message;
  if (message !== undefined) {
    notes.push(`> **Deprecated:** ${message.replace(/\s*\n\s*/g, " ")}`);
  }
  const signatures = [
    ...lead.alternateSignatures,
    ...others.flatMap((other) => [
      other.signature,
      ...other.alternateSignatures,
    ]),
  ].filter(
    (signature, position, all) =>
      signature !== lead.signature && all.indexOf(signature) === position,
  );
  if (signatures.length > 0) {
    notes.push(
      `Other signatures:\n\n\`\`\`${language}\n${signatures.join("\n")}\n\`\`\``,
    );
  }
  return notes.join("\n\n");
}

export interface BuiltDefinition {
  readonly definition: Definition;
  /** Markdown that follows the frontmatter, or an empty string. */
  readonly notes: string;
}

/**
 * Builds the definition of one function. `lead` is the callable the page
 * documents, and `others` are its overloads. The schema has one `signature`,
 * so theirs go to the notes.
 *
 * The id is the function's name in lowercase words, and the category is its
 * module. Both come from the code alone, so they are the same on every run
 * and change only when the code is renamed or moved.
 */
export function buildDefinition(
  lead: CallableSymbol,
  others: readonly CallableSymbol[],
  index: ModelIndex,
): BuiltDefinition {
  const returnsDescription = lead.doc.returns ?? "";
  const definition: Definition = {
    id: slugify(lead.name),
    kind: "method",
    category: lead.module,
    title: lead.title,
    symbol: lead.symbol,
    summary: lead.doc.summary,
    ...when(lead.doc.description !== "", {
      description: lead.doc.description,
    }),
    signature: lead.signature,
    ...when(lead.typeParams.length > 0, { type_params: lead.typeParams }),
    stability: lead.stability,
    deprecated: lead.deprecated !== undefined,
    parameters: lead.parameters.map((parameter) =>
      parameterField(parameter, index),
    ),
    ...when(lead.returns !== undefined, {
      returns: {
        type: lead.returns?.text ?? "",
        ...when(returnsDescription !== "", { description: returnsDescription }),
      },
    }),
    throws: lead.doc.throws,
    examples: examplesOf(lead),
  };
  return { definition, notes: notesOf(lead, others, index.language) };
}
