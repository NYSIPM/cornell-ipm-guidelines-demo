(function (window) {
  "use strict";

  const CMS = window.CMS;
  const summary = window.PesticideSummary;

  if (!CMS || !summary) {
    console.error("[PesticideSummary] CMS and core script are required before editor registration.");
    return;
  }

  CMS.registerEditorComponent({
    id: "pesticide-summary",
    label: "Pesticide Summary Table",
    fields: [
      {
        name: "summarySelector",
        label: "Pesticide Summary",
        widget: "pesticide_summary_selector",
        required: true
      }
    ],
    pattern: summary.SHORTCODE_PATTERN,

    fromBlock(match) {
      const block = match?.[0] || "";
      return {
        summarySelector: {
          siteId: summary.getAttributeFromBlock(block, "siteId"),
          type: summary.normalizeSummaryType(
            summary.getAttributeFromBlock(block, "type")
          )
        }
      };
    },

    toBlock(data) {
      const selector = data.summarySelector || {};
      const siteId = String(selector.siteId || "").trim();
      const summaryType = summary.normalizeSummaryType(selector.type);
      return `{{< pesticide-summary siteId="${siteId}" type="${summaryType}" >}}`;
    },

    toPreview(data) {
      const selector = data.summarySelector || {};
      const siteId = String(selector.siteId || "").trim();
      const summaryType = summary.normalizeSummaryType(selector.type);

      return `
        <div
          class="pesticide-summary-preview"
          data-site-id="${summary.escapeHtml(siteId)}"
          data-summary-type="${summary.escapeHtml(summaryType)}">
          Loading pesticide summary...
        </div>
      `;
    }
  });

  console.log("[PesticideSummary] Registered editor component.");
})(window);
