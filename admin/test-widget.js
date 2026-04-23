// admin/test-widget.js

(async function () {
  const API_URL = "https://localhost:7144/api/Treatments/guideline-options";

  async function loadGuidelineOptions() {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();

      return (data || []).map(g => ({
        label: g.displayName || g.name || `Guideline ${g.guidelineId}`,
        value: String(g.guidelineId)
      }));
    } catch (error) {
      console.error("Failed to load guideline options:", error);
      return [{ label: "Unable to load guidelines", value: "" }];
    }
  }

  const guidelineOptions = await loadGuidelineOptions();

  CMS.registerEditorComponent({
    id: "test-widget",
    label: "Test Widget",

    fields: [
      {
        name: "guidelineId",
        label: "Guideline",
        widget: "select",
        options: guidelineOptions
      },
      {
        name: "pestId",
        label: "Pest ID",
        widget: "string"
      },
      {
        name: "siteId",
        label: "Site ID",
        widget: "string"
      }
    ],

    // UPDATED pattern
    pattern: /{{< test-widget(?:\s+guidelineId="(.*?)")?(?:\s+pestId="(.*?)")?(?:\s+siteId="(.*?)")?\s*>}}/,

    fromBlock: function (match) {
      return {
        guidelineId: match[1] || "",
        pestId: match[2] || "",
        siteId: match[3] || ""
      };
    },

    toBlock: function (data) {
      return `{{< test-widget guidelineId="${data.guidelineId || ""}" pestId="${data.pestId || ""}" siteId="${data.siteId || ""}" >}}`;
    },

    toPreview: function (data) {
      const selectedGuideline =
        guidelineOptions.find(x => x.value === String(data.guidelineId))?.label ||
        "No Guideline Selected";

      return `
        <div style="border: 2px dashed #888; padding: 10px;">
          <strong>Test Widget</strong><br/>
          <div><strong>Guideline:</strong> ${selectedGuideline}</div>
          <div><strong>Pest ID:</strong> ${data.pestId || "-"}</div>
          <div><strong>Site ID:</strong> ${data.siteId || "-"}</div>
        </div>
      `;
    }
  });
})();