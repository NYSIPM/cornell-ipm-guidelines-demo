(function () {
  if (!window.CMS) return;

  // More tolerant pattern (handles \r\n and extra whitespace)
  const pattern =
    /^:::\s*\{\.api-insert\s+endpoint="([^"]+)"\}\s*\r?\n\s*<!-- api-cache -->\s*\r?\n([\s\S]*?)\r?\n\s*<!-- \/api-cache -->\s*\r?\n:::\s*$/m;

  function escapeForAttr(str) {
    return String(str).replaceAll('"', "&quot;");
  }

  // A custom control for the "cached" field that includes a Fetch button
  class ApiFetchTextareaControl extends React.Component {
    constructor(props) {
      super(props);
      this.state = { loading: false, error: "" };
      this.onFetch = this.onFetch.bind(this);
      this.onChange = this.onChange.bind(this);
    }

    onChange(e) {
      this.props.onChange(e.target.value);
    }

    async onFetch() {
      // Read endpoint from the field's parent data (Decap passes it on props in a few different ways)
      // We'll try multiple likely places for compatibility.
      const entryData =
        (this.props?.forID && this.props?.getIn && this.props.getIn(["entry", "data"])) ||
        null;

      // Fallback: Decap usually provides other field values via props.field / props.value only.
      // We'll also allow endpoint to be typed into the placeholder directly if needed.
      const endpoint =
        (this.props?.field?.get?.("endpointValue")) || // unlikely
        (this.props?.endpointValue) ||                 // unlikely
        (this.props?.apiEndpoint) ||                   // unlikely
        (entryData && entryData.get && entryData.get("bodyEndpoint")) || // unlikely
        null;

      // Practical approach: parse endpoint from the current editor component block if present is hard,
      // so we instead rely on the user-provided endpoint in the component modal.
      // Decap provides ALL current field values to a field control in `this.props.data` in many builds.
      const modalData = this.props?.data || {};
      const url = (modalData.endpoint || "").trim();

      if (!url) {
        this.setState({ error: "No endpoint provided.", loading: false });
        return;
      }

      this.setState({ loading: true, error: "" });

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = (await res.text()).trim();
        this.props.onChange(text);
        this.setState({ loading: false, error: "" });
      } catch (e) {
        this.setState({ loading: false, error: String(e.message || e) });
      }
    }

    render() {
      const { value } = this.props;
      const { loading, error } = this.state;

      return React.createElement(
        "div",
        { style: { display: "grid", gap: "0.5rem" } },
        React.createElement("textarea", {
          value: value || "",
          onChange: this.onChange,
          rows: 10,
          style: { width: "100%", fontFamily: "monospace" },
          placeholder: "Cached API content will go here…",
        }),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
          React.createElement(
            "button",
            {
              type: "button",
              onClick: this.onFetch,
              disabled: loading,
            },
            loading ? "Fetching…" : "Fetch from API"
          ),
          error
            ? React.createElement(
                "span",
                { style: { color: "crimson", fontSize: "0.9em" } },
                error
              )
            : null
        )
      );
    }
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
        label: "Cached content",
        widget: "text",
        required: false,
        // This is the important part: replace the default control with ours
        control: ApiFetchTextareaControl,
      },
    ],

    pattern,

    fromBlock: (match) => ({
      endpoint: match?.[1] || "",
      cached: (match?.[2] || "").trim(),
    }),

    toBlock: (data) => {
      const endpoint = (data.endpoint || "").trim();
      const cached = (data.cached || "").trim();

      const safeEndpoint = escapeForAttr(endpoint);

      return (
        `::: {.api-insert endpoint="${safeEndpoint}"}\n` +
        `<!-- api-cache -->\n` +
        `${cached || CMS.registerEditorComponent }\n` +
        `<!-- /api-cache -->\n` +
        `:::\n`
      );
    },
  });
})();
