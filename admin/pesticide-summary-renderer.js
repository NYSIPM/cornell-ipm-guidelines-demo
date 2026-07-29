(function (window) {
  "use strict";

  const summary = window.PesticideSummary;
  if (!summary) {
    console.error("[PesticideSummary] Core script must load before renderer.");
    return;
  }

  function getResistanceHeading(summaryType) {
    switch (summary.normalizeSummaryType(summaryType)) {
      case "Insecticide": return "IRAC Code";
      case "Fungicide": return "FRAC Code";
      case "Herbicide": return "Group Number";
      default: return "Resistance Group";
    }
  }

  function getResistanceCodes(pesticide, summaryType) {
    let values = [];

    switch (summary.normalizeSummaryType(summaryType)) {
      case "Insecticide": values = pesticide?.iracCodes; break;
      case "Fungicide": values = pesticide?.fracCodes; break;
      case "Herbicide": values = pesticide?.herbicideGroupNumbers; break;
      default: values = [];
    }

    if (!Array.isArray(values)) return [];

    return Array.from(new Set(
      values
        .map(value => String(value || "").trim())
        .filter(Boolean)
    ));
  }

  function renderPesticideRow(pesticide, summaryType, index) {
    const resistanceCodes = getResistanceCodes(pesticide, summaryType);
    const rowClass = index % 2 === 0 ? "is-even" : "is-odd";

    return `
      <tr class="${rowClass}">
        <td>${summary.escapeHtml(pesticide?.commonName || "")}</td>
        <td>${summary.escapeHtml(pesticide?.tradeName || "")}</td>
        <td>${summary.escapeHtml(pesticide?.epaRegistrationNumber || "")}</td>
        <td>${summary.escapeHtml(pesticide?.phi || "")}</td>
        <td>${summary.escapeHtml(pesticide?.rei || "")}</td>
        <td>${summary.escapeHtml(resistanceCodes.join(", "))}</td>
      </tr>
    `;
  }

  summary.renderMessage = function (message) {
    return `<div class="pesticide-summary pesticide-summary-message">${summary.escapeHtml(message)}</div>`;
  };

  summary.renderErrorMessage = function ({ siteId, summaryType, message }) {
    return `
      <div class="pesticide-summary pesticide-summary-error">
        <div><strong>Pesticide summary preview failed.</strong></div>
        <div class="pesticide-summary-error__detail">SiteId: ${summary.escapeHtml(siteId)}</div>
        <div>Type: ${summary.escapeHtml(summaryType)}</div>
        <div class="pesticide-summary-error__message">${summary.escapeHtml(message)}</div>
      </div>
    `;
  };

  summary.renderTable = function (json) {
    const pesticides = Array.isArray(json?.pesticides) ? json.pesticides : [];
    const summaryType = summary.normalizeSummaryType(json?.summaryType) || "Pesticide";
    const siteId = json?.siteId ?? "";
    const siteName = json?.siteName || (siteId ? `Site ${siteId}` : "Selected Site");
    const resistanceHeading = getResistanceHeading(summaryType);

    if (!pesticides.length) {
      return `
        <div class="pesticide-summary">
          <!--<h3 class="pesticide-summary__title">${summary.escapeHtml(summaryType)} Summary</h3>-->
          <div class="pesticide-summary__subtitle">${summary.escapeHtml(siteName)}</div>
          <div>No ${summary.escapeHtml(summaryType.toLowerCase())} products were found for this site.</div>
        </div>
      `;
    }

    const bodyRows = pesticides
      .map((pesticide, index) => renderPesticideRow(pesticide, summaryType, index))
      .join("");

    return `
      <div class="pesticide-summary">
        <h3 class="pesticide-summary__title">${summary.escapeHtml(summaryType)} Summary</h3>
        <div class="pesticide-summary__subtitle">
          ${summary.escapeHtml(siteName)} &mdash; ${pesticides.length}
          ${pesticides.length === 1 ? "product" : "products"}
        </div>
        <div class="pesticide-summary__table-wrap">
          <table class="pesticide-summary__table">
            <thead>
              <tr>
                <th>Common Name</th>
                <th>Trade Name</th>
                <th>EPA Registration Number</th>
                <th>PHI</th>
                <th>REI</th>
                <th>${summary.escapeHtml(resistanceHeading)}</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
    `;
  };
})(window);
