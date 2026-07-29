(function (window) {
  "use strict";

  const CMS = window.CMS;
  const summary = window.PesticideSummary;
  const createClass = window.createClass || window.React?.createClass;

  if (!CMS || !summary || !createClass) {
    console.error("[PesticideSummary] CMS, React createClass, and core script are required before widget registration.");
    return;
  }

  const Control = createClass({
    updateValue(changes) {
      const current = summary.normalizeWidgetValue(this.props.value);
      this.props.onChange({
        siteId: current.siteId || "",
        type: summary.normalizeSummaryType(current.type),
        ...changes
      });
    },

    handleSiteIdChange(event) {
      this.updateValue({ siteId: event.target.value });
    },

    handleTypeChange(event) {
      this.updateValue({ type: summary.normalizeSummaryType(event.target.value) });
    },

    render() {
      const h = window.h || window.React.createElement;
      const value = summary.normalizeWidgetValue(this.props.value);
      const siteId = value.siteId || "";
      const summaryType = summary.normalizeSummaryType(value.type);

      return h("div", { className: "pesticide-summary-selector" }, [
        h("div", {
          key: "description",
          className: "pesticide-summary-selector__description"
        }, "Select a Site ID and the pesticide summary type."),

        h("div", { key: "site", className: "pesticide-summary-selector__field" }, [
          h("label", { key: "label", className: "pesticide-summary-selector__label" }, "Site ID"),
          h("input", {
            key: "input",
            type: "number",
            min: "1",
            step: "1",
            value: siteId,
            placeholder: "Enter SiteId",
            onChange: this.handleSiteIdChange,
            className: "pesticide-summary-selector__control"
          })
        ]),

        h("div", { key: "type", className: "pesticide-summary-selector__field" }, [
          h("label", { key: "label", className: "pesticide-summary-selector__label" }, "Pesticide Summary Type"),
          h("select", {
            key: "select",
            value: summaryType,
            onChange: this.handleTypeChange,
            className: "pesticide-summary-selector__control"
          }, [
            h("option", { key: "empty", value: "" }, "-- Select Summary Type --"),
            ...summary.SUMMARY_TYPES.map(option =>
              h("option", { key: option.value, value: option.value }, option.label)
            )
          ])
        ])
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
        `Site: ${value.siteId || "-"}, Summary: ${summary.normalizeSummaryType(value.type) || "-"}`
      );
    }
  });

  CMS.registerWidget("pesticide_summary_selector", Control, Preview);
  console.log("[PesticideSummary] Registered selector widget.");
})(window);
