import { InvalidOptionError } from "./errors.js";
const quote = (value) => JSON.stringify(value);
const resolveOne = (language, spec, value) => {
    if (value === undefined) {
        return spec.default;
    }
    switch (spec.kind) {
        case "boolean":
            if (typeof value !== "boolean") {
                throw new InvalidOptionError({
                    language,
                    option: spec.name,
                    message: `Option "${spec.name}" of language "${language}" expects true or false, got ${quote(value)}.`,
                });
            }
            return value;
        case "string":
            if (typeof value !== "string") {
                throw new InvalidOptionError({
                    language,
                    option: spec.name,
                    message: `Option "${spec.name}" of language "${language}" expects a string, got ${quote(value)}.`,
                });
            }
            return value;
        case "choice":
            if (typeof value !== "string" || !spec.choices.includes(value)) {
                throw new InvalidOptionError({
                    language,
                    option: spec.name,
                    message: `Option "${spec.name}" of language "${language}" expects one of ${spec.choices
                        .map(quote)
                        .join(", ")}, got ${quote(value)}.`,
                });
            }
            return value;
    }
};
/**
 * Applies the defaults of `specs` to `values` and validates every value.
 * Throws an `InvalidOptionError` for a name no spec declares or a value the
 * spec does not accept. Every `TypegenLanguage.generate` runs this first, so
 * consumers may pass only the options the user set.
 */
export function resolveOptions(language, specs, values) {
    const known = new Set(specs.map((spec) => spec.name));
    for (const name of Object.keys(values)) {
        if (!known.has(name)) {
            throw new InvalidOptionError({
                language,
                option: name,
                message: `Language "${language}" has no option "${name}".`,
            });
        }
    }
    const resolved = {};
    for (const spec of specs) {
        const value = resolveOne(language, spec, values[spec.name]);
        if (value !== undefined) {
            resolved[spec.name] = value;
        }
    }
    return resolved;
}
