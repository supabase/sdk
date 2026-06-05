import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAreas } from "./load.js";
import { computeParity } from "./report.js";
import { LANGUAGES } from "./types.js";
import type { Feature, Language, LoadedArea } from "./types.js";

// ── Constants ────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<Language, string> = {
  javascript: "JavaScript",
  flutter: "Flutter",
  python: "Python",
  swift: "Swift",
  csharp: "C#",
  go: "Go",
  kotlin: "Kotlin",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function featureParity(feature: Feature): number {
  let impl = 0;
  let applicable = 0;
  for (const lang of LANGUAGES) {
    const status = feature.sdks[lang]?.status;
    if (!status || status === "not_applicable") continue;
    applicable++;
    if (status === "implemented") impl++;
  }
  return applicable === 0 ? 1 : impl / applicable;
}

function parityClass(n: number): string {
  if (n >= 0.8) return "parity-high";
  if (n >= 0.4) return "parity-mid";
  return "parity-low";
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Cell rendering ───────────────────────────────────────────────────────────

function statusCell(feature: Feature, lang: Language): string {
  const entry = feature.sdks[lang];
  if (!entry) return `<td class="cell-na">➖</td>`;
  switch (entry.status) {
    case "implemented":
      return `<td class="cell-yes" title="${esc(LANG_LABELS[lang])}: implemented">✅</td>`;
    case "not_implemented":
      return `<td class="cell-no" title="${esc(LANG_LABELS[lang])}: not implemented">⬜</td>`;
    case "not_applicable":
      return `<td class="cell-na" title="${esc(LANG_LABELS[lang])}: not applicable${entry.notes ? " — " + esc(entry.notes) : ""}">➖</td>`;
  }
}

// ── Area table ───────────────────────────────────────────────────────────────

function renderArea(loaded: LoadedArea): string {
  const { area } = loaded;

  // Group features preserving insertion order
  const groups = new Map<string, Feature[]>();
  for (const f of area.features) {
    const g = f.group ?? "general";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  }

  let rows = "";
  for (const [group, features] of groups) {
    rows += `<tr class="group-row"><td colspan="${LANGUAGES.length + 2}">${esc(group)}</td></tr>\n`;
    for (const f of features) {
      const fp = featureParity(f);
      rows += `      <tr>
        <td class="feature-name">
          <div class="feature-name-text">${esc(f.name)}</div>
          <div class="feature-desc">${esc(f.description)}</div>
        </td>
        ${LANGUAGES.map((l) => statusCell(f, l)).join("")}
        <td class="parity-cell ${parityClass(fp)}">${pct(fp)}</td>
      </tr>\n`;
    }
  }

  return `
  <section class="area-section" id="area-${esc(area.area)}">
    <div class="area-header">
      <h2>${esc(area.title)}</h2>
      <p class="area-desc">${esc(area.description)}</p>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="th-feature">Feature</th>
            ${LANGUAGES.map((l) => `<th class="th-sdk">${esc(LANG_LABELS[l])}</th>`).join("")}
            <th class="th-parity">Parity</th>
          </tr>
        </thead>
        <tbody>
${rows}        </tbody>
      </table>
    </div>
  </section>`;
}

// ── Full page ────────────────────────────────────────────────────────────────

export function renderHtml(areas: LoadedArea[], buildDate: string): string {
  const parity = computeParity(areas);

  const navLinks = areas
    .map(
      (a) =>
        `<a href="#area-${esc(a.area.area)}" class="nav-link">${esc(a.area.title)}</a>`
    )
    .join("");

  const sdkCards = LANGUAGES.map((l) => {
    const score = clamp01(parity.perLanguage[l]);
    return `
      <div class="sdk-card">
        <div class="sdk-label">${esc(LANG_LABELS[l])}</div>
        <div class="sdk-score ${parityClass(score)}">${pct(score)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(score)}"></div></div>
      </div>`;
  }).join("");

  const areaCards = areas
    .map((a) => {
      const score = clamp01(parity.perArea[a.area.area] ?? 0);
      return `
      <div class="area-card">
        <a href="#area-${esc(a.area.area)}" class="area-card-link">
          <span class="area-card-title">${esc(a.area.title)}</span>
          <span class="area-card-score ${parityClass(score)}">${pct(score)}</span>
        </a>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(score)}"></div></div>
      </div>`;
    })
    .join("");

  const areaSections = areas.map((a) => renderArea(a)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supabase SDK Capability Matrix</title>
  <style>
    /* ── Reset & base ──────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #171717;
      background: #f8fafc;
    }
    a { color: inherit; text-decoration: none; }

    /* ── Header ────────────────────────────────────────────── */
    .site-header {
      background: #1a1a1a;
      color: #ededed;
      padding: 2rem 2rem 1.5rem;
      border-bottom: 1px solid #2d2d2d;
    }
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .site-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .site-title span { color: #3ECF8E; }
    .build-info {
      font-size: 0.75rem;
      color: #888;
      margin-top: 0.25rem;
    }
    .overall-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #2d2d2d;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
    }
    .overall-badge .label { color: #888; }
    .overall-badge .value { font-weight: 700; color: #3ECF8E; font-size: 1.1rem; }

    /* ── SDK score cards ───────────────────────────────────── */
    .sdk-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .sdk-card {
      background: #242424;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 0.6rem 0.9rem;
      min-width: 110px;
    }
    .sdk-label { font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .sdk-score { font-size: 1.1rem; font-weight: 700; margin: 0.1rem 0 0.4rem; }

    /* ── Parity bar ────────────────────────────────────────── */
    .bar-track { height: 4px; background: #333; border-radius: 2px; overflow: hidden; }
    .bar-fill { height: 100%; background: #3ECF8E; border-radius: 2px; }

    /* ── Area overview cards ───────────────────────────────── */
    .area-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 1.25rem 2rem;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
    }
    .area-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.6rem 0.9rem;
      min-width: 130px;
      background: #fafafa;
    }
    .area-card-link {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }
    .area-card-title { font-size: 0.8rem; font-weight: 600; color: #444; }
    .area-card-score { font-weight: 700; font-size: 0.9rem; }
    .area-card .bar-track { background: #e5e7eb; }

    /* ── Nav ───────────────────────────────────────────────── */
    .site-nav {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 0 2rem;
      display: flex;
      gap: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .site-nav::-webkit-scrollbar { display: none; }
    .nav-link {
      display: inline-block;
      padding: 0.65rem 1rem;
      font-size: 0.8rem;
      font-weight: 500;
      color: #666;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
      transition: color 0.15s, border-color 0.15s;
    }
    .nav-link:hover { color: #171717; border-bottom-color: #3ECF8E; }

    /* ── Main content ──────────────────────────────────────── */
    .site-main { padding: 2rem; }

    /* ── Area section ──────────────────────────────────────── */
    .area-section {
      margin-bottom: 3rem;
      /* keep the section title visible below the sticky nav when linked */
      scroll-margin-top: 52px;
    }
    .area-header { margin-bottom: 1rem; }
    .area-header h2 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #171717;
      letter-spacing: -0.01em;
    }
    .area-desc { font-size: 0.8rem; color: #666; margin-top: 0.2rem; }

    /* ── Table ─────────────────────────────────────────────── */
    .table-wrap {
      overflow-x: auto;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fff;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      min-width: 820px;
    }
    /* NOTE: thead sticky is intentionally omitted — position:sticky does not
       work reliably inside overflow-x:auto containers in all browsers. The
       sticky site-nav above is sufficient for orientation while scrolling. */
    thead tr { background: #f8fafc; }
    th {
      padding: 0.55rem 0.75rem;
      text-align: left;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
      border-bottom: 1px solid #e5e7eb;
      white-space: nowrap;
    }
    .th-feature { min-width: 200px; }
    .th-sdk { width: 80px; text-align: center; }
    .th-parity { width: 60px; text-align: center; }

    tbody tr:hover { background: #f8fafc; }

    td {
      padding: 0.45rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.82rem;
    }
    tbody tr:last-child td { border-bottom: none; }

    /* ── Group header row ──────────────────────────────────── */
    .group-row td {
      background: #f1f5f9;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      padding: 0.35rem 0.75rem;
      border-top: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
    }

    /* ── Feature name ──────────────────────────────────────── */
    .feature-name { cursor: default; }
    .feature-name-text { font-weight: 500; color: #171717; }
    .feature-desc { font-size: 0.72rem; color: #888; margin-top: 0.1rem; }

    /* ── Status cells ──────────────────────────────────────── */
    .cell-yes, .cell-no, .cell-na {
      text-align: center;
      font-size: 1rem;
    }
    .cell-yes { background: #f0fdf4; }
    .cell-no  { color: #cbd5e1; }
    .cell-na  { color: #cbd5e1; opacity: 0.6; }

    /* ── Parity cell ───────────────────────────────────────── */
    .parity-cell {
      text-align: center;
      font-weight: 600;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }
    .parity-high { color: #16a34a; }
    .parity-mid  { color: #d97706; }
    .parity-low  { color: #dc2626; }

    /* ── SDK score parity colours ──────────────────────────── */
    .sdk-score.parity-high { color: #3ECF8E; }
    .sdk-score.parity-mid  { color: #f59e0b; }
    .sdk-score.parity-low  { color: #f87171; }
    .area-card-score.parity-high { color: #16a34a; }
    .area-card-score.parity-mid  { color: #d97706; }
    .area-card-score.parity-low  { color: #dc2626; }

    /* ── Legend ────────────────────────────────────────────── */
    .legend {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      padding: 1.25rem 2rem;
      background: #fff;
      border-top: 1px solid #e5e7eb;
      font-size: 0.75rem;
      color: #666;
    }
    .legend-item { display: flex; align-items: center; gap: 0.4rem; }
  </style>
</head>
<body>

<header class="site-header">
  <div class="header-top">
    <div>
      <h1 class="site-title"><span>Supabase</span> SDK Capability Matrix</h1>
      <p class="build-info">Updated ${esc(buildDate)}</p>
    </div>
    <div class="overall-badge">
      <span class="label">Overall parity</span>
      <span class="value">${pct(clamp01(parity.overall))}</span>
    </div>
  </div>
  <div class="sdk-grid">
    ${sdkCards}
  </div>
</header>

<div class="area-grid">
  ${areaCards}
</div>

<nav class="site-nav">
  ${navLinks}
</nav>

<main class="site-main">
  ${areaSections}
</main>

<footer class="legend">
  <span class="legend-item">✅ Implemented</span>
  <span class="legend-item">⬜ Not implemented</span>
  <span class="legend-item">➖ Not applicable</span>
  <span class="legend-item" style="color:#16a34a">● ≥ 80% parity</span>
  <span class="legend-item" style="color:#d97706">● ≥ 40% parity</span>
  <span class="legend-item" style="color:#dc2626">● &lt; 40% parity</span>
</footer>

<script>
  // Highlight active nav link on scroll
  const sections = document.querySelectorAll('.area-section');
  const links = document.querySelectorAll('.nav-link');
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.style.borderBottomColor = '');
          const active = document.querySelector('.nav-link[href="#' + e.target.id + '"]');
          if (active) active.style.borderBottomColor = '#3ECF8E';
        }
      });
    },
    { rootMargin: '-40px 0px -60% 0px', threshold: 0 }
  );
  sections.forEach(s => observer.observe(s));
</script>

</body>
</html>`;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

async function main() {
  const root = repoRoot();
  const capDir = join(root, "capabilities");
  const outDir = join(root, "site");

  const { areas, findings } = loadAreas(capDir);
  if (findings.length > 0) {
    for (const f of findings) console.error(`${f.level.toUpperCase()} ${f.file}: ${f.message}`);
    if (findings.some((f) => f.level === "error")) process.exit(1);
  }

  const buildDate = new Date().toISOString().slice(0, 10);
  const html = renderHtml(areas, buildDate);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
  console.log(`Site built → site/index.html (${(html.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
