(function () {
  if (!window.CMS) return;

  const API_BASE_URL = "https://localhost:7144/api/Treatments/search";

  CMS.registerPreviewStyle("/assets/css/pesticide-table-editor.css");

  //const shortcodeLinePattern = /^\s*\{\{[<%]\s*pesticide-table\b[^}]*[>%]\}\}\s*$/m;
  const shortcodeLinePattern =
  /^\s*\{\{(?:<|%)\s*pesticide-table\b[\s\S]*?(?:>|%)\}\}\s*$/m;

  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Pesticide Table (DB)",
    fields: [
      { name: "guidelineId", label: "Guideline ID", widget: "string", required: true },
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
        url.searchParams.set("guidelineId", guidelineId);
        url.searchParams.set("pestId", pestId);
        url.searchParams.set("siteId", siteId);

        console.log("Fetching pesticide JSON:", url.toString());

        const res = await fetch(url.toString(), { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("Pesticide JSON:", json);

        node.__pesticideRows = window.PesticideTableBuilder.buildRows(json);
        node.__pesticideJson = json;

        const html = window.PesticideTableBuilder.renderTable(json);
        node.innerHTML = html;

        window.PesticideTableBuilder.wireTableEvents(node);

        console.log("Pesticide table events wired");

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

  //Get the API Guideline Options.
  async function fetchGuidelineOptions() {
    const url = "https://localhost:7144/api/Treatments/guideline-options";

    console.log("Fetching guideline options:", url);

    const response = await fetch(url, { credentials: "omit" });

    if (!response.ok) {
      throw new Error(`Guideline options fetch failed: HTTP ${response.status}`);
    }

    const json = await response.json();

    console.log("Guideline options JSON:", json);

    return json;
  }
  
  async function testGuidelineOptionsFetch() {
    try {
      const results = await fetchGuidelineOptions();

      console.log("Guideline options loaded successfully.");
      console.log("Count:", Array.isArray(results) ? results.length : 0);

      if (Array.isArray(results)) {
        results.forEach((guideline, index) => {
          console.log(`Guideline ${index + 1}:`, {
            guidelineId: guideline.guidelineId,
            name: guideline.name,
            shortName: guideline.shortName,
            pestCount: Array.isArray(guideline.pests) ? guideline.pests.length : 0,
            siteCount: Array.isArray(guideline.sites) ? guideline.sites.length : 0
          });
        });
      }

      return results;
    } catch (err) {
      console.error("Failed to load guideline options:", err);
      return null;
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

  // 👇 ADD THIS HERE
  testGuidelineOptionsFetch();

})();