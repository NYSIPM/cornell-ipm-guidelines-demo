(function () {
  if (!window.CMS) return;

  const pattern = /^:::html-table\s*\n([\s\S]*?)\n:::\s*$/m;

  CMS.registerEditorComponent({
    id: "html-table",
    label: "HTML Table",
    fields: [
      { name: "html", label: "Table", widget: "tinymce-table" }
    ],
    pattern,
    fromBlock: (m) => ({ html: m?.[1] || "" }),
    toBlock: (d) => `:::html-table {.raw-html}\n${(d.html || "").trim()}\n:::`
  });
})();
