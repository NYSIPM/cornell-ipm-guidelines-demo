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
  /*
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
  */
  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  //Same as the public summary (assets/js/public-pesticide-summary.js): "- Hours" / "- Days" shows as just "-"
  function formatDurationValue(value) {
    const text = clean(value);
    if (!text) return "";

    const dashOnly = text.match(/^[-–—]+\s*(hours?|days?)$/i);
    if (dashOnly) return "-";

    return text;
  }

  // =========================================================
  // Sorting - same as the public summary (assets/js/public-pesticide-summary.js):
  // click a header to sort ascending, again for descending, a third time for the API's order.
  // Rows with no value for the column always sort last. PHI/REI sort by time ("2 days" after "24 hours").
  // =========================================================
  function getDurationSortValue(value) {
    const match = clean(value).match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?/i);
    if (!match) return null;

    const amount = parseFloat(match[1]);
    const unit = (match[2] || "").toLowerCase();

    if (unit.startsWith("week")) return amount * 168;
    if (unit.startsWith("day")) return amount * 24;
    return amount;
  }

  const SORT_COLUMNS = [
    { key: "commonName", className: "pesticide-summary__col-common-name", label: "Common Name", type: "text", value: p => clean(p?.commonName) },
    { key: "tradeName", className: "pesticide-summary__col-trade-name", label: "Trade Name", type: "text", value: p => clean(p?.tradeName) },
    { key: "epa", className: "pesticide-summary__col-epa-number", label: "EPA Reg. Number", type: "text", value: p => clean(p?.epaRegistrationNumber) },
    { key: "phi", className: "pesticide-summary__col-phi", label: "PHI", type: "number", value: p => getDurationSortValue(p?.phi) },
    { key: "rei", className: "pesticide-summary__col-rei", label: "REI", type: "number", value: p => getDurationSortValue(p?.rei) },
    //Label comes from the summary type: IRAC Code / FRAC Code / Group Number
    { key: "resistance", className: "pesticide-summary__col-resistance", label: null, type: "text", value: (p, summaryType) => getResistanceCodes(p, summaryType).join(", ") }
  ];

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  function sortPesticides(pesticides, sort, summaryType) {
    const column = SORT_COLUMNS.find(c => c.key === sort?.key);
    if (!column) return pesticides;

    const direction = sort.direction === "desc" ? -1 : 1;

    return pesticides
      .map((pesticide, index) => ({ pesticide, index, value: column.value(pesticide, summaryType) }))
      .sort((a, b) => {
        const aMissing = a.value === null || a.value === "";
        const bMissing = b.value === null || b.value === "";

        if (aMissing || bMissing) {
          if (aMissing && bMissing) return a.index - b.index;
          return aMissing ? 1 : -1;
        }

        const result = column.type === "number"
          ? a.value - b.value
          : collator.compare(a.value, b.value);

        return result !== 0 ? result * direction : a.index - b.index;
      })
      .map(entry => entry.pesticide);
  }

  function renderSortableHeader(column, sort, resistanceHeading) {
    const active = sort?.key === column.key;
    const ariaSort = active ? (sort.direction === "desc" ? "descending" : "ascending") : "none";
    const label = column.key === "resistance" ? resistanceHeading : column.label;

    return `
      <th class="${column.className}" aria-sort="${ariaSort}">
        <button type="button" class="pesticide-summary__sort-button" data-sort-key="${column.key}">
          ${summary.escapeHtml(label)}
        </button>
      </th>
    `;
  }

  //Cycles asc -> desc -> none (the API's order). Used by pesticide-summary-preview.js.
  summary.getNextSort = function (current, key) {
    if (!current || current.key !== key) return { key, direction: "asc" };
    if (current.direction === "asc") return { key, direction: "desc" };
    return null;
  };

  function renderPesticideRow(pesticide, summaryType, groupIndex) {
    const resistanceCodes = getResistanceCodes(pesticide, summaryType);
    const rowClass = groupIndex % 2 === 0 ? "is-even" : "is-odd";

    return `
      <tr class="${rowClass}">
        <td class="pesticide-summary__col-common-name">${summary.escapeHtml(pesticide?.commonName || "")}</td>
        <td class="pesticide-summary__col-trade-name">${summary.escapeHtml(pesticide?.tradeName || "")}</td>
        <td class="pesticide-summary__col-epa-number">${summary.escapeHtml(pesticide?.epaRegistrationNumber || "")}</td>
        <td class="pesticide-summary__col-phi">${summary.escapeHtml(formatDurationValue(pesticide?.phi))}</td>
        <td class="pesticide-summary__col-rei">${summary.escapeHtml(formatDurationValue(pesticide?.rei))}</td>
        <td class="pesticide-summary__col-resistance">${summary.escapeHtml(resistanceCodes.join(", "))}</td>
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

  //sort is { key, direction } or null for the API's order
  summary.renderTable = function (json, sort = null) {
    const apiPesticides = Array.isArray(json?.pesticides) ? json.pesticides : [];
    const summaryType = summary.normalizeSummaryType(json?.summaryType) || "Pesticide";
    const siteId = json?.siteId ?? "";
    const siteName = json?.siteName || (siteId ? `Site ${siteId}` : "Selected Site");
    const resistanceHeading = getResistanceHeading(summaryType);

    if (!apiPesticides.length) {
      return `
        <div class="pesticide-summary">
          <!--<h3 class="pesticide-summary__title">${summary.escapeHtml(summaryType)} Summary</h3>-->
          <div class="pesticide-summary__subtitle">${summary.escapeHtml(siteName)}</div>
          <div>No ${summary.escapeHtml(summaryType.toLowerCase())} products were found for this site.</div>
        </div>
      `;
    }

    /*
    const bodyRows = pesticides
      .map((pesticide, index) => renderPesticideRow(pesticide, summaryType, index))
      .join("");
    */
    const pesticides = sortPesticides(apiPesticides, sort, summaryType);

    //Stripes alternate per Common Name group (in the current sort order)
    let currentCommonName = null;
    let groupIndex = -1;

    const bodyRows = pesticides
      .map(pesticide => {
        const commonName = String(pesticide?.commonName || "")
          .trim()
          .toLowerCase();

        if (commonName !== currentCommonName) {
          currentCommonName = commonName;
          groupIndex += 1;
        }

        return renderPesticideRow(pesticide, summaryType, groupIndex);
      })
      .join("");


    return `
      <div class="pesticide-summary">
        <!--<h3 class="pesticide-summary__title">${summary.escapeHtml(summaryType)} Summary</h3>-->
        <div class="pesticide-summary__table-wrap">
          <table class="pesticide-summary__table">
            <thead>
              <tr>
                ${SORT_COLUMNS.map(column => renderSortableHeader(column, sort, resistanceHeading)).join("")}
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
      <div class="pesticide-summary__footer">
          ${summary.escapeHtml(siteName)} &mdash; ${pesticides.length}
          ${pesticides.length === 1 ? "product" : "products"}
      </div>
    `;
  };
})(window);
