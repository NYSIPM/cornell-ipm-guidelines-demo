(function () {
  if (!window.CMS) return;

  // Utility: build the block we want to inject into body
  function buildApiBlock(endpoint, cached) {
    return (
      `::: {.api-insert endpoint="${endpoint}"}\n` +
      `<!-- api-cache -->\n` +
      `${cached}\n` +
      `<!-- /api-cache -->\n` +
      `:::\n`
    );
  }

  // Utility: replace an existing api-insert block with same endpoint, else append
  function upsertApiBlock(body, endpoint, cached) {
    const safeEndpoint = endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // tolerant regex: handles \n or \r\n and whitespace
    const re = new RegExp(
      String.raw`:::\s*\{\.api-insert\s+endpoint="${safeEndpoint}"\}\s*\r?\n\s*<!-- api-cache -->\s*\r?\n[\s\S]*?\r?\n\s*<!-- \/api-cache -->\s*\r?\n:::\s*`,
      "g"
    );

    const block = buildApiBlock(endpoint, cached);

    if (re.test(body)) {
      return body.replace(re, block);
    }

    // append with spacing
    const spacer = body.trim().length ? "\n\n" : "";
    return body + spacer + block;
  }

  // The React control for our widget
  class ApiFetchToolControl extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        endpoint:
          props.value?.endpoint ||
          "https://cropandpestguides.cce.cornell.edu/NewGuidelinesTableImportTest/api/example",
        status: "",
        preview: props.value?.preview || "",
      };

      this.onEndpointChange = this.onEndpointChange.bind(this);
      this.fetchAndInsert = this.fetchAndInsert.bind(this);
      this.saveValue = this.saveValue.bind(this);
    }

    saveValue(next) {
      // Persist widget value to entry data (Decap stores this field’s value)
      this.props.onChange(next);
    }

    onEndpointChange(e) {
      const endpoint = e.target.value;
      this.setState({ endpoint });
      this.saveValue({ ...this.props.value, endpoint });
    }

    async fetchAndInsert() {
      const endpoint = (this.state.endpoint || "").trim();
      if (!endpoint) {
        this.setState({ status: "Missing endpoint URL." });
        return;
      }

      this.setState({ status: "Fetching…", preview: "" });

      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = (await res.text()).trim();

        // Update our widget preview
        this.setState({ status: "Fetched. Updating body…", preview: text });
        this.saveValue({ ...this.props.value, endpoint, preview: text });

        // --- IMPORTANT PART: update the BODY field ---
        // Decap gives widgets access to entry + fields via global store.
        // This is the supported way to programmatically update other fields.
        const store = window.CMS?.store;
        if (!store) throw new Error("Decap store not available.");

        const state = store.getState();

        // Current entry data
        const entry = state.entryDraft?.entry || state.entryDraft?.entryData;
        // Above can vary; simplest stable approach is to use entryDraft data via getters:
        const currentBody =
          state.entryDraft?.entry?.getIn?.(["data", "body"]) ??
          state.entryDraft?.entry?.getIn?.(["data", "Body"]) ??
          "";

        const newBody = upsertApiBlock(String(currentBody || ""), endpoint, text);

        // Dispatch a change to the body field.
        // This action name is stable in Decap’s reducer.
        store.dispatch({
          type: "ENTRY_FIELD_UPDATE",
          payload: {
            field: "body",
            value: newBody,
          },
        });

        this.setState({ status: "Body updated ✅" });
      } catch (e) {
        this.setState({ status: "Error: " + String(e?.message || e) });
      }
    }

    render() {
      const endpoint = this.state.endpoint;
      const status = this.state.status;
      const preview = this.state.preview;

      return React.createElement(
        "div",
        { style: { border: "1px solid #ddd", padding: "10px", borderRadius: "6px" } },
        React.createElement("label", { style: { display: "block", fontWeight: "600" } }, "API Endpoint"),
        React.createElement("input", {
          type: "text",
          value: endpoint,
          onChange: this.onEndpointChange,
          style: { width: "100%", marginTop: "6px" },
        }),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: this.fetchAndInsert,
            style: { marginTop: "10px" },
          },
          "Fetch & Insert into Body"
        ),
        status
          ? React.createElement("div", { style: { marginTop: "8px", fontSize: "0.9em" } }, status)
          : null,
        preview
          ? React.createElement(
              "pre",
              {
                style: {
                  marginTop: "10px",
                  maxHeight: "180px",
                  overflow: "auto",
                  background: "#f7f7f7",
                  padding: "8px",
                  borderRadius: "6px",
                },
              },
              preview
            )
          : null
      );
    }
  }

  // Register as a Decap widget
  CMS.registerWidget("apiFetchTool", ApiFetchToolControl);
})();
