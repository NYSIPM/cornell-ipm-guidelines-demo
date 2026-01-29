(function () {
  if (!window.CMS) return;

  // Match ONLY raw HTML blocks that contain a table
  // ```{=html}
  // <table>...</table>
  // ```
  const pattern = /^```{=html}\s*\n([\s\S]*?<table[\s\S]*?<\/table>[\s\S]*?)\n```\s*$/m;

  CMS.registerEditorComponent({
    id: "html-table",
    label: "HTML Table",
    fields: [{ name: "html", label: "Table", widget: "tinymce-table" }],
    pattern,
    fromBlock: (m) => ({ html: (m?.[1] || "").trim() }),
    toBlock: (d) => `\`\`\`{=html}\n${(d.html || "").trim()}\n\`\`\``,
  });
})();
