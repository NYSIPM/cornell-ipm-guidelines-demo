(function () {
  if (!window.CMS) return;

  const API_BASE_URL = "https://localhost:7144/api/Treatments/search";

  const shortcodeLinePattern =
    /^\s*\{\{[<%]\s*pesticide-table\b[^}]*[>%]\}\}\s*$/m;

  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Pesticide Table (DB)",
    fields: [
      { name: "guidelineId", label: "Guideline ID", widget: "string", required: false },
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
      return `{{% pesticide-table guidelineId="${g}" pestId="${p}" siteId="${s}" %}}`;
    },

    toPreview: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();

      return `
        <div class="pesticide-table-preview"
             data-guideline-id="${escapeHtml(g)}"
             data-pest-id="${escapeHtml(p)}"
             data-site-id="${escapeHtml(s)}">
          Loading pesticide table...
        </div>
      `;
    }
  });

  startPreviewHydrationLoop();

  function startPreviewHydrationLoop() {
    setInterval(async () => {
      const previewDoc = getPreviewDocument();
      if (!previewDoc) return;
      await hydrateAllPesticideTables(previewDoc);
    }, 800);
  }

  function getPreviewDocument() {
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

      const guidelineId = node.getAttribute("data-guideline-id") || "";
      const pestId = node.getAttribute("data-pest-id") || "";
      const siteId = node.getAttribute("data-site-id") || "";

      try {
        const url = new URL(API_BASE_URL);
        url.searchParams.set("pestId", pestId);
        url.searchParams.set("siteId", siteId);

        console.log("Fetching pesticide JSON:", url.toString());

        const res = await fetch(url.toString(), { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("Pesticide JSON:", json);

        const html = window.PesticideTableBuilder.renderTable(json);
        node.innerHTML = html;
        node.setAttribute("data-loaded", "1");
      } catch (err) {
        console.error("Pesticide preview failed:", err);

        node.innerHTML = `
          <div><strong>Preview failed.</strong></div>
          <div>GuidelineId: ${escapeHtml(guidelineId)}</div>
          <div>PestId: ${escapeHtml(pestId)}</div>
          <div>SiteId: ${escapeHtml(siteId)}</div>
          <div style="margin-top:0.5rem; color:#b00020;">
            ${escapeHtml(err?.message || String(err))}
          </div>
        `;
        node.setAttribute("data-loaded", "1");
      }
    }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();