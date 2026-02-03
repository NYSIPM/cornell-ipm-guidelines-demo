(function () {
  if (!window.CMS) return;

  // ============================================================
  // 1) CONFIG
  // ============================================================
  // Proof-of-concept placeholder. Change this when your endpoint exists.
  // Example later:
  // const API_BASE_URL = "https://your-api-host.example.com";
  const API_BASE_URL = "https://example.invalid";

  // ============================================================
  // 2) EDITOR COMPONENT: Inserts a pesticide-table block
  // ============================================================
  const pesticideBlockPattern =
    /^:::\s*\{\.pesticide-table\s+guideline-id="([^"]+)"\s+pest-id="([^"]+)"\s+site-id="([^"]+)"\}\s*\n:::\s*$/m;

  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Pesticide Table (DB)",
    fields: [
      { name: "guidelineId", label: "Guideline ID", widget: "string" },
      { name: "pestId", label: "Pest ID", widget: "string" },
      { name: "siteId", label: "Site ID", widget: "string" }
    ],
    pattern: pesticideBlockPattern,
    fromBlock: (match) => ({
      guidelineId: match?.[1] || "",
      pestId: match?.[2] || "",
      siteId: match?.[3] || ""
    }),
    toBlock: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();
      return `::: {.pesticide-table guideline-id="${g}" pest-id="${p}" site-id="${s}"}\n:::\n`;
    },

    // This HTML appears in the Decap preview pane before hydration runs.
    toPreview: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();

      // We output a placeholder div that our preview hook will "hydrate"
      // by fetching from the API and swapping in HTML.
      return `
        <div class="pesticide-table-preview"
             data-guideline-id="${escapeHtml(g)}"
             data-pest-id="${escapeHtml(p)}"
             data-site-id="${escapeHtml(s)}"
             data-loaded="0"
             style="border:1px dashed #999; padding: 0.75rem; margin: 0.75rem 0;">
          <div style="font-weight:600; margin-bottom:0.5rem;">Pesticide Table</div>
          <div style="opacity:0.8;">Loading table for Guideline ${escapeHtml(g)}, Pest ${escapeHtml(p)}, Site ${escapeHtml(s)}…</div>
        </div>
      `;
    }
  });

  // ============================================================
  // 3) PREVIEW HYDRATION: runs in preview pane to fetch + replace
  // ============================================================
  // This approach is simple: on a timer, look for placeholders and hydrate them.
  // It's robust even when Decap re-renders the preview often.
  function startPreviewHydrationLoop() {
    // The preview is rendered inside an iframe. We need to access its document.
    // Decap uses a preview iframe with class "PreviewPaneFrame" in many setups.
    // We'll try to locate it defensively.
    const intervalMs = 800;

    setInterval(async () => {
      const iframe = document.querySelector("iframe[class*='PreviewPaneFrame'], iframe");
      if (!iframe) return;

      const previewDoc = iframe.contentDocument;
      if (!previewDoc) return;

      await hydrateAllPesticideTables(previewDoc);
    }, intervalMs);
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
        // 1) Try the (future) API call
        // Later you might do: `${API_BASE_URL}/api/pesticide-table?...`
        const url =
          `${API_BASE_URL}/pesticide-table?guidelineId=${encodeURIComponent(g)}&pestId=${encodeURIComponent(p)}&siteId=${encodeURIComponent(s)}`;

        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const html = await res.text();
        node.innerHTML = html;
        node.setAttribute("data-loaded", "1");
      } catch (err) {
        // 2) Proof-of-concept fallback: render a fake table so you can verify the wiring works now
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
            <th style="border:1px solid #ccc; padding:6px;">AI</th>
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

  // Start the hydration loop once CMS exists.
  startPreviewHydrationLoop();
})();
