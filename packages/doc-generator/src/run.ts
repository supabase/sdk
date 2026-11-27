import { resolve } from "node:path";
import type { Config } from "./config.ts";
import { GeneratorError } from "./errors.ts";
import { generate, type GenerateResult } from "./generate.ts";
import { previewDefinitions, type PreviewResult } from "./preview.ts";
import { loadModel, sourceLanguage } from "./sources/index.ts";
import { writeDefinitions } from "./write.ts";

export interface RunResult extends GenerateResult {
  /** Absolute path of the folder the definitions were written to. */
  readonly output: string;
}

/**
 * Reads the inputs a config names, generates the definitions and writes
 * them. Everything that touches the file system happens here; `generate`
 * itself is pure. `directory` is what the paths in the config are relative
 * to: the folder of the config file.
 */
export function runGenerator(config: Config, directory: string): RunResult {
  const result = generate({
    model: loadModel(config.source, directory),
    ...(config.exclude === undefined ? {} : { exclude: config.exclude }),
    ...(config.strict === undefined ? {} : { strict: config.strict }),
  });
  const output = resolve(directory, config.output);
  writeDefinitions(output, result.files);
  return { ...result, output };
}

/**
 * Copies the definitions a config's `output` holds into a local checkout of
 * the docs site. `directory` is the folder of the config file, and `docs` is
 * the checkout, as an absolute path.
 */
export function runPreview(
  config: Config,
  directory: string,
  docs: string,
): PreviewResult {
  if (config.preview === undefined) {
    throw new GeneratorError(
      "The config has no `preview`. Add `preview: { path, title }` to say where the docs site shows this SDK.",
    );
  }
  return previewDefinitions({
    definitions: resolve(directory, config.output),
    docs,
    preview: config.preview,
    language: sourceLanguage(config.source),
  });
}
