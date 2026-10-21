(function (window) {
  "use strict";

  const CMS = window.CMS;
  const summary = window.PesticideSummary;

  if (!CMS || !summary?.renderTable) {
    console.error("[PesticideSummary] CMS, core, and renderer scripts are required before preview startup.");
    return;
  }

  //Bump ?v= when the stylesheet changes so the CMS preview doesn't keep an old cached copy
  const stylesheetUrl = "/assets/css/pesticide-summary-public.css?v=4";

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

  // Column sort chosen for each table, keyed the same way. Kept here (not on the node)
  // because the preview rebuilds the node, which would otherwise reset the sort.
  const summarySortByKey = new Map();

  function renderSortedTable(node, loadKey) {
    const cached = summaryRenderCache.get(loadKey);
    if (!cached) return;

    node.innerHTML = cached.titleHtml + summary.renderTable(cached.json, summarySortByKey.get(loadKey) || null);
  }

  // Header clicks: asc -> desc -> back to the API's order (same as the public summary)
  function wireSortEvents(node) {
    if (node.__pesticideSummarySortBound) return;
    node.__pesticideSummarySortBound = true;

    node.addEventListener("click", function (event) {
      const button = event.target.closest?.(".pesticide-summary__sort-button");
      if (!button) return;

      const loadKey = node.getAttribute("data-load-key");
      const key = button.dataset.sortKey;

      summarySortByKey.set(loadKey, summary.getNextSort(summarySortByKey.get(loadKey), key));
      renderSortedTable(node, loadKey);

      node.querySelector(`.pesticide-summary__sort-button[data-sort-key="${key}"]`)?.focus();
    });
  }

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
      renderSortedTable(node, loadKey);
      wireSortEvents(node);
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

      summaryRenderCache.set(loadKey, { titleHtml, json });
      renderSortedTable(node, loadKey);
      wireSortEvents(node);
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
