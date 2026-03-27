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
    if (sp.phiReferToLabel) return "Refer To Label";

    const phi = clean(sp.phi);
    const phiTime = clean(sp.phiTime);

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
  // 2. ROW STATE
  // =========================================================

  let currentRows = [];

  function getRowKey(row) {
    return [
      row.treatmentId ?? "",
      row.controlTechniqueId ?? "",
      row.pesticideId ?? "",
      row.pestId ?? "",
      row.siteId ?? ""
    ].join("|");
  }

  function getRowKeyFromElement(tr) {
    return [
      tr?.dataset?.treatmentId || "",
      tr?.dataset?.controlTechniqueId || "",
      tr?.dataset?.pesticideId || "",
      tr?.dataset?.pestId || "",
      tr?.dataset?.siteId || ""
    ].join("|");
  }

  function findRowByElement(tr) {
    const key = getRowKeyFromElement(tr);
    return currentRows.find(r => getRowKey(r) === key) || null;
  }

  // =========================================================
  // 3. ROW BUILDING / NORMAL TABLE RENDER
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
          treatmentId: treatment?.treatmentId ?? "",
          controlTechniqueId: treatment?.controlTechniqueId ?? treatment?.controlTechnique?.controlTechniqueId ?? "",
          pesticideId: pesticideId ?? "",
          pestId: treatment?.pestId ?? "",
          siteId: treatment?.siteId ?? "",
          treatment: treatment,
          pesticide: pesticide,
          matchingRates: matchingRates,
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

  function renderEditButtons() {
    return `<button type="button" class="edit-row-btn">Edit</button>`;
  }

  function renderIdBlock(row, showTreatmentRateIds) {
    const rateIds = showTreatmentRateIds
      ? (row.matchingRates || [])
          .map(r => `<div><strong>TR:</strong> ${escapeHtml(r.treatmentRateId ?? 0)}</div>`)
          .join("")
      : "";

    return `
      <div><strong>T:</strong> ${escapeHtml(row.treatmentId)}</div>
      <div><strong>CT:</strong> ${escapeHtml(row.controlTechniqueId)}</div>
      <div><strong>P:</strong> ${escapeHtml(row.pesticideId)}</div>
      ${rateIds}
    `;
  }

  function renderTable(data) {
    currentRows = buildRows(data);
    const rows = currentRows;

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
              ${renderEditButtons()}
          </td>
          <td style="border:1px solid #ccc; border-bottom:none; padding:6px; font-size:12px; line-height:1.3;">
              ${renderIdBlock(row, true)}
          </td>
          <td>${escapeHtml(row.product)}</td>
          <td>${row.rate || ""}</td>
          <td>${escapeHtml(row.rei)}</td>
          <td>${escapeHtml(row.phi)}</td>
          <td>${escapeHtml(row.resistance)}</td>
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
  // 4. EDIT VIEW ONLY
  // =========================================================

  function renderRateEditor(row) {
    const rates = row.matchingRates || [];

    if (!rates.length) {
      return `
        <div class="rate-editor-block"
             style="border:1px solid #ddd; padding:8px; margin-bottom:6px; background:#fafafa;">

          <div style="font-size:12px; color:#666; margin-bottom:6px;">
            <strong>TreatmentRateId:</strong> 0
          </div>

          <div style="margin-bottom:6px;">
            <label style="display:block; font-size:12px;">RateKind</label>
            <input type="text" value="Primary" style="width:100%;">
          </div>

          <div style="margin-bottom:6px;">
            <label style="display:block; font-size:12px;">Concentration</label>
            <input type="text" value="" style="width:100%;">
          </div>

          <div style="margin-bottom:6px;">
            <label style="display:block; font-size:12px;">Amount Note</label>
            <input type="text" value="" style="width:100%;">
          </div>

          <div style="margin-bottom:6px;">
            <label style="display:block; font-size:12px;">UnitId</label>
            <input type="number" value="0" style="width:100%;">
          </div>

          <div>
            <label style="display:block; font-size:12px;">UnitAreaId</label>
            <input type="number" value="0" style="width:100%;">
          </div>
        </div>
      `;
    }

    return rates.map((rate, index) => `
      <div class="rate-editor-block"
           data-rate-index="${index}"
           style="border:1px solid #ddd; padding:8px; margin-bottom:6px; background:#fafafa;">

        <div style="font-size:12px; color:#666; margin-bottom:6px;">
          <strong>TreatmentRateId:</strong> ${escapeHtml(rate.treatmentRateId ?? 0)}
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">RateKind</label>
          <input type="text"
                 value="${escapeHtml(rate.rateKind || "")}"
                 style="width:100%;">
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">Concentration</label>
          <input type="text"
                 value="${escapeHtml(rate.concentration || "")}"
                 style="width:100%;">
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">Amount Note</label>
          <input type="text"
                 value="${escapeHtml(rate.amountNote || "")}"
                 style="width:100%;">
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">UnitId</label>
          <input type="number"
                 value="${escapeHtml(rate.unitId ?? 0)}"
                 style="width:100%;">
        </div>

        <div>
          <label style="display:block; font-size:12px;">UnitAreaId</label>
          <input type="number"
                 value="${escapeHtml(rate.unitAreaId ?? 0)}"
                 style="width:100%;">
        </div>
      </div>
    `).join("");
  }

  function enterEditMode(tr) {
    console.log("enterEditMode called");
    const row = findRowByElement(tr);
    console.log("row found:", row);
    if (!row) return;
    if (tr.classList.contains("is-editing")) return;

    tr.classList.add("is-editing");

    const cells = tr.querySelectorAll("td");
    if (cells.length < 8) return;

    cells[0].innerHTML = `<button type="button" disabled>Edit</button>`;
    cells[1].innerHTML = renderIdBlock(row, true);
    cells[2].innerHTML = escapeHtml(row.product);
    cells[3].innerHTML = renderRateEditor(row);
    cells[4].innerHTML = escapeHtml(row.rei);
    cells[5].innerHTML = escapeHtml(row.phi);
    cells[6].innerHTML = escapeHtml(row.resistance);
    cells[7].innerHTML = escapeHtml(row.efficacy);
  }

  function wireTableEvents(container) {
    console.log("Edit clicked");
    if (!container || container.__pesticideTableEventsBound) return;
    container.__pesticideTableEventsBound = true;

    container.addEventListener("click", function (e) {
      const editBtn = e.target.closest(".edit-row-btn");

      if (editBtn) {
        const tr = editBtn.closest("tr.data-row");
        if (!tr) return;
        enterEditMode(tr);
      }
    });
  }

  window.PesticideTableBuilder = {
    renderTable,
    wireTableEvents
  };
})();