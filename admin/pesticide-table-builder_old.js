(function () {

  // =========================================================
  // 1. DISPLAY / FORMAT HELPERS
  // =========================================================
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
    if (sp.phiReferToLabel) return "Refer To Label";

    const phi = clean(sp.phi);
    const phiTime = clean(sp.phiTime);

    // Only show anything if phi exists
    if (!phi) return "";

    return phiTime ? `${phi} ${phiTime}` : phi;
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



  // =========================================================
  // 2. ROW BUILDING / NORMAL TABLE RENDER
  // =========================================================
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
          // key row identity values for future editing
          treatmentId: treatment?.treatmentId ?? "",
          controlTechniqueId: treatment?.controlTechniqueId ?? treatment?.controlTechnique?.controlTechniqueId ?? "",
          pesticideId: pesticideId ?? "",
          pestId: treatment?.pestId ?? "",
          siteId: treatment?.siteId ?? "",

          // keep source objects available for later editor work
          treatment: treatment,
          pesticide: pesticide,
          matchingRates: matchingRates,

          // existing display fields
          product: formatProductName(pesticide),
          rate: rateText,
          rei: formatRei(pesticide?.sitePesticide || []),
          phi: formatPhi(pesticide?.sitePesticide || []),
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
    <tr
        class="data-row"
        data-treatment-id="${escapeHtml(row.treatmentId)}"
        data-control-technique-id="${escapeHtml(row.controlTechniqueId)}"
        data-pesticide-id="${escapeHtml(row.pesticideId)}"
        data-pest-id="${escapeHtml(row.pestId)}"
        data-site-id="${escapeHtml(row.siteId)}">
        <td style="border:1px solid #ccc; border-bottom:none; padding:6px;">
            <button type="button" class="edit-row-btn">Edit</button>
        </td>
        <td style="border:1px solid #ccc; border-bottom:none; padding:6px; font-size:12px; line-height:1.3;">
            <div><strong>T:</strong> ${escapeHtml(row.treatmentId)}</div>
            <div><strong>CT:</strong> ${escapeHtml(row.controlTechniqueId)}</div>
            <div><strong>P:</strong> ${escapeHtml(row.pesticideId)}</div>
        </td>
        <td style="">${escapeHtml(row.product)}</td>
        <td style="">${row.rate}</td>
        <td style="">${escapeHtml(row.rei)}</td>
        <td style="">${escapeHtml(row.phi)}</td>
        <td style="">${escapeHtml(row.resistance)}</td>
        <td style="border-right:1px solid #ccc; padding:6px; text-align:left;">${escapeHtml(row.efficacy)}</td>
    </tr>

    <tr class="comment-row">
        <td colspan="10"
            style="border:1px solid #ccc; border-top:none; border-bottom:3px solid #999; padding:8px 10px; background:#f9f9f9;">
            <strong>Comments:</strong><br>
            ${row.comments || "<em>No comments</em>"}
        </td>
    </tr>
    `).join("");

    return `
      <div class="pesticide-table-wrapper">
        <table style="border-collapse:collapse; width:100%;">
          <thead>
            <tr>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">Edit</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">Id</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">Product</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">Rate</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">REI</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">PHI</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">Resistance Mgmt.</th>
                <th style="border:1px solid #ccc; padding:6px; text-align:left;">Efficacy</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // =========================================================
  // 3. EDIT MODE / SAVE SUPPORT
  // =========================================================


  // =========================================================
  // 4. PUBLIC EXPORTS
  // =========================================================
  window.PesticideTableBuilder = {
    renderTable
  };
})();