(function () {
  if (!window.CMS) return;

  // =========================================================
  // API CONFIGURATION
  // =========================================================
  /*
  window.PesticideTableConfig = window.PesticideTableConfig || {
    apiBaseUrl: window.location.hostname === "localhost"
      ? "https://localhost:7144"
      : "https://webguidelines2.psep.cce.cornell.edu"
  };*/

  window.TreatmentEnvironment = "live";
  // options: "local", "live"

  window.TreatmentConfig = window.TreatmentConfig || {
    apiBaseUrl:
      window.TreatmentEnvironment === "live"
        ? "https://webguidelines2.psep.cce.cornell.edu"
        : "https://localhost:7145"
  };

  window.TreatmentApiUrl = window.TreatmentApiUrl || function (path) {
    const base = window.TreatmentConfig.apiBaseUrl.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path : "/" + path;
    return base + cleanPath;
  };

  console.log("Auth0 object:", window.auth0);

  // =========================================================
  // Auth0
  // =========================================================
  window.TreatmentAuthConfig = {
    domain: "newa-apps.auth0.com",
    clientId: "de7WU6GhM1OR5eDJ7YY4eb7q6LdK01SV",
    audience: "https://webguidelines2.psep.cce.cornell.edu/api",
    //redirectUri: "http://localhost:7144/admin/" //window.location.origin + window.location.pathname
    redirectUri: `${window.location.origin}/admin/`
  };

  window.TreatmentAuth = {
    client: null,
    user: null,

    async init() {
      this.client = await auth0.createAuth0Client({
        domain: window.TreatmentAuthConfig.domain,
        clientId: window.TreatmentAuthConfig.clientId,
        authorizationParams: {
          audience: window.TreatmentAuthConfig.audience,
          redirect_uri: window.TreatmentAuthConfig.redirectUri
        },
        cacheLocation: "localstorage"
      });

      if (
        window.location.search.includes("code=") &&
        window.location.search.includes("state=")
      ) {
        await this.client.handleRedirectCallback();

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }

      if (await this.client.isAuthenticated()) {
        this.user = await this.client.getUser();
        console.log("Logged in as:", this.user);
        console.log("Auth0 sub:", this.user?.sub);
        console.log("Email:", this.user?.email);
      }
    },

    async login() {
      await this.client.loginWithRedirect({
        appState: {
          returnTo: window.location.href
        },
        authorizationParams: {
          audience: window.TreatmentAuthConfig.audience,
          redirect_uri: window.TreatmentAuthConfig.redirectUri
        }
      });
    },

    async getTokenOrLogin() {
      if (!this.client) {
        await this.init();
      }

      const isAuthenticated = await this.client.isAuthenticated();

      if (!isAuthenticated) {
        await this.login();
        return null;
      }

      /*
      return await this.client.getTokenSilently({
        authorizationParams: {
          audience: window.TreatmentAuthConfig.audience
        }
      });
      */
     try {
        return await this.client.getTokenSilently({
          authorizationParams: {
            audience: window.TreatmentAuthConfig.audience
          }
        });
      } catch (err) {
        const consentRequired =
          err?.error === "consent_required" ||
          err?.message === "Consent required";

        if (consentRequired) {
          console.warn(
            "[TreatmentAuth] Consent required. Redirecting to Auth0 for approval."
          );

          await this.client.loginWithRedirect({
            appState: {
              returnTo: window.location.href
            },
            authorizationParams: {
              audience: window.TreatmentAuthConfig.audience,
              redirect_uri: window.TreatmentAuthConfig.redirectUri,
              prompt: "consent"
            }
          });

          return null;
        }

        throw err;
      }
    },

    async authHeaders() {
      const token = await this.getTokenOrLogin();

      if (!token) {
        throw new Error("Login required.");
      }

      return {
        Authorization: `Bearer ${token}`
      };
    },

    /*
    async logout() {
      await this.client.logout({
        logoutParams: {
          returnTo: `${window.location.origin}/admin/`
        }
      });
    }
    */
    async logout() {
      if (!this.client) {
        await this.init();
      }

      await this.client.logout({
        logoutParams: {
          returnTo: `${window.location.origin}/admin/`
        }
      });
    }
  };

  window.TreatmentAuth.getDisplayName = function () {
      if (!this.user) {
          return "Unknown User";
      }

      return (
          this.user.name ||
          this.user.nickname ||
          this.user.email ||
          this.user.sub
      );
  };



  // =========================================================
  // MAIN PART
  // =========================================================
  const API_BASE_URL = window.TreatmentApiUrl("/api/Treatments/search");
  const GUIDELINE_OPTIONS_URL = window.TreatmentApiUrl("/api/Treatments/guideline-options");

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

    //const response = await fetch(GUIDELINE_OPTIONS_URL, { credentials: "omit" });

    const authHeaders = await window.TreatmentAuth.authHeaders();

    const response = await fetch(GUIDELINE_OPTIONS_URL, {
      headers: {
        ...authHeaders
      }
    });
    

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

      //I might End up removing the this block.
      // Do not refresh the table while the user is actively editing it.
      if (node.querySelector(".is-editing")) {
        continue;
      }

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

        //const res = await fetch(url.toString(), { credentials: "omit" });
        
        const authHeaders = await window.TreatmentAuth.authHeaders();

        const res = await fetch(url.toString(), {
          headers: {
            ...authHeaders
          }
        });
        
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

        window.PesticideTableBuilder.wireTableEvents(node);

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

