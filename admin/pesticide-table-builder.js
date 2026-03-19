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

  function formatRate(rate) {
    if (!rate) return "";

    const concentration = clean(rate.concentration);
    const amountNote = clean(rate.amountNote);
    const unit = clean(rate.unit?.name);
    const unitArea = clean(rate.unitArea?.name);

    let text = "";

    if (concentration) {
      text += concentration;
    }

    if (unit) {
      text += (text ? " " : "") + unit;
    }

    if (unitArea) {
      text += "/ " + unitArea;
    }

    if (amountNote) {
      text += (text ? " " : "") + `(${amountNote})`;
    }

    return clean(text);
  }

  function formatReiPhi(sitePesticideList) {
    const sp = (sitePesticideList || [])[0];
    if (!sp) return "";

    let rei = "";
    if (sp.reiUntilDry) {
      rei = "REI: until dry";
    } else if (sp.reiReferToLabel) {
      rei = "REI: see label";
    } else if (sp.rei) {
      rei = `REI: ${clean(sp.rei)} hr`;
    }

    let phi = "";
    if (sp.phiUntilDry) {
      phi = "PHI: until dry";
    } else if (sp.phi || sp.phiTime) {
      phi = `PHI: ${clean(sp.phi)} ${clean(sp.phiTime)}`.trim();
    }

    return [rei, phi].filter(Boolean).join(" / ");
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
      const text = clean(c.comment || c.commentText);
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
          tradeName: clean(pesticide?.tradeName),
          commonName: clean(pesticide?.commonName),
          rate: rateText,
          reiPhi: formatReiPhi(pesticide?.sitePesticide || []),
          resistance: formatResistance(pesticide),
          efficacy: efficacy,
          comments: comments
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
        <td>${escapeHtml(row.tradeName)}</td>
        <td>${escapeHtml(row.commonName)}</td>
        <td>${row.rate}</td>
        <td>${escapeHtml(row.reiPhi)}</td>
        <td>${escapeHtml(row.resistance)}</td>
        <td>${escapeHtml(row.efficacy)}</td>
        <td>${row.comments}</td>
      </tr>
    `).join("");

    return `
      <div class="pesticide-table-wrapper">
        <table style="border-collapse:collapse; width:100%;">
          <thead>
            <tr>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Trade Name</th>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Common Name (AI)</th>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Rate</th>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">REI / PHI</th>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Resistance Mgmt.</th>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Efficacy</th>
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Comments</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    `;
  }

  window.PesticideTableBuilder = {
    renderTable
  };
})();