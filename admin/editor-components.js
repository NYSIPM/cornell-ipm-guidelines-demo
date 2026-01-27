(function () {
  // Ensure Decap CMS exists
  if (!window.CMS) {
    console.error(
      "Decap CMS not loaded yet. Make sure editor-components.js is included AFTER decap-cms.js"
    );
    return;
  }

  // Helper: very light guard so the block is likely an HTML table
  function normalizeTableHtml(html) {
    const trimmed = (html || "").trim();
    return trimmed;
  }

  window.CMS.registerEditorComponent({
    id: "html-table",
    label: "HTML Table",

    fields: [
      {
        name: "html",
        label: "Table",
        widget: "tinymce-table",
        hint:
          "Paste a full <table>...</table> here. Rowspan/colspan are supported. The preview below shows how it will render."
      }
    ],

    // Match a Quarto fenced div block:
    // :::html-table
    // <table>...</table>
    // :::
    //
    // Non-greedy capture between the opening and closing fence.
    pattern: /^:::html-table\s*\n([\s\S]*?)\n:::\s*$/m,

    fromBlock: function (match) {
      return {
        html: (match && match[1] ? match[1].trim() : "")
      };
    },

    toBlock: function (data) {
      const html = normalizeTableHtml(data.html);

      // Keep the output consistent and easy to parse
      return `:::html-table\n${html}\n:::`;
    },

    // Show a nice preview "card" in the editor component UI
    // NOTE: This will render raw HTML in the preview.
    // In your workflow, that's desirable (table preview),
    // but only allow trusted editors to use it.
    toPreview: function (data) {
      const html = normalizeTableHtml(data.html);

      // Basic fallback if empty
      if (!html) return "<em>No table HTML provided.</em>";

      // Wrap preview so you can style it later if needed
      return `
        <div style="padding: .5rem; border: 1px solid #ddd; border-radius: 6px;">
          <div style="font-size: 0.9rem; margin-bottom: .5rem; opacity: .8;">
            Preview (renders your HTML)
          </div>
          <div class="decap-html-table-preview" style="overflow-x:auto;">
            ${html}
          </div>
        </div>
      `;
    }
  });
})();
