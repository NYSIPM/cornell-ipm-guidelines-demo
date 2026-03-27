(function () {
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function formatProductName(pesticide) {
    const tradeName = clean(pesticide?.tradeName);
    const commonName = clean(pesticide?.commonName);

    if (tradeName && commonName) return `${tradeName} (${commonName})`;
    if (tradeName) return tradeName;
    if (commonName) return commonName;
    return "";
  }

  function formatRate(rate) {
    if (!rate) return "";

    const concentration = clean(rate.concentration);
    const amountNote = clean(rate.amountNote);
    const unit = clean(rate.unit?.name);
    const unitArea = clean(rate.unitArea?.name);

    let text = "";

    if (concentration) text += concentration;
    if (unit) text += (text ? " " : "") + unit;
    if (unitArea) text += "/ " + unitArea;
    if (amountNote) text += (text ? " " : "") + `(${amountNote})`;

    return clean(text);
  }

  function formatRei(sitePesticideList) {
    const sp = (sitePesticideList || [])[0];
    if (!sp) return "";

    if (sp.reiUntilDry) return "Until dry";
    if (sp.reiReferToLabel) return "See label";
    if (sp.rei) return `${clean(sp.rei)} hr`;

    return "";
  }

  function formatPhi(sitePesticideList) {
    const sp = (sitePesticideList || [])[0];
    if (!sp) return "";

    if (sp.phiUntilDry) return "Until dry";

    const phi = clean(sp.phi);
    const phiTime = clean(sp.phiTime);

    return [phi, phiTime].filter(Boolean).join(" ");
  }

  function formatResistance(pesticide) {
    const iracValues = [];
    const fracValues = [];

    (pesticide?.activeIngredients || []).forEach(ai => {
      const irac = clean(ai?.activeIngredientInsecticide?.irac);
      const frac = clean(ai?.activeIngredientFungicide?.frac);

      if (irac) iracValues.push(irac);
      if (frac) fracValues.push(frac);
    });

    const iracText = unique(iracValues).join(", ");
    const fracText = unique(fracValues).join(", ");

    if (iracText && fracText) return `IRAC: ${iracText} / FRAC: ${fracText}`;
    if (iracText) return `IRAC: ${iracText}`;
    if (fracText) return `FRAC: ${fracText}`;
    return "";
  }

  function formatComments(treatment) {
    const comments = (treatment?.comments || []).map(c => {
      const idx = clean(c.indexNumber);
      const text = clean(c.commentText || c.comment);
      if (!text) return "";
      return idx ? `${idx}: ${text}` : text;
    });

    return unique(comments).join("<br>");
  }

  function buildRows(data) {
    const treatments = Array.isArray(data) ? data : [data];
    const rows = [];

    treatments.forEach(treatment => {
      const efficacy = clean(treatment?.efficacy?.name);
      const comments = formatComments(treatment);
      const pesticides = treatment?.controlTechnique?.pesticides || [];
      const rates = treatment?.treatmentRates || [];

      pesticides.forEach(pesticide => {
        const pesticideId = pesticide?.pesticideId;
        const matchingRates = rates.filter(r => r?.pesticideId === pesticideId);
        const rateText = unique(matchingRates.map(formatRate).filter(Boolean)).join("<br>");

        rows.push({
          product: formatProductName(pesticide),
          rate: rateText,
          rei: formatRei(pesticide?.sitePesticide || []),
          phi: formatPhi(pesticide?.sitePesticide || []),
          resistance: formatResistance(pesticide),
          efficacy,
          comments
        });
      });
    });

    return rows;
  }

  function renderTable(data) {
    const rows = buildRows(data);

    if (!rows.length) {
      return `<div>No pesticide rows found.</div>`;
    }

    const bodyRows = rows.map(row => `
      <tr>
        <td>${escapeHtml(row.product)}</td>
        <td>${row.rate}</td>
        <td>${escapeHtml(row.rei)}</td>
        <td>${escapeHtml(row.phi)}</td>
        <td>${escapeHtml(row.resistance)}</td>
        <td>${escapeHtml(row.efficacy)}</td>
        <td>${row.comments}</td>
      </tr>
    `).join("");

    return `
      <div class="pesticide-table-wrapper">
        <table class="pesticide-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Rate</th>
              <th>REI</th>
              <th>PHI</th>
              <th>Resistance Mgmt.</th>
              <th>Efficacy</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    `;
  }

  window.PesticideTableBuilder = { renderTable };
})();