(function (window) {
  "use strict";

  const CMS = window.CMS;
  const summary = window.PesticideSummary;

  if (!CMS || !summary) {
    console.error(
      "[PesticideSummary] CMS and core script are required before editor registration."
    );
    return;
  }

  function escapeShortcodeAttribute(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
  }

  CMS.registerEditorComponent({
    id: "pesticide-summary",
    label: "Pesticide Summary Table",

    fields: [
      {
        name: "summarySelector",
        label: "Pesticide Summary Options",
        widget: "pesticide_summary_selector",
        required: true
      }
    ],

    pattern: summary.SHORTCODE_PATTERN,

    fromBlock(match) {
      const block = match?.[0] || "";

      return {
        summarySelector: {
          title: summary.getAttributeFromBlock(block, "title"),
          siteId: summary.getAttributeFromBlock(block, "siteId"),
          type: summary.normalizeSummaryType(
            summary.getAttributeFromBlock(block, "type")
          )
        }
      };
    },

    toBlock(data) {
      const selector =
        summary.normalizeWidgetValue(data.summarySelector);

      const title = String(selector.title || "").trim();
      const siteId = String(selector.siteId || "").trim();
      const summaryType =
        summary.normalizeSummaryType(selector.type);

      return `{{< pesticide-summary title="${escapeShortcodeAttribute(title)}" siteId="${siteId}" type="${summaryType}" >}}`;
    },

    toPreview(data) {
      const selector =
        summary.normalizeWidgetValue(data.summarySelector);

      const title = String(selector.title || "").trim();
      const siteId = String(selector.siteId || "").trim();
      const summaryType =
        summary.normalizeSummaryType(selector.type);

      return `
        <div
          class="pesticide-summary-preview"
          data-table-title="${summary.escapeHtml(title)}"
          data-site-id="${summary.escapeHtml(siteId)}"
          data-summary-type="${summary.escapeHtml(summaryType)}">
          Loading pesticide summary...
        </div>
      `;
    }
  });

  console.log("[PesticideSummary] Registered editor component.");
})(window);