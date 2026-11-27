import { resolve } from "node:path";
import type { SourceConfig } from "../config.ts";
import type { ApiModel } from "../model.ts";
import { griffeModel, readGriffeDump } from "./python/griffe.ts";
import { readSymbolGraphs, swiftModel } from "./swift/symbol-graph.ts";

/**
 * The language each format documents, as a code fence names it. The model an
 * adapter builds says the same; this is for when no model is loaded.
 */
const LANGUAGES: Readonly<Record<SourceConfig["format"], string>> = {
  "swift-symbol-graph": "swift",
  griffe: "python",
};

export const sourceLanguage = (source: SourceConfig): string =>
  LANGUAGES[source.format];

/**
 * Reads an SDK's API in the doc format its config names and returns it as an
 * API model. This is the one place that knows which formats exist: adding a
 * language is a new adapter and a new case here.
 */
export function loadModel(source: SourceConfig, directory: string): ApiModel {
  switch (source.format) {
    case "swift-symbol-graph":
      return swiftModel(
        readSymbolGraphs(resolve(directory, source.directory)),
        source.modules,
      );
    case "griffe":
      return griffeModel(
        readGriffeDump(resolve(directory, source.file)),
        source,
      );
  }
}
