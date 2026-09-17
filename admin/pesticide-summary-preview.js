(function (window) {
  "use strict";

  const CMS = window.CMS;
  const summary = window.PesticideSummary;

  if (!CMS || !summary?.renderTable) {
    console.error("[PesticideSummary] CMS, core, and renderer scripts are required before preview startup.");
    return;
  }

  const stylesheetUrl = "/assets/css/pesticide-summary.css?v=2";

  if (typeof CMS.registerPreviewStyle === "function") {
    CMS.registerPreviewStyle(stylesheetUrl);

    console.log(
      "[PesticideSummary] Registered preview stylesheet:",
      stylesheetUrl
    );
  } else {
    console.warn(
      "[PesticideSummary] CMS.registerPreviewStyle is unavailable."
    );
  }

  // Keyed by "title|siteId|summaryType". The preview pane rebuilds this node
  // from scratch on every keystroke elsewhere in the document; without this
  // cache we'd flash back to "Loading..." and re-fetch every time, which is
  // what was resetting the iframe's scroll position.
  const summaryRenderCache = new Map();

  async function safelyReadResponseText(response) {
    try {
      return await response.text();
    } catch (error) {
      console.warn("[PesticideSummary] Could not read error response:", error);
      return "";
    }
  }

  function renderTitle(title) {
    if (!title) return "";

    return `
      <div class="pesticide-summary-title">
        ${summary.escapeHtml(title)}
      </div>
    `;
  }

  async function hydrateNode(node) {
    const tableTitle = String(
      node.getAttribute("data-table-title") || ""
    ).trim();

    const siteId = String(
      node.getAttribute("data-site-id") || ""
    ).trim();

    const summaryType = summary.normalizeSummaryType(
      node.getAttribute("data-summary-type")
    );

    const loadKey = `${tableTitle}|${siteId}|${summaryType}`;

    if (node.getAttribute("data-load-key") === loadKey) return;

    if (!siteId || !summaryType) {
      node.setAttribute("data-load-key", loadKey);
      node.innerHTML = summary.renderMessage(
        "Select both a Site ID and a pesticide summary type."
      );
      return;
    }

    const cached = summaryRenderCache.get(loadKey);

    if (cached) {
      node.setAttribute("data-load-key", loadKey);
      node.__pesticideSummaryJson = cached.json;
      node.innerHTML = cached.titleHtml + cached.tableHtml;
      return;
    }

    node.setAttribute("data-load-key", loadKey);

    try {
      node.innerHTML = summary.renderMessage(
        "Loading pesticide summary..."
      );

      const url = summary.getApiUrl(siteId, summaryType);
      console.log("[PesticideSummary] Fetching:", url);

      const authHeaders = await summary.getAuthenticationHeaders();

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeaders
        }
      });

      if (!response.ok) {
        const errorBody = await safelyReadResponseText(response);

        throw new Error(
          errorBody
            ? `HTTP ${response.status} — ${errorBody}`
            : `HTTP ${response.status}`
        );
      }

      const json = await response.json();
      node.__pesticideSummaryJson = json;

      const titleHtml = renderTitle(tableTitle);
      const tableHtml = summary.renderTable(json);

      node.innerHTML = titleHtml + tableHtml;

      summaryRenderCache.set(loadKey, { titleHtml, tableHtml, json });
    } catch (error) {
      console.error("[PesticideSummary] Preview failed:", error);
      node.removeAttribute("data-load-key");

      node.innerHTML = summary.renderErrorMessage({
        siteId,
        summaryType,
        message: error?.message || String(error)
      });
    }
  }

  async function hydrateAll() {
    const previewDocument = summary.getPreviewDocument();
    if (!previewDocument) return;

    const nodes = previewDocument.querySelectorAll(".pesticide-summary-preview");
    for (const node of nodes) {
      await hydrateNode(node);
    }
  }

  window.setInterval(hydrateAll, 800);
  console.log("[PesticideSummary] Preview hydration started.");
})(window);
