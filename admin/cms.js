(function () {
  if (!window.CMS) return;

  const API_BASE_URL = "https://localhost:7144/api/Treatments/search";
  const GUIDELINE_OPTIONS_URL = "https://localhost:7144/api/Treatments/guideline-options";

  CMS.registerPreviewStyle("/assets/css/pesticide-table-editor.css");

  /*
  //Proven: Was working but was giving errors in Console.
  const shortcodeLinePattern =
    /^\s*\{\{(?:<|%)\s*pesticide-table\b[\s\S]*?(?:>|%)\}\}\s*$/m;
  */

  const shortcodeLinePattern =
    /^{{<\s*pesticide-table\b[^>]*>}}$/;
  

  let guidelineOptionsCache = null;

  async function fetchGuidelineOptions() {
    if (guidelineOptionsCache) return guidelineOptionsCache;

    console.log("Fetching guideline options:", GUIDELINE_OPTIONS_URL);

    const response = await fetch(GUIDELINE_OPTIONS_URL, { credentials: "omit" });

    if (!response.ok) {
      throw new Error(`Guideline options fetch failed: HTTP ${response.status}`);
    }

    guidelineOptionsCache = await response.json();
    console.log("Guideline options JSON:", guidelineOptionsCache);

    return guidelineOptionsCache;
  }

  function normalizeWidgetValue(value) {
    if (!value) return {};

    if (typeof value.toJS === "function") {
      return value.toJS();
    }

    return value;
  }

  function findGuideline(options, guidelineId) {
    return (options || []).find(
      g => String(g.guidelineId) === String(guidelineId)
    );
  }

  function makeOptionLabel(item, idField) {
    const id = item?.[idField] ?? "";
    const name = item?.name || "(No name)";
    return `${name} (${id})`;
  }

  const PesticideTableSelectorControl = createClass({
    getInitialState() {
      return {
        loading: true,
        error: "",
        options: []
      };
    },

    componentDidMount() {
      fetchGuidelineOptions()
        .then(options => {
          this.setState({
            loading: false,
            error: "",
            options: Array.isArray(options) ? options : []
          });
        })
        .catch(err => {
          console.error("Failed to load guideline options:", err);
          this.setState({
            loading: false,
            error: err?.message || String(err),
            options: []
          });
        });
    },

    updateValue(changes) {
      const current = normalizeWidgetValue(this.props.value);

      const next = {
        guidelineId: current.guidelineId || "",
        pestId: current.pestId || "",
        siteId: current.siteId || "",
        ...changes
      };

      this.props.onChange(next);
    },

    handleGuidelineChange(e) {
      const guidelineId = e.target.value;

      this.updateValue({
        guidelineId,
        pestId: "",
        siteId: ""
      });
    },

    handlePestChange(e) {
      this.updateValue({
        pestId: e.target.value
      });
    },

    handleSiteChange(e) {
      this.updateValue({
        siteId: e.target.value
      });
    },

    render() {
      const h = window.h || window.React.createElement;
      const value = normalizeWidgetValue(this.props.value);

      const guidelineId = value.guidelineId || "";
      const pestId = value.pestId || "";
      const siteId = value.siteId || "";

      const selectedGuideline = findGuideline(this.state.options, guidelineId);
      const pestOptions = selectedGuideline?.pests || [];
      const siteOptions = selectedGuideline?.sites || [];

      const fieldStyle = {
        marginBottom: "12px"
      };

      const labelStyle = {
        display: "block",
        fontWeight: "600",
        marginBottom: "4px"
      };

      const selectStyle = {
        width: "100%",
        padding: "8px"
      };

      if (this.state.loading) {
        return h("div", null, "Loading guideline options...");
      }

      if (this.state.error) {
        return h("div", { style: { color: "#b00020" } }, [
          h("strong", { key: "title" }, "Could not load guideline options."),
          h("div", { key: "msg" }, this.state.error)
        ]);
      }

      
      return h("div", null, [
        // =========================
        // MAIN SELECTION BOX
        // =========================
        h("div", {
          key: "mainSelectionBox",
          style: {
            border: "1px solid #d6d6d6",
            borderRadius: "4px",
            padding: "16px",
            background: "#fff",
            marginBottom: "16px"
          }
        }, [

          h("div", { key: "guideline", style: fieldStyle }, [
            h("label", { style: labelStyle }, "Guideline"),
            h(
              "select",
              {
                value: guidelineId,
                onChange: this.handleGuidelineChange,
                style: selectStyle
              },
              [
                h("option", { key: "", value: "" }, "-- Select Guideline --"),
                ...this.state.options.map(g =>
                  h(
                    "option",
                    {
                      key: g.guidelineId,
                      value: String(g.guidelineId)
                    },
                    `${g.name || g.shortName || "Unnamed Guideline"} (${g.guidelineId})`
                  )
                )
              ]
            )
          ]),

          h("div", { key: "pest", style: fieldStyle }, [
            h("label", { style: labelStyle }, "Pest"),
            h(
              "select",
              {
                value: pestId,
                onChange: this.handlePestChange,
                disabled: !guidelineId,
                style: selectStyle
              },
              [
                h("option", { key: "", value: "" }, "-- Select Pest --"),
                ...pestOptions.map(p =>
                  h(
                    "option",
                    {
                      key: p.pestId,
                      value: String(p.pestId)
                    },
                    makeOptionLabel(p, "pestId")
                  )
                )
              ]
            )
          ]),

          h("div", { key: "site", style: fieldStyle }, [
            h("label", { style: labelStyle }, "Site / Crop"),
            h(
              "select",
              {
                value: siteId,
                onChange: this.handleSiteChange,
                disabled: !guidelineId,
                style: selectStyle
              },
              [
                h("option", { key: "", value: "" }, "-- Select Site / Crop --"),
                ...siteOptions.map(s =>
                  h(
                    "option",
                    {
                      key: s.siteId,
                      value: String(s.siteId)
                    },
                    makeOptionLabel(s, "siteId")
                  )
                )
              ]
            )
          ])

        ]),
      ]);
    }
  });

  const ChangedSinceControl = createClass({
    handleChange(e) {
      this.props.onChange(e.target.value);
    },

    render() {
      const h = window.h || window.React.createElement;
      const value = this.props.value || "";

      const fieldStyle = {
        marginBottom: "12px"
      };

      const labelStyle = {
        display: "block",
        fontWeight: "600",
        marginBottom: "4px"
      };

      return h("div", {
        style: {
          border: "1px solid #d6d6d6",
          borderRadius: "4px",
          padding: "16px",
          background: "#fff"
        }
      }, [
        h("div", { key: "changedSince", style: fieldStyle }, [
          h("label", { style: labelStyle }, "Show Changes Since"),
          h("input", {
            type: "date",
            value: value,
            onChange: this.handleChange,
            style: {
              width: "180px",
              padding: "8px",
              border: "1px solid #c5c5c5",
              borderRadius: "4px",
              background: "#fff",
              boxSizing: "border-box"
            }
          })
        ])
      ]);
    }
  });

  CMS.registerWidget("pesticide_table_selector", PesticideTableSelectorControl);

  CMS.registerWidget("changed_since_selector", ChangedSinceControl);

  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Treatment Table (DB)",

    fields: [
      {
        name: "tableSelector",
        label: "Required",
        widget: "pesticide_table_selector",
        required: true
      },
      {
        name: "changedSince",
        label: "Track Changes",
        widget: "changed_since_selector",
        required: false,
      }
    ],

    pattern: shortcodeLinePattern,

    fromBlock: (match) => {
      const block = match?.[0] || "";

      const getAttr = (name) => {
        const m = block.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
        return m ? m[1] : "";
      };

      return {
        tableSelector: {
          guidelineId: getAttr("guidelineId"),
          pestId: getAttr("pestId"),
          siteId: getAttr("siteId"),
        },
        changedSince: getAttr("changedSince")
      };
    },

    toBlock: (data) => {
      const selector = data.tableSelector || {};

      const g = String(selector.guidelineId || "").trim();
      const p = String(selector.pestId || "").trim();
      const s = String(selector.siteId || "").trim();
      const d = String(data.changedSince || "").trim();

      return `{{< pesticide-table guidelineId="${g}" pestId="${p}" siteId="${s}" changedSince="${d}" >}}`;
    },

    toPreview: (data) => {
      console.log("pesticide-table toPreview data:", data);
      const selector = data.tableSelector || {};

      const g = String(selector.guidelineId || "").trim();
      const p = String(selector.pestId || "").trim();
      const s = String(selector.siteId || "").trim();
      const d = String(data.changedSince || "").trim();

      return `
        <div class="pesticide-table-preview"
             data-guideline-id="${escapeHtml(g)}"
             data-pest-id="${escapeHtml(p)}"
             data-site-id="${escapeHtml(s)}"
             data-changed-since="${escapeHtml(d)}">
          Loading pesticide table...
        </div>
      `;
    }
  });

  startPreviewHydrationLoop();

  function startPreviewHydrationLoop() {
    setInterval(async () => {
      const previewDoc = getPreviewDocument();
      if (!previewDoc) return;
      await hydrateAllPesticideTables(previewDoc);
    }, 800);
  }

  function getPreviewDocument() {
    const iframe =
      document.querySelector("iframe[class*='PreviewPaneFrame']") ||
      document.querySelector("iframe[title*='Preview']") ||
      document.querySelector("iframe");

    return iframe?.contentDocument || null;
  }

  async function hydrateAllPesticideTables(previewDoc) {

    const nodes = previewDoc.querySelectorAll(".pesticide-table-preview");

    /*
    console.log("Pesticide preview nodes found:",
      nodes.length,
      Array.from(nodes).map(n => ({
        guidelineId: n.dataset.guidelineId,
        pestId: n.dataset.pestId,
        siteId: n.dataset.siteId,
        changedSince: n.dataset.changedSince
      }))
    );*/
    //console.log("Pesticide preview nodes found:", nodes.length);
    if (!nodes.length) return;

    for (const node of nodes) {
      const guidelineId = node.getAttribute("data-guideline-id") || "";
      const pestId = node.getAttribute("data-pest-id") || "";
      const siteId = node.getAttribute("data-site-id") || "";
      const changedSince = node.getAttribute("data-changed-since") || "";

      const loadKey = `${guidelineId}|${pestId}|${siteId}|${changedSince}`;

      if (node.getAttribute("data-load-key") === loadKey) continue;

      node.setAttribute("data-load-key", loadKey);

      try {
        const url = new URL(API_BASE_URL);
        url.searchParams.set("guidelineId", guidelineId);
        url.searchParams.set("pestId", pestId);
        url.searchParams.set("siteId", siteId);

        if (changedSince) {
          url.searchParams.set("changedSince", changedSince);
        }

        console.log("Fetching pesticide JSON:", url.toString());

        const res = await fetch(url.toString(), { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("Pesticide JSON:", json);

        node.__pesticideRows = window.PesticideTableBuilder.buildRows(json);
        node.__changedSince = changedSince;
        node.__pesticideJson = json;

        const html = window.PesticideTableBuilder.renderTable(json, {
          changedSince: changedSince
        });
        node.innerHTML = html;

        //window.PesticideTableBuilder.wireTableEvents(node);

        console.log("Pesticide table events wired");
      } catch (err) {
        console.error("Pesticide preview failed:", err);

        node.innerHTML = `
          <div><strong>Preview failed.</strong></div>
          <div>GuidelineId: ${escapeHtml(guidelineId)}</div>
          <div>PestId: ${escapeHtml(pestId)}</div>
          <div>SiteId: ${escapeHtml(siteId)}</div>
          <div style="margin-top:0.5rem; color:#b00020;">
            ${escapeHtml(err?.message || String(err))}
          </div>
        `;
      }
    }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();

/*
(function () {
  if (!window.CMS) return;

  const API_BASE_URL = "https://localhost:7144/api/Treatments/search";

  CMS.registerPreviewStyle("/assets/css/pesticide-table-editor.css");

  //const shortcodeLinePattern = /^\s*\{\{[<%]\s*pesticide-table\b[^}]*[>%]\}\}\s*$/m;
  const shortcodeLinePattern =
  /^\s*\{\{(?:<|%)\s*pesticide-table\b[\s\S]*?(?:>|%)\}\}\s*$/m;

  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Pesticide Table (DB)",
    fields: [
      { name: "guidelineId", label: "Guideline ID", widget: "string", required: true },
      { name: "pestId", label: "Pest ID", widget: "string" },
      { name: "siteId", label: "Site ID", widget: "string" }
    ],

    pattern: shortcodeLinePattern,

    fromBlock: (match) => {
      const block = match?.[0] || "";

      const getAttr = (name) => {
        const m = block.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
        return m ? m[1] : "";
      };

      return {
        guidelineId: getAttr("guidelineId"),
        pestId: getAttr("pestId"),
        siteId: getAttr("siteId")
      };
    },

    toBlock: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();
      return `{{< pesticide-table guidelineId="${g}" pestId="${p}" siteId="${s}" >}}`;
    },

    toPreview: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();

      return `
        <div class="pesticide-table-preview"
             data-guideline-id="${escapeHtml(g)}"
             data-pest-id="${escapeHtml(p)}"
             data-site-id="${escapeHtml(s)}">
          Loading pesticide table...
        </div>
      `;
    }
  });

  startPreviewHydrationLoop();

  function startPreviewHydrationLoop() {
    setInterval(async () => {
      const previewDoc = getPreviewDocument();
      if (!previewDoc) return;
      await hydrateAllPesticideTables(previewDoc);
    }, 800);
  }

  function getPreviewDocument() {
    const iframe =
      document.querySelector("iframe[class*='PreviewPaneFrame']") ||
      document.querySelector("iframe[title*='Preview']") ||
      document.querySelector("iframe");

    return iframe?.contentDocument || null;
  }

  async function hydrateAllPesticideTables(previewDoc) {
    const nodes = previewDoc.querySelectorAll(".pesticide-table-preview");
    if (!nodes.length) return;

    for (const node of nodes) {
      if (node.getAttribute("data-loaded") === "1") continue;

      const guidelineId = node.getAttribute("data-guideline-id") || "";
      const pestId = node.getAttribute("data-pest-id") || "";
      const siteId = node.getAttribute("data-site-id") || "";

      try {
        const url = new URL(API_BASE_URL);
        url.searchParams.set("guidelineId", guidelineId);
        url.searchParams.set("pestId", pestId);
        url.searchParams.set("siteId", siteId);

        console.log("Fetching pesticide JSON:", url.toString());

        const res = await fetch(url.toString(), { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("Pesticide JSON:", json);

        node.__pesticideRows = window.PesticideTableBuilder.buildRows(json);
        node.__pesticideJson = json;

        const html = window.PesticideTableBuilder.renderTable(json);
        node.innerHTML = html;

        window.PesticideTableBuilder.wireTableEvents(node);

        console.log("Pesticide table events wired");

        node.setAttribute("data-loaded", "1");
      } catch (err) {
        console.error("Pesticide preview failed:", err);

        node.innerHTML = `
          <div><strong>Preview failed.</strong></div>
          <div>GuidelineId: ${escapeHtml(guidelineId)}</div>
          <div>PestId: ${escapeHtml(pestId)}</div>
          <div>SiteId: ${escapeHtml(siteId)}</div>
          <div style="margin-top:0.5rem; color:#b00020;">
            ${escapeHtml(err?.message || String(err))}
          </div>
        `;
        node.setAttribute("data-loaded", "1");
      }
    }
  }

  //Get the API Guideline Options.
  async function fetchGuidelineOptions() {
    const url = "https://localhost:7144/api/Treatments/guideline-options";

    console.log("Fetching guideline options:", url);

    const response = await fetch(url, { credentials: "omit" });

    if (!response.ok) {
      throw new Error(`Guideline options fetch failed: HTTP ${response.status}`);
    }

    const json = await response.json();

    console.log("Guideline options JSON:", json);

    return json;
  }
  
  async function testGuidelineOptionsFetch() {
    try {
      const results = await fetchGuidelineOptions();

      console.log("Guideline options loaded successfully.");
      console.log("Count:", Array.isArray(results) ? results.length : 0);

      if (Array.isArray(results)) {
        results.forEach((guideline, index) => {
          console.log(`Guideline ${index + 1}:`, {
            guidelineId: guideline.guidelineId,
            name: guideline.name,
            shortName: guideline.shortName,
            pestCount: Array.isArray(guideline.pests) ? guideline.pests.length : 0,
            siteCount: Array.isArray(guideline.sites) ? guideline.sites.length : 0
          });
        });
      }

      return results;
    } catch (err) {
      console.error("Failed to load guideline options:", err);
      return null;
    }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 👇 ADD THIS HERE
  testGuidelineOptionsFetch();

})();
*/