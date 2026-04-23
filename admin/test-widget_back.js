// admin/test-widget.js

CMS.registerEditorComponent({
  id: "test-widget",
  label: "Test Widget",
  fields: [
    { name: "title", label: "Title", widget: "string" },
    { name: "content", label: "Content", widget: "text" }
  ],

  // How it appears in markdown
  pattern: /{{< test-widget title="(.*?)" content="(.*?)" >}}/,

  fromBlock: function(match) {
    return {
      title: match[1],
      content: match[2]
    };
  },

  toBlock: function(data) {
    return `{{< test-widget title="${data.title}" content="${data.content}" >}}`;
  },

  // How it previews in the editor
  toPreview: function(data) {
    return `
      <div style="border: 2px dashed #888; padding: 10px;">
        <strong>Test Widget</strong><br/>
        <h4>${data.title || "No Title"}</h4>
        <p>${data.content || "No Content"}</p>
      </div>
    `;
  }
});