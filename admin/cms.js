(function () {
  if (!window.CMS) return;

  const pattern = /^:::\s*\{\.pesticide-table\s+guideline-id="([^"]+)"\s+pest-id="([^"]+)"\s+site-id="([^"]+)"\}\s*\n:::\s*$/m;

  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Pesticide Table (DB)",
    fields: [
      { name: "guidelineId", label: "Guideline ID", widget: "string" },
      { name: "pestId", label: "Pest ID", widget: "string" },
      { name: "siteId", label: "Site ID", widget: "string" }
    ],
    pattern,
    fromBlock: (match) => ({
      guidelineId: match?.[1] || "",
      pestId: match?.[2] || "",
      siteId: match?.[3] || ""
    }),
    toBlock: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();
      return `::: {.pesticide-table guideline-id="${g}" pest-id="${p}" site-id="${s}"}\n:::\n`;
    },
    // Preview will get handled in the preview template step.
    toPreview: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();
      return `<div class="pesticide-table-preview" data-guideline-id="${g}" data-pest-id="${p}" data-site-id="${s}">
        Loading pesticide table…
      </div>`;
    }
  });
})();