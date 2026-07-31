(function (window) {
  "use strict";

  const namespace = window.PesticideSummary = window.PesticideSummary || {};

  namespace.SUMMARY_TYPES = [
    { value: "Insecticide", label: "Insecticides" },
    { value: "Fungicide", label: "Fungicides" },
    { value: "Herbicide", label: "Herbicides" }
  ];

  namespace.SHORTCODE_PATTERN = /^{{<\s*pesticide-summary\b[^>]*>}}$/;
  namespace.STYLESHEET_URL = "/assets/css/pesticide-summary.css";

  namespace.normalizeWidgetValue = function (value) {
    if (!value) return {};
    return typeof value.toJS === "function" ? value.toJS() : value;
  };

  namespace.normalizeSummaryType = function (value) {
    if (value === 0 || value === "0") return "Insecticide";
    if (value === 1 || value === "1") return "Fungicide";
    if (value === 2 || value === "2") return "Herbicide";

    switch (String(value || "").trim().toLowerCase()) {
      case "insecticide":
      case "insecticides":
        return "Insecticide";
      case "fungicide":
      case "fungicides":
        return "Fungicide";
      case "herbicide":
      case "herbicides":
        return "Herbicide";
      default:
        return "";
    }
  };

  namespace.escapeHtml = function (value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  namespace.getAttributeFromBlock = function (block, name) {
    const expression = new RegExp(`${name}\\s*=\\s*\"([^\"]*)\"`, "i");
    const result = String(block || "").match(expression);
    return result ? result[1] : "";
  };

  namespace.getPreviewDocument = function () {
    const iframe =
      document.querySelector("iframe[class*='PreviewPaneFrame']") ||
      document.querySelector("iframe[title*='Preview']") ||
      document.querySelector("iframe");

    return iframe?.contentDocument || null;
  };

  namespace.getApiUrl = function (siteId, summaryType) {
    if (typeof window.TreatmentApiUrl !== "function") {
      throw new Error(
        "TreatmentApiUrl is unavailable. Make sure cms.js loads before the pesticide summary scripts."
      );
    }

    const baseUrl = window.TreatmentApiUrl(
      `/api/pesticide-summaries/site/${encodeURIComponent(siteId)}`
    );

    const url = new URL(baseUrl);
    url.searchParams.set("type", summaryType);
    return url.toString();
  };

  namespace.getAuthenticationHeaders = async function () {
    if (!window.TreatmentAuth?.authHeaders) {
      throw new Error("Treatment authentication is not ready.");
    }

    return await window.TreatmentAuth.authHeaders();
  };
})(window);
