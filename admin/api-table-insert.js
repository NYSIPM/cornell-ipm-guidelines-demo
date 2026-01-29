(function () {
  if (!window.CMS) return;

  // Matches our block and captures endpoint + cached content
  const pattern =
    /^:::\s*\{\.api-insert\s+endpoint="([^"]+)"\}\s*\n<!-- api-cache -->\n([\s\S]*?)\n<!-- \/api-cache -->\n:::\s*$/m;

  function escapeForAttr(str) {
    return String(str).replaceAll('"', "&quot;");
  }

  CMS.registerEditorComponent({
    id: "api-text",
    label: "API Insert",
    fields: [
      {
        name: "endpoint",
        label: "API Endpoint URL",
        widget: "string",
        default:
          "https://cropandpestguides.cce.cornell.edu/NewGuidelinesTableImportTest/api/example",
      },
      {
        name: "cached",
        label: "Cached content (optional)",
        widget: "text",
        required: false,
        hint:
          "Paste the API result here if you want the content stored in the document. (See notes below.)",
      },
    ],

    pattern,

    fromBlock: (match) => ({
      endpoint: match?.[1] || "",
      cached: (match?.[2] || "").trim(),
    }),

    // IMPORTANT: must be synchronous (NOT async)
    toBlock: (data) => {
      const endpoint = (data.endpoint || "").trim();
      const cached = (data.cached || "").trim();

      const safeEndpoint = escapeForAttr(endpoint);

      return (
        `::: {.api-insert endpoint="${safeEndpoint}"}\n` +
        `<!-- api-cache -->\n` +
        `${cached}\n` +
        `<!-- /api-cache -->\n` +
        `:::\n`
      );
    },
  });
})();
