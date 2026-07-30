(function (window) {
  "use strict";

  const CMS = window.CMS;
  const summary = window.PesticideSummary;
  const createClass = window.createClass || window.React?.createClass;

  if (!CMS || !summary || !createClass) {
    console.error(
      "[PesticideSummary] CMS, React createClass, and core script are required before widget registration."
    );
    return;
  }

  let guidelineOptionsCache = null;
  let guidelineOptionsPromise = null;

  function getGuidelineOptionsUrl() {
    if (typeof window.TreatmentApiUrl !== "function") {
      throw new Error(
        "TreatmentApiUrl is unavailable. Make sure cms.js loads before the pesticide summary scripts."
      );
    }

    return window.TreatmentApiUrl("/api/Treatments/guideline-options");
  }

  async function fetchGuidelineOptions() {
    if (guidelineOptionsCache) return guidelineOptionsCache;
    if (guidelineOptionsPromise) return guidelineOptionsPromise;

    guidelineOptionsPromise = (async function () {
      const url = getGuidelineOptionsUrl();
      console.log("[PesticideSummary] Fetching guideline options:", url);

      const authHeaders = await summary.getAuthenticationHeaders();
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeaders
        }
      });

      if (!response.ok) {
        throw new Error(
          `Guideline options fetch failed: HTTP ${response.status}`
        );
      }

      const json = await response.json();
      guidelineOptionsCache = Array.isArray(json) ? json : [];
      return guidelineOptionsCache;
    })();

    try {
      return await guidelineOptionsPromise;
    } finally {
      guidelineOptionsPromise = null;
    }
  }

  function findGuideline(options, guidelineId) {
    return (options || []).find(
      guideline => String(guideline?.guidelineId ?? "") === String(guidelineId ?? "")
    );
  }

  function findGuidelineBySiteId(options, siteId) {
    const normalizedSiteId = String(siteId || "").trim();
    if (!normalizedSiteId) return null;

    return (options || []).find(guideline =>
      (guideline?.sites || []).some(
        site => String(site?.siteId ?? "") === normalizedSiteId
      )
    ) || null;
  }

  function findSite(guideline, siteId) {
    return (guideline?.sites || []).find(
      site => String(site?.siteId ?? "") === String(siteId ?? "")
    );
  }

  function makeGuidelineLabel(guideline) {
    const id = guideline?.guidelineId ?? "";
    const name = guideline?.name || guideline?.shortName || "Unnamed Guideline";
    return `${name} (${id})`;
  }

  function makeSiteLabel(site) {
    const id = site?.siteId ?? "";
    const name = site?.name || "(No name)";
    return `${name} (${id})`;
  }

  const Control = createClass({
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
          this.setState(
            {
              loading: false,
              error: "",
              options
            },
            this.inferGuidelineFromExistingSite
          );
        })
        .catch(error => {
          console.error(
            "[PesticideSummary] Failed to load guideline options:",
            error
          );

          this.setState({
            loading: false,
            error: error?.message || String(error),
            options: []
          });
        });
    },

    inferGuidelineFromExistingSite() {
      const current = summary.normalizeWidgetValue(this.props.value);
      const guidelineId = String(current.guidelineId || "").trim();
      const siteId = String(current.siteId || "").trim();

      if (guidelineId || !siteId) return;

      const matchingGuideline = findGuidelineBySiteId(this.state.options, siteId);
      if (!matchingGuideline) return;

      this.updateValue({
        guidelineId: String(matchingGuideline.guidelineId)
      });
    },

    updateValue(changes) {
      const current = summary.normalizeWidgetValue(this.props.value);

      this.props.onChange({
        guidelineId: String(current.guidelineId || ""),
        siteId: String(current.siteId || ""),
        type: summary.normalizeSummaryType(current.type),
        ...changes
      });
    },

    handleGuidelineChange(event) {
      this.updateValue({
        guidelineId: event.target.value,
        siteId: ""
      });
    },

    handleSiteChange(event) {
      this.updateValue({
        siteId: event.target.value
      });
    },

    handleTypeChange(event) {
      this.updateValue({
        type: summary.normalizeSummaryType(event.target.value)
      });
    },

    render() {
      const h = window.h || window.React.createElement;
      const value = summary.normalizeWidgetValue(this.props.value);

      const guidelineId = String(value.guidelineId || "");
      const siteId = String(value.siteId || "");
      const summaryType = summary.normalizeSummaryType(value.type);

      const selectedGuideline = findGuideline(
        this.state.options,
        guidelineId
      );
      const siteOptions = selectedGuideline?.sites || [];

      if (this.state.loading) {
        return h(
          "div",
          { className: "pesticide-summary-selector" },
          "Loading guideline and site options..."
        );
      }

      if (this.state.error) {
        return h(
          "div",
          { className: "pesticide-summary-selector pesticide-summary-error" },
          [
            h(
              "strong",
              { key: "title" },
              "Could not load guideline and site options."
            ),
            h(
              "div",
              { key: "message", className: "pesticide-summary-error__message" },
              this.state.error
            )
          ]
        );
      }

      return h("div", { className: "pesticide-summary-selector" }, [
        h(
          "div",
          {
            key: "description",
            className: "pesticide-summary-selector__description"
          },
          "Select a guideline, then choose its Site / Crop and pesticide summary type."
        ),

        h(
          "div",
          {
            key: "guideline",
            className: "pesticide-summary-selector__field"
          },
          [
            h(
              "label",
              {
                key: "label",
                className: "pesticide-summary-selector__label"
              },
              "Guideline"
            ),
            h(
              "select",
              {
                key: "select",
                value: guidelineId,
                onChange: this.handleGuidelineChange,
                className: "pesticide-summary-selector__control"
              },
              [
                h(
                  "option",
                  { key: "empty", value: "" },
                  "-- Select Guideline --"
                ),
                ...this.state.options.map(guideline =>
                  h(
                    "option",
                    {
                      key: String(guideline.guidelineId),
                      value: String(guideline.guidelineId)
                    },
                    makeGuidelineLabel(guideline)
                  )
                )
              ]
            )
          ]
        ),

        h(
          "div",
          {
            key: "site",
            className: "pesticide-summary-selector__field"
          },
          [
            h(
              "label",
              {
                key: "label",
                className: "pesticide-summary-selector__label"
              },
              "Site / Crop"
            ),
            h(
              "select",
              {
                key: "select",
                value: siteId,
                onChange: this.handleSiteChange,
                disabled: !guidelineId,
                className: "pesticide-summary-selector__control"
              },
              [
                h(
                  "option",
                  { key: "empty", value: "" },
                  guidelineId
                    ? "-- Select Site / Crop --"
                    : "-- Select a Guideline First --"
                ),
                ...siteOptions.map(site =>
                  h(
                    "option",
                    {
                      key: String(site.siteId),
                      value: String(site.siteId)
                    },
                    makeSiteLabel(site)
                  )
                )
              ]
            )
          ]
        ),

        h(
          "div",
          {
            key: "type",
            className: "pesticide-summary-selector__field"
          },
          [
            h(
              "label",
              {
                key: "label",
                className: "pesticide-summary-selector__label"
              },
              "Pesticide Summary Type"
            ),
            h(
              "select",
              {
                key: "select",
                value: summaryType,
                onChange: this.handleTypeChange,
                className: "pesticide-summary-selector__control"
              },
              [
                h(
                  "option",
                  { key: "empty", value: "" },
                  "-- Select Summary Type --"
                ),
                ...summary.SUMMARY_TYPES.map(option =>
                  h(
                    "option",
                    { key: option.value, value: option.value },
                    option.label
                  )
                )
              ]
            )
          ]
        )
      ]);
    }
  });

  const Preview = createClass({
    render() {
      const h = window.h || window.React.createElement;
      const value = summary.normalizeWidgetValue(this.props.value);

      return h(
        "span",
        null,
        `Guideline: ${value.guidelineId || "-"}, Site: ${value.siteId || "-"}, Summary: ${summary.normalizeSummaryType(value.type) || "-"}`
      );
    }
  });

  CMS.registerWidget("pesticide_summary_selector", Control, Preview);
  console.log("[PesticideSummary] Registered guideline/site selector widget.");
})(window);
