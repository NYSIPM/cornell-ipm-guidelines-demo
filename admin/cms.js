(function () {
  if (!window.CMS) return;

  // ============================================================
  // 1) CONFIG
  // ============================================================
  // Change later when you have a real endpoint.
  const API_BASE_URL = "https://cropandpestguides.cce.cornell.edu/NewGuidelinesTableImportTest/api/example";

  // ============================================================
  // 2) EDITOR COMPONENT (SHORTCODE FORMAT)
  //    Stores: {{< pesticide-table guidelineId="12" pestId="34" siteId="56" >}}
  // ============================================================
  // ✅ No /m flag
// One-line, repeatable matcher (supports multiple occurrences in a doc)
const shortcodeLinePattern =
  /^\s*\{\{<\s*pesticide-table\b[^}]*>\s*\}\}\s*$/m;

CMS.registerEditorComponent({
  id: "pesticide-table",
  label: "Pesticide Table (DB)",
  fields: [
    { name: "guidelineId", label: "Guideline ID", widget: "string" },
    { name: "pestId", label: "Pest ID", widget: "string" },
    { name: "siteId", label: "Site ID", widget: "string" }
  ],

  pattern: shortcodeLinePattern,

  fromBlock: (match) => {
    const block = match?.[0] || "";

    const getAttr = (name) => {
      const m = block.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
      return m ? m[1] : "";
    };

    return {
      guidelineId: getAttr("guidelineId"),
      pestId: getAttr("pestId"),
      siteId: getAttr("siteId")
    };
  },

  toBlock: (data) => {
    const g = (data.guidelineId || "").trim();
    const p = (data.pestId || "").trim();
    const s = (data.siteId || "").trim();
    return `{{< pesticide-table guidelineId="${g}" pestId="${p}" siteId="${s}" >}}`;
  },

  toPreview: (data) => {
    const g = (data.guidelineId || "").trim();
    const p = (data.pestId || "").trim();
    const s = (data.siteId || "").trim();
    return fakeTableHtml(g, p, s);
  }
});


 

  // ============================================================
  // 3) PREVIEW HYDRATION LOOP
  //    Finds placeholders and replaces them with API HTML (or fake HTML).
  // ============================================================
  startPreviewHydrationLoop();

  function startPreviewHydrationLoop() {
    const intervalMs = 800;

    setInterval(async () => {
      const previewDoc = getPreviewDocument();
      if (!previewDoc) return;

      await hydrateAllPesticideTables(previewDoc);
    }, intervalMs);
  }

  function getPreviewDocument() {
    // Decap renders preview in an iframe. Selector can vary by version/themes.
    // This tries a few common patterns.
    const iframe =
      document.querySelector("iframe[class*='PreviewPaneFrame']") ||
      document.querySelector("iframe[title*='Preview']") ||
      document.querySelector("iframe");

    return iframe?.contentDocument || null;
  }

  async function hydrateAllPesticideTables(previewDoc) {
    const nodes = previewDoc.querySelectorAll(".pesticide-table-preview");
    if (!nodes.length) return;

    for (const node of nodes) {
      if (node.getAttribute("data-loaded") === "1") continue;

      const g = node.getAttribute("data-guideline-id") || "";
      const p = node.getAttribute("data-pest-id") || "";
      const s = node.getAttribute("data-site-id") || "";

      try {
        const url =
          `${API_BASE_URL}/pesticide-table?guidelineId=${encodeURIComponent(g)}&pestId=${encodeURIComponent(p)}&siteId=${encodeURIComponent(s)}`;

        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const html = await res.text();
        node.innerHTML = html;
        node.setAttribute("data-loaded", "1");
      } catch (err) {
        // POC fallback (since endpoint isn't real yet)
        node.innerHTML = fakeTableHtml(g, p, s);
        node.setAttribute("data-loaded", "1");
      }
    }
  }

  // ============================================================
  // 4) HELPERS
  // ============================================================
  function fakeTableHtml(g, p, s) {
    return `
      <div style="font-weight:600; margin-bottom:0.5rem;">
        (POC) Rendered table for Guideline ${escapeHtml(g)}, Pest ${escapeHtml(p)}, Site ${escapeHtml(s)}
      </div>

      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc; padding:6px;">Product</th>
            <th style="border:1px solid #ccc; padding:6px;">Active Ingredient</th>
            <th style="border:1px solid #ccc; padding:6px;">Rate</th>
            <th style="border:1px solid #ccc; padding:6px;">REI</th>
            <th style="border:1px solid #ccc; padding:6px;">PHI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #ccc; padding:6px;">Example Product A</td>
            <td style="border:1px solid #ccc; padding:6px;">Example AI</td>
            <td style="border:1px solid #ccc; padding:6px;">1.0–2.0 qt/ac</td>
            <td style="border:1px solid #ccc; padding:6px;">12 hr</td>
            <td style="border:1px solid #ccc; padding:6px;">7 d</td>
          </tr>
          <tr>
            <td style="border:1px solid #ccc; padding:6px;">Example Product B</td>
            <td style="border:1px solid #ccc; padding:6px;">Example AI</td>
            <td style="border:1px solid #ccc; padding:6px;">0.5 lb/ac</td>
            <td style="border:1px solid #ccc; padding:6px;">24 hr</td>
            <td style="border:1px solid #ccc; padding:6px;">14 d</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:0.5rem; font-size:0.9em; opacity:0.8;">
        API fetch failed (expected for now). Showing a local fake table as proof of concept.
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
