// admin/editor-components.js
(function () {
  if (!window.CMS) {
    console.error("Decap CMS not loaded yet. Make sure this script is after decap-cms.js");
    return;
  }

  window.CMS.registerEditorComponent({
    id: "callout",
    label: "Callout",
    fields: [
      { name: "type", label: "Type", widget: "select", options: ["note", "warning", "tip"] },
      { name: "title", label: "Title", widget: "string" },
      { name: "body", label: "Body", widget: "text" }
    ],

    // Detect an existing block so the component can be edited later
    pattern: /^:::callout-(note|warning|tip)\n## (.*?)\n([\s\S]*?)\n:::/m,

    fromBlock: function (match) {
      return {
        type: match[1],
        title: match[2],
        body: match[3].trim()
      };
    },

    toBlock: function (data) {
      return `:::callout-${data.type}\n## ${data.title}\n${data.body}\n:::`;
    },

    // Optional: what shows in the editor as a “preview” of the block
    toPreview: function (data) {
      return `Callout (${data.type}): ${data.title}`;
    }
  });
})();
