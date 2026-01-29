(function () {
  if (!window.CMS) return;

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  CMS.registerEditorComponent({
    id: "api-text",
    label: "API Insert (Text)",
    fields: [
      {
        name: "endpoint",
        label: "API Endpoint URL",
        widget: "string",
        default: "https://cropandpestguides.cce.cornell.edu/NewGuidelinesTableImportTest/api/example",
      },
      {
        name: "style",
        label: "Insert style",
        widget: "select",
        options: ["callout", "paragraph", "raw-html"],
        default: "callout",
      },
    ],

    // keep it simple: insert only, no round-trip editing
    pattern: /^$a/,
    fromBlock: () => ({}),

    toBlock: async (data) => {
      const endpoint = (data.endpoint || "").trim();
      const style = data.style || "callout";

      if (!endpoint) {
        return `::: {.callout-warning}\nNo endpoint provided.\n:::\n`;
      }

      try {
        const res = await fetch(endpoint, { method: "GET" });

        if (!res.ok) {
          return `::: {.callout-warning}\nAPI error: ${res.status} ${res.statusText}\n:::\n`;
        }

        const text = (await res.text()).trim();

        if (style === "paragraph") {
          // plain markdown paragraph
          return `${text}\n`;
        }

        if (style === "raw-html") {
          // raw HTML fenced div (safe-escaped)
          return `::: {.raw-html}\n<div class="api-snippet">${escapeHtml(text)}</div>\n:::\n`;
        }

        // default: quarto callout (markdown-safe)
        return `::: {.callout-note}\n${text}\n:::\n`;
      } catch (err) {
        return `::: {.callout-warning}\nFetch failed: ${String(err?.message || err)}\n:::\n`;
      }
    },
  });
})();
