(function () {
  if (!window.CMS) {
    console.error("Decap CMS not loaded yet.");
    return;
  }

  function normalize(html) {
    return (html || "").trim();
  }

  const pattern = /^:::html-table\s*\n([\s\S]*?)\n:::\s*$/m;

  // 1) SOURCE editor (textarea)
  window.CMS.registerEditorComponent({
    id: "html-table-source",
    label: "HTML Table (Source)",
    fields: [
      {
        name: "html",
        label: "Table HTML",
        widget: "text",
        hint: "Edit raw <table>...</table> HTML."
      }
    ],
    pattern,
    fromBlock: (match) => ({ html: match?.[1]?.trim() || "" }),
    toBlock: (data) => `:::html-table\n${normalize(data.html)}\n:::`,
    toPreview: (data) => {
      const html = normalize(data.html);
      if (!html) return "<em>No table HTML provided.</em>";
      return `<div style="overflow-x:auto;">${html}</div>`;
    }
  });

  // 2) VISUAL editor (TinyMCE widget)
  window.CMS.registerEditorComponent({
    id: "html-table-visual",
    label: "HTML Table (Visual)",
    fields: [
      {
        name: "html",
        label: "Table",
        widget: "tinymce-table",
        hint: "Edit visually (rows/cols, merge/split). Saves HTML."
      }
    ],
    pattern,
    fromBlock: (match) => ({ html: match?.[1]?.trim() || "" }),
    toBlock: (data) => `:::html-table\n${normalize(data.html)}\n:::`,
    toPreview: (data) => {
      const html = normalize(data.html);
      if (!html) return "<em>No table HTML provided.</em>";
      return `<div style="overflow-x:auto;">${html}</div>`;
    }
  });
})();
