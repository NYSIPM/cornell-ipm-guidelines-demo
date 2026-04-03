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

    const parts = [];

    const rei = clean(sp.rei);
    if (rei) {
      parts.push(`${rei} hr`);
    }

    if (sp.reiReferToLabel) {
      parts.push("Refer To Label");
    }

    if (sp.reiUntilDry) {
      parts.push("Until Dry");
    }

    return parts.join(" / ");
  }

  function formatPhi(sitePesticideList) {
    const sp = (sitePesticideList || [])[0];
    if (!sp) return "";

    const parts = [];

    const phi = clean(sp.phi);
    const phiTime = clean(sp.phiTime);

    if (phi) {
      parts.push(phiTime ? `${phi} ${phiTime}` : phi);
    }

    if (sp.phiReferToLabel) {
      parts.push("Refer To Label");
    }

    if (sp.phiUntilDry) {
      parts.push("Until Dry");
    }

    return parts.join(" / ");
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

  //EfficacyId? 3/31/2026
  function getEfficacyId(row) {
    return row?.treatment?.efficacyId ?? row?.treatment?.efficacy?.efficacyId ?? null;
  }

  //Application Method 3/31/2026
  function renderApplicationMethodEditor(row, metadata) {
    const applicationMethods = metadata?.applicationMethods || [];
    const selectedValue = row?.treatment?.applicationMethodId ?? row?.applicationMethodId ?? null;

    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>ApplicationMethodId:</strong> ${escapeHtml(selectedValue ?? 0)}
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">Application Method</label>
        <select data-field="applicationMethodId" style="width:100%;">
          ${renderSelectOptions(applicationMethods, selectedValue, "-")}
        </select>
      </div>
    `;
  }

  //REI PHI Helpers - 4/2/2026
  function getPrimarySitePesticide(row) {
      return row?.pesticide?.sitePesticide?.[0] || null;
  }
  function renderReiEditor(row) {
    const sp = getPrimarySitePesticide(row);

    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>Shared SitePesticide</strong>
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">REI</label>
        <input type="text" data-field="rei" value="${escapeHtml(sp?.rei || "")}" style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">REI Time</label>
        <select data-field="reiTime" style="width:100%;">
          ${renderTimeOptions(sp?.reiTime)}
        </select>
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">
          <input type="checkbox" data-field="reiReferToLabel" ${sp?.reiReferToLabel ? "checked" : ""}>
          REI Refer To Label
        </label>
      </div>

      <div>
        <label style="display:block; font-size:12px;">
          <input type="checkbox" data-field="reiUntilDry" ${sp?.reiUntilDry ? "checked" : ""}>
          REI Until Dry
        </label>
      </div>
    `;
  }
  function renderPhiEditor(row) {
    const sp = getPrimarySitePesticide(row);

    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>Shared SitePesticide</strong>
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">PHI</label>
        <input type="text" data-field="phi" value="${escapeHtml(sp?.phi || "")}" style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">PHI Time</label>
        <select data-field="phiTime" style="width:100%;">
          ${renderTimeOptions(sp?.phiTime)}
        </select>
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">
          <input type="checkbox" data-field="phiReferToLabel" ${sp?.phiReferToLabel ? "checked" : ""}>
          PHI Refer To Label
        </label>
      </div>

      <div>
        <label style="display:block; font-size:12px;">
          <input type="checkbox" data-field="phiUntilDry" ${sp?.phiUntilDry ? "checked" : ""}>
          PHI Until Dry
        </label>
      </div>
    `;
  }

  function renderTimeOptions(selectedValue) {
    const options = [
      { value: "", label: "-" },
      { value: "Hours", label: "Hours" },
      { value: "Days", label: "Days" }
    ];

    const selected = String(selectedValue ?? "");

    return options.map(opt => {
      const isSelected = opt.value === selected ? " selected" : "";
      return `<option value="${escapeHtml(opt.value)}"${isSelected}>${escapeHtml(opt.label)}</option>`;
    }).join("");
  }

  //SiteTiming - Added 4/3/2026
  function formatSiteTimings(treatment) {
    const values = (treatment?.siteTimings || [])
      .map(st => clean(st?.name))
      .filter(Boolean);

    return unique(values).join("<br>");
  }

  // =========================================================
  // 2. ROW STATE
  // =========================================================

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

  function findRowByElement(tr, container) {
    const key = getRowKeyFromElement(tr);
    const rows = container?.__pesticideRows || [];
    return rows.find(r => getRowKey(r) === key) || null;
  }

  // =========================================================
  // 3. ROW BUILDING / NORMAL TABLE RENDER
  // =========================================================

  function buildRows(data) {
    const treatments = Array.isArray(data) ? data : [data];
    const rows = [];

    console.log("buildRows input:", treatments);

    treatments.forEach(treatment => {
      const efficacy = clean(treatment?.efficacy?.name);
      const comments = formatComments(treatment);
      const pesticides = treatment?.controlTechnique?.pesticides || [];
      const rates = treatment?.treatmentRates || [];

      pesticides.forEach(pesticide => {
        const pesticideId = pesticide?.pesticideId;
        const matchingRates = rates.filter(r => r?.pesticideId === pesticideId);
        const rateText = unique(matchingRates.map(formatRate).filter(Boolean)).join("<br>");
        const applicationMethodText = clean(treatment?.applicationMethod?.name);
        const siteTimingText = formatSiteTimings(treatment);

        
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
          siteTimings: siteTimingText,
          rate: [applicationMethodText, rateText].filter(Boolean).join("<br>"),
          rei: formatRei(pesticide?.sitePesticide || []),
          phi: formatPhi(pesticide?.sitePesticide || []),
          resistance: formatResistance(pesticide),
          efficacy: efficacy,
          comments: comments
        });
      });
    });
    console.log("built rows:", rows);
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
              ${renderEditButtons()}
          </td>
          <td style="border:1px solid #ccc; border-bottom:none; padding:6px; font-size:12px; line-height:1.3;">
              ${renderIdBlock(row, true)}
          </td>
          <td>${escapeHtml(row.product)}</td>
          <td>${row.siteTimings || ""}</td>
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
              <th style="border:1px solid #ccc; padding:6px; text-align:left;">Site Timing</th>
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

  function renderRateEditor(row, metadata) {
  const rates = row.matchingRates || [];
  const units = metadata?.units || [];
  const unitAreas = metadata?.unitAreas || [];

  //If Not Treatment Rates Exist.
  if (!rates.length) {
    return `
      <div class="rate-editor-block"
          data-treatment-rate-id="0"
          style="border:1px solid #ddd; padding:8px; margin-bottom:6px; background:#fafafa;">

        <div style="font-size:12px; color:#666; margin-bottom:6px;">
          <strong>TreatmentRateId:</strong> 0
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">RateKind</label>
          <input type="text" data-field="rateKind" value="Primary" style="width:100%;">
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">Concentration</label>
          <input type="text" data-field="concentration" value="" style="width:100%;">
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">Amount Note</label>
          <input type="text" data-field="amountNote" value="" style="width:100%;">
        </div>

        <div style="margin-bottom:6px;">
          <label style="display:block; font-size:12px;">UnitId</label>
          <select data-field="unitId" style="width:100%;">
            ${renderSelectOptions(units, null, "-- Select Unit --")}
          </select>
        </div>

        <div>
          <label style="display:block; font-size:12px;">UnitAreaId</label>
          <select data-field="unitAreaId" style="width:100%;">
            ${renderSelectOptions(unitAreas, null, "-- Select Unit Area --")}
          </select>
        </div>
      </div>
    `;
  }

  return rates.map((rate, index) => `
    <div class="rate-editor-block"
        data-rate-index="${index}"
        data-treatment-rate-id="${escapeHtml(rate.treatmentRateId ?? 0)}"
        style="border:1px solid #ddd; padding:8px; margin-bottom:6px; background:#fafafa;">

      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>TreatmentRateId:</strong> ${escapeHtml(rate.treatmentRateId ?? 0)}
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">RateKind</label>
        <input type="text"
              data-field="rateKind"
              value="${escapeHtml(rate.rateKind || "")}"
              style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">Concentration</label>
        <input type="text"
              data-field="concentration"
              value="${escapeHtml(rate.concentration || "")}"
              style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">Amount Note</label>
        <input type="text"
              data-field="amountNote"
              value="${escapeHtml(rate.amountNote || "")}"
              style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">UnitId</label>
        <select data-field="unitId" style="width:100%;">
          ${renderSelectOptions(units, rate.unit?.unitId ?? null, "-")}
        </select>
      </div>

      <div>
        <label style="display:block; font-size:12px;">UnitAreaId</label>
        <select data-field="unitAreaId" style="width:100%;">
          ${renderSelectOptions(unitAreas, rate.unitArea?.unitAreaId ?? null, "-")}
        </select>
      </div>
    </div>
  `).join("");
}

  function enterEditMode(tr, container) {
    console.log("enterEditMode called");
    const row = findRowByElement(tr, container);
    console.log("row found:", row);
    if (!row) return;
    if (tr.classList.contains("is-editing")) return;

    tr.classList.add("is-editing");

    const cells = tr.querySelectorAll("td");
    if (cells.length < 9) return;

    cells[0].innerHTML = `
      <button type="button" class="save-row-btn">Save</button>
      <button type="button" class="cancel-row-btn" style="margin-left:6px;">Cancel</button>
    `;
    cells[1].innerHTML = renderIdBlock(row, true);
    cells[2].innerHTML = escapeHtml(row.product);
    cells[3].innerHTML = row.siteTimings || "";
    cells[4].innerHTML = renderApplicationMethodEditor(row, container.__editMetadata) + renderRateEditor(row, container.__editMetadata);
    cells[5].innerHTML = renderReiEditor(row);
    cells[6].innerHTML = renderPhiEditor(row);
    cells[7].innerHTML = escapeHtml(row.resistance);
    cells[8].innerHTML = renderEfficacyEditor(row, container.__editMetadata);
  }

  function wireTableEvents(container) {
    if (!container || container.__pesticideTableEventsBound) return;
    container.__pesticideTableEventsBound = true;

    container.addEventListener("click", async function (e) {
      const editBtn = e.target.closest(".edit-row-btn");
      const cancelBtn = e.target.closest(".cancel-row-btn");
      const saveBtn = e.target.closest(".save-row-btn"); //Added 3/30/2026

      if (editBtn) {
        console.log("Edit clicked");

        const tr = editBtn.closest("tr.data-row");
        if (!tr) return;

        try {
          await ensureEditMetadata(container);
        } catch (err) {
          console.error("Failed to load metadata:", err);
          alert("Failed to load edit options.");
          return;
        }

        enterEditMode(tr, container);
        return;
      }

      if (saveBtn) {
        console.log("Save clicked");

        const tr = saveBtn.closest("tr.data-row");
        if (!tr) return;

        handleSaveRow(tr, container);

        return;
      }

      if (cancelBtn) {
        console.log("Cancel clicked");

        // rebuild data from stored rows
        const rows = container.__pesticideRows || [];

        // IMPORTANT: we need original API shape, not rows
        // easiest fix: store original JSON too (see next step)

        if (container.__pesticideJson) {
          container.innerHTML = renderTable(container.__pesticideJson);
          wireTableEvents(container);
        }

        return;
      }
    });
  }

  //Fetches the Meta Data JSON File
  async function ensureEditMetadata(container) {
    if (container.__editMetadata) {
      return container.__editMetadata;
    }

    const guidelineId = container.dataset.guidelineId;

    const url = `https://localhost:7144/api/Treatments/edit-metadata?guidelineId=${guidelineId || ""}`;
    console.log("Fetching edit metadata:", url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Metadata fetch failed: ${response.status}`);
    }

    const json = await response.json();

    container.__editMetadata = json;

    console.log("Metadata loaded:", json);

    return json;
  }

  function renderSelectOptions(options, selectedValue, placeholder = "-- Select --") {
    const selected = String(selectedValue ?? "");

    const optionHtml = (options || []).map(opt => {
      const value = String(opt.id ?? "");
      const isSelected = value === selected ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${isSelected}>${escapeHtml(opt.name)}</option>`;
    }).join("");

    return `
      <option value="">${escapeHtml(placeholder)}</option>
      ${optionHtml}
    `;
  }
  
  //Efficacy 3/31/2026
  function renderEfficacyEditor(row, metadata) {
    const efficacies = metadata?.efficacies || [];
    const selectedEfficacyId = getEfficacyId(row);

    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>EfficacyId:</strong> ${escapeHtml(selectedEfficacyId ?? 0)}
      </div>

      <select data-field="efficacyId" style="width:100%;">
        ${renderSelectOptions(efficacies, selectedEfficacyId, "-")}
      </select>
    `;
  }

  // =========================================================
  // 5. SAVE - added 3/30/2026
  // =========================================================
  async function handleSaveRow(tr, container) {
    const row = findRowByElement(tr, container);
    if (!row) return;

    console.log("Saving row:", row);

    const treatment = row.treatment || {};
    const getRowField = (field) => tr.querySelector(`[data-field="${field}"]`)?.value ?? "";
    const getRowChecked = (field) => !!tr.querySelector(`[data-field="${field}"]`)?.checked;
    const rateBlocks = tr.querySelectorAll(".rate-editor-block");

    const updatedRates = [];

    //I don't understand what this does?
    const parseNullableInt = (value) => {
      const n = parseInt(value, 10);
      return Number.isNaN(n) || n <= 0 ? null : n;
    };

    rateBlocks.forEach(block => {
      const get = (field) =>
        block.querySelector(`[data-field="${field}"]`)?.value ?? "";

      updatedRates.push({
        treatmentRateId: parseInt(block.dataset.treatmentRateId, 10) || 0,
        rateKind: "Test", //get("rateKind").trim()
        pesticideId: parseInt(row.pesticideId, 10) || 0,
        concentration: get("concentration").trim(),
        amountNote: get("amountNote").trim(),
        unitId: parseNullableInt(get("unitId")),
        unitAreaId: parseNullableInt(get("unitAreaId")),
      });
    });

    const payload = {
      treatmentId: parseInt(row.treatmentId, 10) || 0,
      controlTechniqueId: parseInt(row.controlTechniqueId, 10) || 0,
      pestId: parseInt(row.pestId, 10) || 0,
      siteId: parseInt(row.siteId, 10) || 0,

      applicationMethodId: parseNullableInt(getRowField("applicationMethodId")),
      efficacyId: parseNullableInt(getRowField("efficacyId")),
      deleted: treatment.deleted ?? false,
      guidelineId: treatment.guidelineId ?? null,

      treatmentRates: updatedRates,

      efficacyComment: treatment.efficacyComment ?? "",

      siteHarvestPeriodIds: (treatment.siteHarvestPeriods || [])
        .map(x => x.siteHarvestPeriodId)
        .filter(x => x != null),

      pestLifeCycleIds: (treatment.pestLifeCycles || [])
        .map(x => x.pestLifeCycleId)
        .filter(x => x != null),

      pesticide: {
        pesticideId: parseInt(row.pesticideId, 10) || 0,
        sitePesticide: {
          siteId: parseInt(row.siteId, 10) || 0,
          pesticideId: parseInt(row.pesticideId, 10) || 0,
          rei: getRowField("rei").trim(),
          reiTime: getRowField("reiTime").trim(),
          reiReferToLabel: getRowChecked("reiReferToLabel"),
          reiUntilDry: getRowChecked("reiUntilDry"),
          phi: getRowField("phi").trim(),
          phiTime: getRowField("phiTime").trim(),
          phiReferToLabel: getRowChecked("phiReferToLabel"),
          phiUntilDry: getRowChecked("phiUntilDry")
        }
      }
    };

    console.log("Payload JSON:\n", JSON.stringify(payload, null, 2));
    //console.log("Payload to save:", payload);

    //STUFF
    try {
      const response = await fetch("https://localhost:7144/api/Treatments/save-row", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();

      console.log("Save status:", response.status);
      console.log("Save response:", responseText);

      if (!response.ok) {
        alert("Save failed. Check console for details.");
        return;
      }
      await reloadTableData(container);

      alert("Save succeeded.");
    } catch (err) {
      console.error("Save request failed:", err);
      alert("Save request failed. Check console.");
    }
  }

  async function reloadTableData(container) {
    const pestId = container.dataset.pestId;
    const siteId = container.dataset.siteId;
    const guidelineId = container.dataset.guidelineId;

    const params = new URLSearchParams();
    if (guidelineId) params.append("guidelineId", guidelineId);
    if (pestId) params.append("pestId", pestId);
    if (siteId) params.append("siteId", siteId);

    const url = `https://localhost:7144/api/Treatments/search?${params.toString()}`;
    console.log("Reloading pesticide JSON:", url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Reload failed with status ${response.status}`);
    }

    const json = await response.json();

    container.__pesticideJson = json;
    container.__pesticideRows = buildRows(json);
    container.innerHTML = renderTable(json);
    container.__pesticideTableEventsBound = false;
    wireTableEvents(container);
  }

  window.PesticideTableBuilder = {
    buildRows,
    renderTable,
    wireTableEvents
  };
})();