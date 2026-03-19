(function () {
  if (!window.CMS) {
    console.error("apiFetchTool: window.CMS not found");
    return;
  }

  if (typeof window.createClass !== "function" || typeof window.h !== "function") {
    console.error(
      "apiFetchTool: createClass/h not found. Are you loading decap-cms.js before this file?"
    );
    return;
  }

  if (!window.ApiTableFormatter || typeof window.ApiTableFormatter.formatApiJsonToMarkdownTable !== "function") {
    console.error("apiFetchTool: ApiTableFormatter not found");
    return;
  }

  const createClass = window.createClass;
  const h = window.h;

  const DEFAULT_ENDPOINT =
    "https://localhost:7144/api/Treatments/search?siteId=6&pestId=6";
    //https://cropandpestguides.cce.cornell.edu/GuidelineTable/api/guideline-table/pesticides?guidelineId=3&pestId=208&siteId=29

  function buildApiBlock(endpoint, cached) {
    return (
      `::: {.api-insert endpoint="${endpoint}"}\n` +
      `<!-- api-cache -->\n` +
      `${cached}\n` +
      `<!-- /api-cache -->\n` +
      `:::\n`
    );
  }

  function upsertApiBlock(body, endpoint, cached) {
    const safeEndpoint = endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const re = new RegExp(
      String.raw`:::\s*\{\.api-insert\s+endpoint="${safeEndpoint}"\}\s*\r?\n\s*<!-- api-cache -->\s*\r?\n[\s\S]*?\r?\n\s*<!-- \/api-cache -->\s*\r?\n:::\s*`,
      "g"
    );

    const block = buildApiBlock(endpoint, cached);

    if (re.test(body)) {
      return body.replace(re, block);
    }

    const spacer = body.trim().length ? "\n\n" : "";
    return body + spacer + block;
  }

  function updateBodyField(newBody) {
    const store = window.CMS.store;
    if (!store) throw new Error("CMS.store not available");

    const actions = window.CMS.actions;
    if (actions && typeof actions.changeDraftField === "function") {
      store.dispatch(actions.changeDraftField("body", newBody));
      return;
    }

    store.dispatch({
      type: "DRAFT_CHANGE",
      payload: { field: "body", value: newBody },
    });
  }

  const ApiFetchToolControl = createClass({
    getInitialState: function () {
      const v = this.props.value || {};
      return {
        endpoint: v.endpoint || DEFAULT_ENDPOINT,
        status: "",
        preview: v.preview || "",
      };
    },

    componentDidMount: function () {
      console.log("apiFetchTool: control mounted");
    },

    setEndpoint: function (e) {
      const endpoint = e.target.value;
      this.setState({ endpoint });
      this.props.onChange({
        ...(this.props.value || {}),
        endpoint,
        preview: this.state.preview,
      });
    },

    fetchAndInsert: async function () {
      const endpoint = (this.state.endpoint || "").trim();
      if (!endpoint) {
        this.setState({ status: "Missing endpoint URL." });
        return;
      }

      this.setState({ status: "Fetching…", preview: "" });

      try {
        const res = await fetch(endpoint, { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const json = await res.json();
        const formatted = window.ApiTableFormatter.formatApiJsonToMarkdownTable(json);

        this.setState({
          status: "Fetched ✅ Formatting and updating body…",
          preview: formatted,
        });

        this.props.onChange({
          ...(this.props.value || {}),
          endpoint,
          preview: formatted,
        });

        const state = window.CMS.store.getState();
        const entry = state.entryDraft?.entry;
        const currentBody = entry?.getIn?.(["data", "body"]) || "";

        const newBody = upsertApiBlock(String(currentBody), endpoint, formatted);
        updateBodyField(newBody);

        this.setState({ status: "Body updated ✅" });
      } catch (err) {
        const msg =
          err?.name === "TypeError"
            ? "Failed to fetch (usually CORS, blocked redirect, or network). Check Network tab."
            : String(err?.message || err);

        this.setState({ status: "Fetch failed: " + msg });
        console.error("apiFetchTool fetch error:", err);
      }
    },

    render: function () {
      return h(
        "div",
        { style: { border: "1px solid #ddd", padding: "10px", borderRadius: "6px" } },
        h("div", { style: { fontWeight: 600, marginBottom: "6px" } }, "API Endpoint"),
        h("input", {
          type: "text",
          value: this.state.endpoint,
          onChange: this.setEndpoint,
          style: { width: "100%" },
        }),
        h(
          "button",
          { type: "button", onClick: this.fetchAndInsert, style: { marginTop: "10px" } },
          "Fetch & Insert into Body"
        ),
        this.state.status
          ? h("div", { style: { marginTop: "8px", fontSize: "0.9em" } }, this.state.status)
          : null,
        this.state.preview
          ? h(
              "pre",
              {
                style: {
                  marginTop: "10px",
                  maxHeight: "220px",
                  overflow: "auto",
                  background: "#f7f7f7",
                  padding: "8px",
                  borderRadius: "6px",
                  whiteSpace: "pre-wrap",
                },
              },
              this.state.preview
            )
          : null
      );
    },
  });

  window.CMS.registerWidget("apiFetchTool", ApiFetchToolControl);
  console.log("apiFetchTool: registered OK");
})();