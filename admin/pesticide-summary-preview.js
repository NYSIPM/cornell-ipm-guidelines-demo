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

  async function safelyReadResponseText(response) {
    try {
      return await response.text();
    } catch (error) {
      console.warn("[PesticideSummary] Could not read error response:", error);
      return "";
    }
  }

  async function hydrateNode(node) {
    const siteId = String(node.getAttribute("data-site-id") || "").trim();
    const summaryType = summary.normalizeSummaryType(
      node.getAttribute("data-summary-type")
    );
    const loadKey = `${siteId}|${summaryType}`;

    if (node.getAttribute("data-load-key") === loadKey) return;
    node.setAttribute("data-load-key", loadKey);

    if (!siteId || !summaryType) {
      node.innerHTML = summary.renderMessage(
        "Select both a Site ID and a pesticide summary type."
      );
      return;
    }

    try {
      node.innerHTML = summary.renderMessage("Loading pesticide summary...");

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
          errorBody ? `HTTP ${response.status} — ${errorBody}` : `HTTP ${response.status}`
        );
      }

      const json = await response.json();
      node.__pesticideSummaryJson = json;
      node.innerHTML = summary.renderTable(json);
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
