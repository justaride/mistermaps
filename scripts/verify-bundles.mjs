import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "dist", ".vite", "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run \`npm run build\` first.`);
  process.exit(1);
}

/** @type {Record<string, {file: string, imports?: string[], dynamicImports?: string[]}>} */
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function findFileStartsWith(prefix) {
  for (const entry of Object.values(manifest)) {
    if (typeof entry?.file === "string" && entry.file.startsWith(prefix)) return entry.file;
  }
  return null;
}

const mapboxEngineFile = findFileStartsWith("assets/mapbox-engine-");
const maplibreEngineFile = findFileStartsWith("assets/maplibre-engine-");

if (!mapboxEngineFile || !maplibreEngineFile) {
  console.error("Could not find engine chunks in manifest.");
  console.error(`Found mapbox: ${mapboxEngineFile}`);
  console.error(`Found maplibre: ${maplibreEngineFile}`);
  process.exit(1);
}

const patternSources = [
  "src/patterns/data-viz/export-image-print.tsx",
  "src/patterns/navigation/geocoding-search.tsx",
  "src/patterns/navigation/reverse-geocoding.tsx",
  "src/patterns/layers/property-filtering.tsx",
  "src/patterns/layers/fill-patterns.tsx",
  "src/patterns/layers/hover-tooltips.tsx",
  "src/patterns/layers/streaming-updates.tsx",
];

function resolveImportFiles(entryKey) {
  const entry = manifest[entryKey];
  const out = new Set();
  const q = [...(entry?.imports ?? [])];
  while (q.length) {
    const k = q.pop();
    const e = manifest[k];
    if (!e) continue;
    if (typeof e.file === "string") out.add(e.file);
    for (const next of e.imports ?? []) q.push(next);
  }
  return out;
}

let ok = true;
for (const src of patternSources) {
  const entry = manifest[src];
  if (!entry) {
    console.error(`Missing manifest entry for ${src}`);
    ok = false;
    continue;
  }

  const importedFiles = resolveImportFiles(src);
  const hasMapboxStatic = importedFiles.has(mapboxEngineFile);
  const hasMaplibreStatic = importedFiles.has(maplibreEngineFile);

  if (hasMapboxStatic || hasMaplibreStatic) {
    console.error(`FAIL ${src}: statically imports engine chunk(s):`);
    if (hasMapboxStatic) console.error(`- ${mapboxEngineFile}`);
    if (hasMaplibreStatic) console.error(`- ${maplibreEngineFile}`);
    ok = false;
  } else {
    console.log(`OK   ${src}`);
  }
}

process.exit(ok ? 0 : 1);
