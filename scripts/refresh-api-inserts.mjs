import fs from "node:fs/promises";
import path from "node:path";

const ROOTS = [
  "publications", // adjust if needed
];

const BLOCK_RE =
  /:::\s*\{\.api-insert\s+endpoint="([^"]+)"\}\s*\n<!-- api-cache -->\n([\s\S]*?)\n<!-- \/api-cache -->\n:::\s*/g;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function fetchText(endpoint) {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return (await res.text()).trim();
}

async function processFile(file) {
  if (!file.endsWith(".qmd")) return { changed: false };

  const original = await fs.readFile(file, "utf8");
  let changed = false;

  const updated = await replaceAsync(original, BLOCK_RE, async (match, endpoint, cached) => {
    try {
      const fresh = await fetchText(endpoint);
      changed = true;

      return (
        `::: {.api-insert endpoint="${endpoint}"}\n` +
        `<!-- api-cache -->\n` +
        `${fresh}\n` +
        `<!-- /api-cache -->\n` +
        `:::\n`
      );
    } catch (err) {
      // If fetch fails, keep existing cache but append an error note comment
      return (
        `::: {.api-insert endpoint="${endpoint}"}\n` +
        `<!-- api-cache -->\n` +
        `${cached.trim()}\n` +
        `<!-- /api-cache -->\n` +
        `<!-- api-error: ${String(err?.message || err)} -->\n` +
        `:::\n`
      );
    }
  });

  if (changed && updated !== original) {
    await fs.writeFile(file, updated, "utf8");
    return { changed: true };
  }

  return { changed: false };
}

// Helper: async replace
async function replaceAsync(str, re, asyncFn) {
  const matches = [...str.matchAll(re)];
  if (matches.length === 0) return str;

  let out = "";
  let lastIndex = 0;

  for (const m of matches) {
    out += str.slice(lastIndex, m.index);
    out += await asyncFn(...m);
    lastIndex = m.index + m[0].length;
  }

  out += str.slice(lastIndex);
  return out;
}

async function main() {
  let totalChanged = 0;

  for (const root of ROOTS) {
    try {
      for await (const file of walk(root)) {
        const { changed } = await processFile(file);
        if (changed) totalChanged++;
      }
    } catch {
      // root folder might not exist in some repos
    }
  }

  console.log(`refresh-api-inserts: updated ${totalChanged} file(s)`);
}

main().catch((e) => {
  console.error("refresh-api-inserts failed:", e);
  process.exit(1);
});
