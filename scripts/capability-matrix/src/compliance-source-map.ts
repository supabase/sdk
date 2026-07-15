import { parseDocument, LineCounter, isMap, isSeq, isScalar } from "yaml";

export interface SourceMap {
  symbolLines: Map<string, number>;
  featureLines: Map<string, number>;
}

export function buildSourceMap(complianceYamlText: string): SourceMap {
  const symbolLines = new Map<string, number>();
  const featureLines = new Map<string, number>();

  const lineCounter = new LineCounter();
  const doc = parseDocument(complianceYamlText, { lineCounter });

  const features = doc.get("features", true);
  if (!isMap(features)) return { symbolLines, featureLines };

  for (const pair of features.items) {
    const key = pair.key;
    if (!isScalar(key) || typeof key.value !== "string") continue;
    if (key.range) featureLines.set(key.value, lineCounter.linePos(key.range[0]).line);

    const entry = pair.value;
    if (!isMap(entry)) continue;

    const symbols = entry.get("symbols", true);
    if (!isSeq(symbols)) continue;

    for (const item of symbols.items) {
      if (isScalar(item) && typeof item.value === "string" && item.range) {
        symbolLines.set(item.value, lineCounter.linePos(item.range[0]).line);
      }
    }
  }

  return { symbolLines, featureLines };
}
