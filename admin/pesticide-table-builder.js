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
    const SHOW_INDEX = false; // 👈 flip this to true/false
    const comments = (treatment?.comments || []).map(c => {
      const idx = clean(c.indexNumber);
      const text = clean(c.comment || c.commentText);
      if (!text) return "";
      // 👇 controlled by toggle
      return (SHOW_INDEX && idx) ? `${idx}: ${text}` : text;
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

  //SiteTiming Added 4/6/2026
  function getAvailableSiteTimings(row, metadata) {
    const siteId = parseInt(row?.siteId ?? row?.treatment?.siteId ?? 0, 10);
    if (!siteId) return [];

    const siteEntry = (metadata?.siteTimings || []).find(s => Number(s.siteId) === siteId);
    if (!siteEntry || !Array.isArray(siteEntry.siteTimings)) return [];

    return [...siteEntry.siteTimings].sort((a, b) => {
      const aOrder = Number(a?.timingOrder ?? 9999);
      const bOrder = Number(b?.timingOrder ?? 9999);
      return aOrder - bOrder;
    });
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
          //rate: [applicationMethodText, rateText].filter(Boolean).join("<br>"),
          applicationMethod: applicationMethodText,
          siteTimings: siteTimingText,
          conventional: "",
          organic: "",
          rate: rateText,
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
    const AddTreatmentButton = `<div style="margin-top:12px;">
        <button type="button" class="insert-treatment-btn">
          Add Treatment
        </button>
      </div>`

    if (!rows.length) {
      return AddTreatmentButton + `<div>No pesticide rows found.</div>`;
    }

    const bodyRows = rows.map(row => `
      <tr
          class="data-row"
          data-treatment-id="${escapeHtml(row.treatmentId)}"
          data-control-technique-id="${escapeHtml(row.controlTechniqueId)}"
          data-pesticide-id="${escapeHtml(row.pesticideId)}"
          data-pest-id="${escapeHtml(row.pestId)}"
          data-site-id="${escapeHtml(row.siteId)}">
          <td rowspan="3" class="edit-cell">
            ${renderEditButtons()}
          </td>
          <td rowspan="3" class="id-cell">
            ${renderIdBlock(row, true)}
          </td>
          <td class="product-cell">
            <div class="product-text">
              ${escapeHtml(row.product)}
            </div>
          </td>
          <td class="data-cell rate-cell">
            <div class="cell-text">
              ${row.rate || ""}
            </div>
          </td>

          <td class="data-cell rei-cell">
            <div class="cell-text">
              ${escapeHtml(row.rei)}
            </div>
          </td>

          <td class="data-cell phi-cell">
            <div class="cell-text">
              ${escapeHtml(row.phi)}
            </div>
          </td>

          <td class="data-cell resistance-cell">
            <div class="cell-text">
              ${escapeHtml(row.resistance)}
            </div>
          </td>

          <td class="data-cell efficacy-cell">
            <div class="cell-text">
              ${escapeHtml(row.efficacy)}
            </div>
          </td>
      </tr>

      <tr class="misc-row">
        <td colspan="6" class="misc-content-cell">
          <button type="button" class="toggle-misc-row-btn">
            See more details
          </button>

          <div class="misc-details is-hidden">
            <div class="misc-detail-line">
              <strong>Conventional:</strong>
              ${row.conventional || "<em>Not set</em>"}
            </div>

            <div class="misc-detail-line">
              <strong>Organic:</strong>
              ${row.organic || "<em>Not set</em>"}
            </div>

            <div>
              <strong>Application Method:</strong>
              ${escapeHtml(row.applicationMethod) || "<em>None</em>"}
            </div>

            <div>
              <strong>Site Timing:</strong>
              ${row.siteTimings || "<em>None</em>"}
            </div>
          </div>
        </td>
      </tr>

      <tr class="comment-row">
          <td colspan="6"
              class="comment-content-cell"
              style="border-right:1px solid #ccc; border-top:none; border-bottom:3px solid #999; padding:8px 10px;">
              <!--<strong>Comments:</strong><br>-->
              ${row.comments || "<em>No comments</em>"}
          </td>
      </tr>
    `).join("");

    return `
      <div class="pesticide-table-wrapper">
        <div style="margin-top:12px;">
          <button type="button" class="insert-treatment-btn">
            Add Treatment
          </button>
        </div>
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
    if (cells.length < 8) return;

    cells[0].innerHTML = `
      <button type="button" class="save-row-btn">Save</button>
      <button type="button" class="cancel-row-btn" style="margin-left:6px;">Cancel</button>
    `;
    cells[1].innerHTML = renderIdBlock(row, true);
    //cells[2].innerHTML = escapeHtml(row.product);
    cells[2].innerHTML = `
      <div>${escapeHtml(row.product)}</div>
      <button type="button" class="edit-product-btn" style="margin-top:6px;">
        Edit Product
      </button>
    `;
    cells[3].innerHTML = renderRateEditor(row, container.__editMetadata);

    cells[4].innerHTML = renderReiEditor(row);
    cells[5].innerHTML = renderPhiEditor(row);
    cells[6].innerHTML = escapeHtml(row.resistance);
    cells[7].innerHTML = renderEfficacyEditor(row, container.__editMetadata);

    /*
    const miscTr = tr.nextElementSibling;
    if (miscTr && miscTr.classList.contains("misc-row")) {
      const miscCell = miscTr.querySelector(".misc-content-cell");
      if (miscCell) {
        miscCell.innerHTML = renderSiteTimingEditor(row, container.__editMetadata);
      }
    }
    */

    const miscTr = tr.nextElementSibling;

    if (miscTr && miscTr.classList.contains("misc-row")) {
      const miscCell = miscTr.querySelector(".misc-content-cell");
      if (miscCell) {
        miscCell.innerHTML = `
          <div class="misc-edit-wrapper">
            <div><strong>Miscellaneous</strong></div>
            <div class="misc-edit-grid">
              <div class="misc-edit-panel">
                <div class="misc-edit-title">Application Method</div>
                ${renderApplicationMethodEditor(row, container.__editMetadata)}
              </div>
              <div class="misc-edit-panel">
                <div class="misc-edit-title">Site Timing</div>
                ${renderSiteTimingEditor(row, container.__editMetadata)}
              </div>
            </div>
          </div>
        `;
      }
    }

    const commentTr = miscTr?.nextElementSibling;

    if (commentTr && commentTr.classList.contains("comment-row")) {
      const commentCell = commentTr.querySelector(".comment-content-cell");
      if (commentCell) {
        commentCell.innerHTML = renderCommentEditor(row);
      }
    }
    /*
    const commentTr = tr.nextElementSibling;
    if (commentTr && commentTr.classList.contains("comment-row")) {
      const commentCell = commentTr.querySelector(".comment-content-cell");
      if (commentCell) {
        commentCell.innerHTML = renderCommentEditor(row);
      }
    }
    */
  }

  function wireTableEvents(container) {
    if (!container || container.__pesticideTableEventsBound) return;
    container.__pesticideTableEventsBound = true;

    container.addEventListener("click", async function (e) {
      const editBtn = e.target.closest(".edit-row-btn");
      const cancelBtn = e.target.closest(".cancel-row-btn");
      const saveBtn = e.target.closest(".save-row-btn"); //Added 3/30/2026
      const editProductBtn = e.target.closest(".edit-product-btn"); //Added 4/7/2026 For the Modal
      const insertTreatmentBtn = e.target.closest(".insert-treatment-btn"); //For Insert Button Added 4/7/2026
      //For Comments
      //const addCommentBlockBtn = e.target.closest(".add-comment-block-btn");
      const removeCommentBlockBtn = e.target.closest(".remove-comment-block-btn");
      //const showLinkCommentPlaceholderBtn = e.target.closest(".show-link-comment-placeholder-btn"); //No Longer Neded
      const linkExistingCommentBtn = e.target.closest(".link-existing-comment-btn");
      //Comment Modol
      const openCommentSearchBtn = e.target.closest(".open-comment-search-btn");
      //Add 4-22-2026
      const editLinkedCommentBtn = e.target.closest(".edit-linked-comment-btn");
      //Added 4-28-2026
      const toggleMiscRowBtn = e.target.closest(".toggle-misc-row-btn");

      if (toggleMiscRowBtn) {
        const miscCell = toggleMiscRowBtn.closest(".misc-content-cell");
        const details = miscCell?.querySelector(".misc-details");

        if (details) {
          details.classList.toggle("is-hidden");

          toggleMiscRowBtn.textContent =
            details.classList.contains("is-hidden")
              ? "See more details"
              : "Hide details";
        }

        return;
      }

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

      if (editProductBtn) {
        const tr = editProductBtn.closest("tr.data-row");
        if (!tr) return;

        const row = findRowByElement(tr, container);
        if (!row) return;

        await openProductModal(row, container);
        return;
      }

      if (insertTreatmentBtn) {
        await openControlTechniqueModal(container);
        return;
      }
      
      //Added 4-22-2026
      if (editLinkedCommentBtn) {
        const block = editLinkedCommentBtn.closest(".comment-editor-block");
        const commentRow = editLinkedCommentBtn.closest("tr.comment-row");
        const dataRow = commentRow?.previousElementSibling?.previousElementSibling;
        const row = dataRow ? findRowByElement(dataRow, container) : null;
        const editorArea = editLinkedCommentBtn.closest(".comment-editor-area");
        const list = editorArea?.querySelector(".comment-editor-list");

        if (!block || !row || !list) return;

        const existingComment = {
          commentId: parseInt(block.dataset.commentId, 10) || 0,
          indexNumber: block.dataset.indexNumber || "",
          commentText: block.dataset.commentText || "",
          siteId: row?.siteId ?? row?.treatment?.siteId ?? null,
          guidelineId: row?.treatment?.guidelineId ?? null,
          pests: [
            {
              pestId: parseInt(row?.pestId ?? row?.treatment?.pestId ?? 0, 10) || 0,
              name: null
            }
          ].filter(p => p.pestId > 0)
        };

        await openCommentSearchModal(row, container, list, existingComment);
        return;
      }


      if (removeCommentBlockBtn) {
        const block = removeCommentBlockBtn.closest(".comment-editor-block");
        if (block) {
          block.remove();
        }
        return;
      }

      /*
      if (showLinkCommentPlaceholderBtn) {
        const editorArea = showLinkCommentPlaceholderBtn.closest(".comment-editor-area");
        const placeholder = editorArea?.querySelector(".comment-link-placeholder");
        if (placeholder) {
          placeholder.style.display = placeholder.style.display === "none" ? "block" : "none";
        }
        return;
      }

      if (linkExistingCommentBtn) {
        alert("Existing comment linking UI can be added here later.");
        return;
      }
      */

      if (openCommentSearchBtn) {
        const commentRow = openCommentSearchBtn.closest("tr.comment-row");
        const dataRow = commentRow?.previousElementSibling?.previousElementSibling;
        const row = dataRow ? findRowByElement(dataRow, container) : null;
        const editorArea = openCommentSearchBtn.closest(".comment-editor-area");
        const list = editorArea?.querySelector(".comment-editor-list");

        if (row && list) {
          await openCommentSearchModal(row, container, list);
        }
        return;
      }

      if (linkExistingCommentBtn) {
        const commentRow = linkExistingCommentBtn.closest("tr.comment-row");
        const dataRow = commentRow?.previousElementSibling?.previousElementSibling;
        const row = dataRow ? findRowByElement(dataRow, container) : null;
        const editorArea = linkExistingCommentBtn.closest(".comment-editor-area");
        const list = editorArea?.querySelector(".comment-editor-list");

        if (row && list) {
          await openCommentSearchModal(row, container, list);
        }
        return;
      }


      if (saveBtn) {
        console.log("Save clicked");

        const tr = saveBtn.closest("tr.data-row");
        if (!tr) return;

        await handleSaveRow(tr, container);

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

  async function openProductModal(row, container) {
    const modal = ensureProductModal();
    modal.style.display = "flex";

    modal.__rowKey = getRowKey(row);

    const current = modal.querySelector("#product-modal-current");
    current.innerHTML = `
      <div style="margin-bottom:8px;">
        <strong>Current Product:</strong> ${escapeHtml(row.product || "-")}
      </div>
      <div style="margin-bottom:8px;">
        <strong>PesticideId:</strong> ${escapeHtml(row.pesticideId || "")}
      </div>
      <div style="margin-bottom:8px;">
        <strong>Trade Name:</strong> ${escapeHtml(row.pesticide?.tradeName || "")}
      </div>
      <div style="margin-bottom:8px;">
        <strong>Common Name:</strong> ${escapeHtml(row.pesticide?.commonName || "")}
      </div>
      <div style="margin-bottom:8px;">
        <strong>EPA Registration Number:</strong> ${escapeHtml(row.pesticide?.epaRegistrationNumber || "")}
      </div>
      <div style="margin-bottom:8px;">
        <strong>Formulation:</strong> ${escapeHtml(row.pesticide?.formulation || "")}
      </div>
    `;
  }

  
  function ensureProductModal() {
    let modal = document.getElementById("product-edit-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "product-edit-modal";
    modal.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.45);
      z-index:9999;
      align-items:center;
      justify-content:center;
    `;

    modal.innerHTML = `
      <div style="
        background:#fff;
        width:min(900px, 92vw);
        max-height:85vh;
        overflow:auto;
        border-radius:8px;
        padding:16px;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0;">Edit Product</h3>
          <button type="button" class="close-product-modal-btn">Close</button>
        </div>

        <div style="margin-bottom:12px;">
          <input type="text" id="product-search-box" placeholder="Search pesticides..." style="width:100%; padding:8px;">
        </div>

        <div id="product-modal-current" style="margin-bottom:12px;"></div>
        <div id="product-modal-results"></div>

        <div style="margin-top:16px; display:flex; gap:8px;">
          <button type="button" class="save-product-selection-btn">Use Selected Product</button>
          <button type="button" class="close-product-modal-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", function(e) {
      //if (e.target === modal || e.target.closest(".close-product-modal-btn")) {
      //Prevents White Space Clicks from Closing the Window. Above Allows it.
      if (e.target.closest(".close-product-modal-btn")) {
        closeProductModal();
      }
    });

    return modal;
  }

  function closeProductModal() {
    const modal = document.getElementById("product-edit-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.__selectedProduct = null;
    modal.__rowKey = null;
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

  //SiteTiming Added 4/6/2026
  function renderSiteTimingEditor(row, metadata) {
    const available = getAvailableSiteTimings(row, metadata);
    const selectedIds = new Set(
      (row?.treatment?.siteTimings || [])
        .map(st => Number(st.siteTimingId))
        .filter(Number.isFinite)
    );

    if (!available.length) {
      return `
        <div style="font-size:12px; color:#666;">
          No Site Timing options found for SiteId ${escapeHtml(row?.siteId ?? "")}
        </div>
      `;
    }

    const optionsHtml = available.map(st => {
      const id = Number(st.siteTimingId);
      const checked = selectedIds.has(id) ? "checked" : "";
      const label = clean(st?.name);
      const order = st?.timingOrder ?? "";

      return `
        <label style="display:block; margin-bottom:4px; font-size:12px;">
          <input type="checkbox"
                data-field="siteTimingIds"
                value="${escapeHtml(id)}"
                ${checked}>
          ${escapeHtml(label)}
          ${order !== "" ? `<span style="color:#666;">(#${escapeHtml(order)})</span>` : ""}
        </label>
      `;
    }).join("");

    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>Site Timing</strong>
      </div>
      <div style="max-height:220px; overflow:auto; border:1px solid #ddd; padding:8px; background:#fafafa;">
        ${optionsHtml}
      </div>
    `;
  }

  //Added 4/14/2026
  function renderCommentEditor(row) {
    const comments = row?.treatment?.comments || [];
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? "";
    const guidelineId = row?.treatment?.guidelineId ?? "";
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? "";

    const existingBlocks = comments.length
      ? comments.map((comment, index) => `
          <div class="comment-editor-block"
            data-comment-index="${index}"
            data-comment-id="${escapeHtml(comment.commentId ?? 0)}"
            data-index-number="${escapeHtml(comment.indexNumber ?? "")}"
            data-comment-text="${escapeHtml(comment.commentText || comment.comment || "")}"
            style="border:1px solid #ddd; padding:10px; margin-bottom:8px; background:#fafafa;">

            <div style="font-size:12px; color:#666; margin-bottom:8px;">
              <strong>CommentId:</strong> ${escapeHtml(comment.commentId ?? 0)}
              ${comment.indexNumber ? ` | <strong>Index:</strong> ${escapeHtml(comment.indexNumber)}` : ""}
            </div>

            <div style="font-size:12px; color:#666; margin-bottom:8px;">
              <strong>SiteId:</strong> ${escapeHtml(siteId)}
              &nbsp; | &nbsp;
              <strong>GuidelineId:</strong> ${escapeHtml(guidelineId)}
              &nbsp; | &nbsp;
              <strong>PestId:</strong> ${escapeHtml(pestId)}
            </div>

            <div style="margin-bottom:8px; white-space:pre-wrap;">
              ${escapeHtml(comment.commentText || "") || "<em>No comment text</em>"}
            </div>

            <div style="display:flex; gap:8px;">
              <button type="button" class="edit-linked-comment-btn">Edit</button>
              <button type="button" class="remove-comment-block-btn">Remove</button>
            </div>
          </div>
        `).join("")
      : `
        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          No comments yet for this treatment.
        </div>
      `;

    return `
      <div class="comment-editor-area">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong>Comments</strong>
          <div style="display:flex; gap:8px;">
            <button type="button" class="open-comment-search-btn">Add Comment</button>
          </div>
        </div>

        <div class="comment-editor-list">
          ${existingBlocks}
        </div>
      </div>
    `;
  }

  
  function renderBlankCommentEditorBlock(row) {
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? "";
    const guidelineId = row?.treatment?.guidelineId ?? "";
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? "";

    return `
      <div class="comment-editor-block"
          data-comment-index="new"
          data-comment-id="0"
          data-index-number=""
          data-comment-text=""
          style="border:1px solid #ddd; padding:10px; margin-bottom:8px; background:#fafafa;">

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>CommentId:</strong> 0
        </div>

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>SiteId:</strong> ${escapeHtml(siteId)}
          &nbsp; | &nbsp;
          <strong>GuidelineId:</strong> ${escapeHtml(guidelineId)}
          &nbsp; | &nbsp;
          <strong>PestId:</strong> ${escapeHtml(pestId)}
        </div>

        <div style="margin-bottom:8px;">
          <label style="display:block; font-size:12px;">Index Number</label>
          <input type="text" data-field="comment-indexNumber" value="" style="width:100%;">
        </div>

        <div style="margin-bottom:8px;">
          <label style="display:block; font-size:12px;">Comment Text</label>
          <textarea data-field="comment-commentText" rows="3" style="width:100%;"></textarea>
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="link-existing-comment-btn">Link Existing</button>
          <button type="button" class="remove-comment-block-btn">Remove</button>
        </div>
      </div>
    `;
  }




  // =========================================================
  // 5. SAVE - added 3/30/2026
  // =========================================================
  async function handleSaveRow(tr, container) {
    if (tr.dataset.isSaving === "true") {
      console.log("Save already in progress for this row.");
      return;
    }
    tr.dataset.isSaving = "true";

    const row = findRowByElement(tr, container);
    if (!row) return;

    console.log("Saving row:", row);

    const treatment = row.treatment || {};
    const getRowField = (field) => tr.querySelector(`[data-field="${field}"]`)?.value ?? "";
    const getRowChecked = (field) => !!tr.querySelector(`[data-field="${field}"]`)?.checked;
    const rateBlocks = tr.querySelectorAll(".rate-editor-block");

    const miscRow = tr.nextElementSibling;
    const commentRow = miscRow?.nextElementSibling;
    const commentBlocks = commentRow?.querySelectorAll(".comment-editor-block") || [];
    const linkedComments = Array.from(commentBlocks)
      .map(block => {
        const commentId = parseInt(block.dataset.commentId, 10) || 0;
        return commentId > 0 ? { commentId } : null;
      })
      .filter(Boolean);

    const updatedRates = [];

    const getCheckedValues = (field) =>
      Array.from(
        [tr, tr.nextElementSibling]
          .filter(Boolean)
          .flatMap(rowEl => Array.from(rowEl.querySelectorAll(`[data-field="${field}"]:checked`)))
      )
    .map(el => parseInt(el.value, 10))
    .filter(Number.isFinite);

    const selectedSiteTimingIds = getCheckedValues("siteTimingIds");

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

      siteTimingIds: selectedSiteTimingIds,

      siteHarvestPeriodIds: (treatment.siteHarvestPeriods || [])
        .map(x => x.siteHarvestPeriodId)
        .filter(x => x != null),

      pestLifeCycleIds: (treatment.pestLifeCycles || [])
        .map(x => x.pestLifeCycleId)
        .filter(x => x != null),

      comments: linkedComments,

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
    } finally {
      tr.dataset.isSaving = "false";
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

  // =========================================================
  // 6. Insert Modal - added 4/7/2026
  // =========================================================
  function ensureControlTechniqueModal() {
    let modal = document.getElementById("control-technique-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "control-technique-modal";
    modal.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.45);
      z-index:9999;
      align-items:center;
      justify-content:center;
    `;

    modal.innerHTML = `
        <div style="
          background:#fff;
          width:min(950px, 94vw);
          max-height:85vh;
          overflow:auto;
          border-radius:8px;
          padding:16px;
          box-shadow:0 10px 30px rgba(0,0,0,0.2);
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0;">Select Control Technique</h3>
            <button type="button" class="close-ct-modal-btn">Close</button>
          </div>

          <div style="margin-bottom:12px;">
            <input type="text"
                  id="ct-search-box"
                  placeholder="Search pesticide or display name..."
                  style="width:100%; padding:8px;">
          </div>

          <div id="ct-modal-results">Type to search control techniques...</div>

          <div id="ct-create-cta" style="display:none; margin-top:12px;">
            <button type="button" class="show-create-ct-form-btn">Add Control Technique</button>
          </div>

          <div id="ct-create-form" style="display:none; margin-top:16px; border:1px solid #ddd; padding:12px; background:#fafafa;">
            <h4 style="margin-top:0;">Create New Pesticide Control Technique</h4>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Trade Name</label>
              <input type="text" data-create-field="tradeName" style="width:100%; padding:6px;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Common Name</label>
              <input type="text" data-create-field="commonName" style="width:100%; padding:6px;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">
                <input type="checkbox" data-create-field="commonNameUserDefined">
                Common Name User Defined
              </label>
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Formulation</label>
              <input type="text" data-create-field="formulation" style="width:100%; padding:6px;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">EPA Registration Number</label>
              <input type="text" data-create-field="epaRegistrationNumber" style="width:100%; padding:6px;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">
                <input type="checkbox" data-create-field="deleted">
                Deleted
              </label>
            </div>

            <div style="display:flex; gap:8px;">
              <button type="button" class="save-created-ct-btn">Save New Control Technique</button>
              <button type="button" class="cancel-create-ct-form-btn">Cancel</button>
            </div>
          </div>

          <div style="margin-top:16px; display:flex; gap:8px;">
            <button type="button" class="use-selected-ct-btn">Use Selected Control Technique</button>
            <button type="button" class="close-ct-modal-btn">Cancel</button>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      //if (e.target === modal || e.target.closest(".close-ct-modal-btn")) {
      //Prevents Window Closing in White Space
      if (e.target.closest(".close-ct-modal-btn")) {
        closeControlTechniqueModal();
      }
    });

    return modal;
  }

  function closeControlTechniqueModal() {
    const modal = document.getElementById("control-technique-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.__selectedControlTechnique = null;
    modal.__targetContainer = null;
  }

  async function fetchControlTechniqueOptions(searchDisplayName) {
    const params = new URLSearchParams();
    if (searchDisplayName) {
      params.append("searchDisplayName", searchDisplayName);
    }

    const url = `https://localhost:7144/api/Treatments/control-technique-options?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch control techniques: ${response.status}`);
    }

    return await response.json();
  }
  
  function wireControlTechniqueModal(modal) {
    if (modal.__ctModalBound) return;
    modal.__ctModalBound = true;

    const searchBox = modal.querySelector("#ct-search-box");
    const results = modal.querySelector("#ct-modal-results");
    const useBtn = modal.querySelector(".use-selected-ct-btn");
    const createCta = modal.querySelector("#ct-create-cta");
    const createForm = modal.querySelector("#ct-create-form");
    const showCreateBtn = modal.querySelector(".show-create-ct-form-btn");
    const cancelCreateBtn = modal.querySelector(".cancel-create-ct-form-btn");
    const saveCreatedBtn = modal.querySelector(".save-created-ct-btn");

    let timer = null;

    searchBox.addEventListener("input", function () {
      clearTimeout(timer);

      timer = setTimeout(async () => {
        const term = searchBox.value.trim();
        modal.__selectedControlTechnique = null;
        createForm.style.display = "none";

        if (!term) {
          results.innerHTML = "Type to search control techniques...";
          createCta.style.display = "none";
          modal.__ctResults = [];
          return;
        }

        try {
          const items = await fetchControlTechniqueOptions(term);
          modal.__ctResults = items || [];

          if (!items.length) {
            results.innerHTML = `<div>No control techniques found.</div>`;
            createCta.style.display = "block";
            resetCreateControlTechniqueForm(modal, term);
            return;
          }

          createCta.style.display = "none";

          results.innerHTML = items.map(item => `
            <div class="ct-option"
                data-control-technique-id="${escapeHtml(item.controlTechniqueId)}"
                style="border:1px solid #ddd; padding:8px; margin-bottom:6px; cursor:pointer;">
              <div><strong>${escapeHtml(item.displayName || `Control Technique ${item.controlTechniqueId}`)}</strong></div>
              <div style="font-size:12px; color:#666;">
                ${escapeHtml(item.typeLabel || "")} | CT: ${escapeHtml(item.controlTechniqueId)}
              </div>
            </div>
          `).join("");
        } catch (err) {
          console.error(err);
          modal.__ctResults = [];
          results.innerHTML = `<div>Failed to load control techniques.</div>`;
          createCta.style.display = "none";
        }
      }, 250);
    });

    results.addEventListener("click", function (e) {
      const option = e.target.closest(".ct-option");
      if (!option) return;

      const ctId = parseInt(option.dataset.controlTechniqueId, 10);
      const item = (modal.__ctResults || []).find(x => x.controlTechniqueId === ctId);
      if (!item) return;

      modal.__selectedControlTechnique = item;

      results.querySelectorAll(".ct-option").forEach(el => {
        el.style.background = "";
        el.style.borderColor = "#ddd";
      });

      option.style.background = "#eef6ff";
      option.style.borderColor = "#66a3ff";
    });

    showCreateBtn.addEventListener("click", function () {
      createForm.style.display = "block";
    });

    cancelCreateBtn.addEventListener("click", function () {
      createForm.style.display = "none";
    });

    saveCreatedBtn.addEventListener("click", async function () {
      const container = modal.__targetContainer;
      if (!container) return;

      const getCreateValue = (field) =>
        createForm.querySelector(`[data-create-field="${field}"]`)?.value?.trim() ?? "";

      const getCreateChecked = (field) =>
        !!createForm.querySelector(`[data-create-field="${field}"]`)?.checked;

      const payload = {
        controlTechniqueId: null,
        isMixture: false,
        pesticides: [
          {
            pesticideId: null,
            tradeName: getCreateValue("tradeName"),
            commonName: getCreateValue("commonName"),
            commonNameUserDefined: getCreateChecked("commonNameUserDefined"),
            formulation: getCreateValue("formulation"),
            epaRegistrationNumber: getCreateValue("epaRegistrationNumber"),
            deleted: getCreateChecked("deleted")
          }
        ],
        biologicalControls: [],
        culturalPractices: []
      };

      if (!payload.pesticides[0].tradeName && !payload.pesticides[0].commonName) {
        alert("Please enter at least a Trade Name or Common Name.");
        return;
      }

      try {
        saveCreatedBtn.disabled = true;
        const saved = await saveNewControlTechnique(payload);

        closeControlTechniqueModal();
        await reloadTableData(container);

        // Optional:
        // if your API returns the new CT id and you want to target it later,
        // we can add that next.
      } catch (err) {
        console.error(err);
        alert("Failed to create control technique. Check console for details.");
      } finally {
        saveCreatedBtn.disabled = false;
      }
    });

    useBtn.addEventListener("click", function () {
      const selected = modal.__selectedControlTechnique;
      const container = modal.__targetContainer;

      if (!selected || !container) {
        alert("Please select a control technique first.");
        return;
      }

      insertNewTreatmentRow(selected, container);
      closeControlTechniqueModal();
    });
  }

  function renderRowsTable(rows) {
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
        <div style="margin-top:12px;">
          <button type="button" class="insert-treatment-btn">
            Add Treatment
          </button>
        </div>
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

  //Add 4-10-2026
  function renderRowsFromStoredState(container) {
      const rows = container.__pesticideRows || [];
      container.innerHTML = renderRowsTable(rows);
      container.__pesticideTableEventsBound = false;
      wireTableEvents(container);
    }

    function resetCreateControlTechniqueForm(modal, searchTerm = "") {
    const form = modal.querySelector("#ct-create-form");
    if (!form) return;

    form.style.display = "none";

    const setValue = (field, value) => {
      const el = form.querySelector(`[data-create-field="${field}"]`);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = !!value;
      } else {
        el.value = value ?? "";
      }
    };

    setValue("tradeName", searchTerm || "");
    setValue("commonName", "");
    setValue("commonNameUserDefined", false);
    setValue("formulation", "");
    setValue("epaRegistrationNumber", "");
    setValue("deleted", false);
  }

  async function saveNewControlTechnique(payload) {
    const response = await fetch("https://localhost:7144/api/Treatments/save-control-technique", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Create control technique failed: ${response.status} ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function openControlTechniqueModal(container) {
    const modal = ensureControlTechniqueModal();
    modal.style.display = "flex";
    modal.__targetContainer = container;
    modal.__selectedControlTechnique = null;
    modal.__ctResults = [];

    const searchBox = modal.querySelector("#ct-search-box");
    const results = modal.querySelector("#ct-modal-results");
    const createCta = modal.querySelector("#ct-create-cta");

    searchBox.value = "";
    searchBox.focus();
    results.innerHTML = "Type to search control techniques...";
    createCta.style.display = "none";

    resetCreateControlTechniqueForm(modal);

    wireControlTechniqueModal(modal);
  }

  function insertNewTreatmentRow(selectedCt, container) {
    const pestId = parseInt(container.dataset.pestId, 10) || 0;
    const siteId = parseInt(container.dataset.siteId, 10) || 0;
    const guidelineId = parseInt(container.dataset.guidelineId, 10) || 0;

    const firstPesticide = (selectedCt.pesticides || [])[0] || null;

    const newRow = {
      treatmentId: 0,
      controlTechniqueId: selectedCt.controlTechniqueId ?? 0,
      pesticideId: firstPesticide?.pesticideId ?? 0,
      pestId,
      siteId,

      treatment: {
        treatmentId: 0,
        controlTechniqueId: selectedCt.controlTechniqueId ?? 0,
        pestId,
        siteId,
        guidelineId,
        deleted: false,
        siteTimings: [],
        treatmentRates: [],
        siteHarvestPeriods: [],
        pestLifeCycles: [],
        efficacyComment: null,
        applicationMethodId: null,
        efficacyId: null
      },

      pesticide: {
        pesticideId: firstPesticide?.pesticideId ?? 0,
        tradeName: firstPesticide?.tradeName ?? "",
        commonName: firstPesticide?.commonName ?? "",
        epaRegistrationNumber: firstPesticide?.epaRegistrationNumber ?? "",
        formulation: firstPesticide?.formulation ?? "",
        sitePesticide: []
      },

      matchingRates: [],
      product: selectedCt.displayName || formatProductName(firstPesticide) || "New Control Technique",
      siteTimings: "",
      rate: "",
      rei: "",
      phi: "",
      resistance: formatResistance(firstPesticide),
      efficacy: "",
      comments: ""
    };

    if (!container.__pesticideRows) {
      container.__pesticideRows = [];
    }

    container.__pesticideRows.unshift(newRow);

    renderRowsFromStoredState(container);

    const firstRow = container.querySelector("tr.data-row");
    if (firstRow) {
      ensureEditMetadata(container)
        .then(() => enterEditMode(firstRow, container))
        .catch(err => {
          console.error("Failed to load metadata for new row:", err);
        });
    }
  }

  // =========================================================
  // Comment Modal
  // =========================================================

  function ensureCommentSearchModal() {
    let modal = document.getElementById("comment-search-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "comment-search-modal";
    modal.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.45);
      z-index:9999;
      align-items:center;
      justify-content:center;
      padding:24px;
      box-sizing:border-box;
    `;

    modal.innerHTML = `
      <div style="
        background:#fff;
        width:min(1100px, 96vw);
        height:min(88vh, 900px);
        border-radius:8px;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        min-height:0;
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:16px 16px 12px 16px;
          border-bottom:1px solid #ddd;
          flex:0 0 auto;
        ">
          <h3 style="margin:0;">Comments</h3>
          <button type="button" class="close-comment-search-modal-btn">Close</button>
        </div>

        <div style="
          padding:12px 16px 0 16px;
          flex:1 1 auto;
          min-height:0;
          display:grid;
          grid-template-columns:minmax(0, 1.2fr) minmax(320px, 1fr);
          gap:16px;
          overflow:hidden;
        ">
          <!-- LEFT SIDE -->
          <div style="
            display:flex;
            flex-direction:column;
            min-height:0;
            overflow:hidden;
          ">
            <div id="comment-search-context" style="
              font-size:12px;
              color:#666;
              margin-bottom:12px;
              padding:8px 10px;
              background:#f8f8f8;
              border:1px solid #e3e3e3;
              border-radius:4px;
              flex:0 0 auto;
            "></div>

            <div style="
              display:grid;
              grid-template-columns:2fr 1fr;
              gap:8px;
              margin-bottom:12px;
              flex:0 0 auto;
            ">
              <div>
                <label style="display:block; font-size:12px;">Search Comment Text</label>
                <input type="text"
                      id="comment-search-text"
                      placeholder="Search within comment text..."
                      style="width:100%; padding:8px; box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block; font-size:12px;">Search CommentId</label>
                <input type="text"
                      id="comment-search-id"
                      placeholder="e.g. 123"
                      style="width:100%; padding:8px; box-sizing:border-box;">
              </div>
            </div>

            <div style="
              display:flex;
              gap:8px;
              margin-bottom:12px;
              flex:0 0 auto;
            ">
              <button type="button" class="start-new-comment-btn">New Comment</button>
              <button type="button" class="use-selected-comment-btn">Use Selected Comment</button>
            </div>

            <div id="comment-search-results" style="
              flex:1 1 auto;
              min-height:0;
              overflow-y:auto;
              overflow-x:hidden;
              border:1px solid #ddd;
              padding:8px;
              background:#fafafa;
              border-radius:4px;
            ">
              Loading comments...
            </div>
          </div>

          <!-- RIGHT SIDE -->
          <div style="
            border-left:1px solid #ddd;
            padding-left:16px;
            min-height:0;
            overflow-y:auto;
          ">
            <div style="font-weight:600; margin-bottom:8px;">Comment Editor</div>

            <div style="font-size:12px; color:#666; margin-bottom:8px;" id="comment-form-status">
              Select a comment or create a new one.
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">CommentId</label>
              <input type="text" id="comment-form-id" disabled style="width:100%; padding:8px; box-sizing:border-box; background:#f5f5f5;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Index Number (Optional)</label>
              <input type="text" id="comment-form-indexNumber" style="width:100%; padding:8px; box-sizing:border-box;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Comment Text</label>
              <textarea id="comment-form-text" rows="28" style="width:100%; padding:8px; box-sizing:border-box;"></textarea>
            </div>

            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <button type="button" class="save-comment-modal-btn">Save Comment</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      if (e.target.closest(".close-comment-search-modal-btn")) {
        closeCommentSearchModal();
      }
    });

    return modal;
  }

  function closeCommentSearchModal() {
    const modal = document.getElementById("comment-search-modal");
    if (!modal) return;

    modal.style.display = "none";
    modal.__selectedComment = null;
    modal.__targetRowKey = null;
    modal.__targetContainer = null;
    modal.__targetCommentList = null;
  }

  async function fetchCommentOptions(guidelineId) {
    const url = `https://localhost:7144/api/Treatments/comment-options?guidelineId=${encodeURIComponent(guidelineId)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }

    return await response.json();
  }

  function filterCommentOptions(items, textTerm, idTerm) {
    const textSearch = clean(textTerm).toLowerCase();
    const idSearch = clean(idTerm);

    return (items || []).filter(item => {
      const commentText = clean(item.commentText).toLowerCase();
      const indexNumber = clean(item.indexNumber).toLowerCase();
      const commentIdText = String(item.commentId ?? "");

      const matchesText = !textSearch ||
        commentText.includes(textSearch) ||
        indexNumber.includes(textSearch);

      const matchesId = !idSearch ||
        commentIdText.includes(idSearch);

      return matchesText && matchesId;
    });
  }

  function renderCommentSearchResults(items) {
    if (!items.length) {
      return `<div style="color:#666;">No comments found.</div>`;
    }

    return items.map(item => {
      const pests = (item.pests || [])
        .map(p => p.name ? `${p.name} (${p.pestId})` : `Pest ${p.pestId}`)
        .join(", ");

      return `
        <div class="comment-search-option"
            data-comment-id="${escapeHtml(item.commentId)}"
            style="border:1px solid #ddd; padding:10px; margin-bottom:8px; cursor:pointer;">
          <div style="font-size:12px; color:#666; margin-bottom:4px;">
            <strong>CommentId:</strong> ${escapeHtml(item.commentId)}
            ${item.indexNumber ? ` | <strong>Index:</strong> ${escapeHtml(item.indexNumber)}` : ""}
            ${item.siteId ? ` | <strong>SiteId:</strong> ${escapeHtml(item.siteId)}` : ""}
          </div>
          <div style="margin-bottom:6px;">
            ${escapeHtml(item.commentText || "")}
          </div>
          <div style="font-size:12px; color:#666;">
            <strong>Pests:</strong> ${escapeHtml(pests || "None")}
          </div>
        </div>
      `;
    }).join("");
  }

  async function openCommentSearchModal(row, container, targetListEl, existingComment = null) {
    //async function openCommentSearchModal(row, container, targetListEl) {
    const modal = ensureCommentSearchModal();
    modal.style.display = "flex";

    modal.__selectedComment = null;
    modal.__editingComment = null;
    modal.__targetRowKey = getRowKey(row);
    modal.__targetContainer = container;
    modal.__targetCommentList = targetListEl;

    const guidelineId = row?.treatment?.guidelineId ?? container?.dataset?.guidelineId ?? "";
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? "";
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? "";

    modal.querySelector("#comment-search-context").innerHTML = `
      <strong>GuidelineId:</strong> ${escapeHtml(guidelineId)}
      &nbsp; | &nbsp;
      <strong>SiteId:</strong> ${escapeHtml(siteId)}
      &nbsp; | &nbsp;
      <strong>PestId:</strong> ${escapeHtml(pestId)}
    `;

    const resultsEl = modal.querySelector("#comment-search-results");
    const textInput = modal.querySelector("#comment-search-text");
    const idInput = modal.querySelector("#comment-search-id");

    textInput.value = "";
    idInput.value = "";
    resultsEl.innerHTML = "Loading comments...";

    resetCommentForm(modal, row);

    try {
      const items = await fetchCommentOptions(guidelineId);
      modal.__commentOptions = items || [];
      modal.__filteredCommentOptions = items || [];
      resultsEl.innerHTML = renderCommentSearchResults(modal.__commentOptions);
    } catch (err) {
      console.error(err);
      resultsEl.innerHTML = `<div style="color:#900;">Failed to load comments.</div>`;
    }

    if (existingComment) {
      modal.__selectedComment = existingComment;
      modal.__editingComment = existingComment;
      loadCommentIntoForm(modal, existingComment);

      requestAnimationFrame(() => {
        focusCommentSearchOption(resultsEl, existingComment.commentId);
      });

      const selectedId = Number(existingComment.commentId);
      const selectedOption = Array.from(
        resultsEl.querySelectorAll(".comment-search-option")
      ).find(el => Number(el.dataset.commentId) === selectedId);

      if (selectedOption) {
        resultsEl.querySelectorAll(".comment-search-option").forEach(el => {
          el.style.background = "";
          el.style.borderColor = "#ddd";
        });

        selectedOption.style.background = "#eef6ff";
        selectedOption.style.borderColor = "#66a3ff";
      }
    }

    wireCommentSearchModal(modal);
  }

  function wireCommentSearchModal(modal) {
    if (modal.__commentSearchBound) return;
    modal.__commentSearchBound = true;

    const textInput = modal.querySelector("#comment-search-text");
    const idInput = modal.querySelector("#comment-search-id");
    const resultsEl = modal.querySelector("#comment-search-results");
    const useBtn = modal.querySelector(".use-selected-comment-btn");
    const newBtn = modal.querySelector(".start-new-comment-btn");
    const saveBtn = modal.querySelector(".save-comment-modal-btn");

    function refreshResults() {
      const filtered = filterCommentOptions(
        modal.__commentOptions || [],
        textInput.value,
        idInput.value
      );

      modal.__filteredCommentOptions = filtered;
      resultsEl.innerHTML = renderCommentSearchResults(filtered);
    }

    textInput.addEventListener("input", refreshResults);
    idInput.addEventListener("input", refreshResults);

    newBtn.addEventListener("click", function () {
      const container = modal.__targetContainer;
      const rowKey = modal.__targetRowKey;
      const row = (container?.__pesticideRows || []).find(r => getRowKey(r) === rowKey) || null;
      resetCommentForm(modal, row);
    });

    resultsEl.addEventListener("click", function (e) {
      const option = e.target.closest(".comment-search-option");
      if (!option) return;

      const commentId = parseInt(option.dataset.commentId, 10);
      const item = (modal.__filteredCommentOptions || modal.__commentOptions || [])
        .find(x => Number(x.commentId) === commentId);

      if (!item) return;

      modal.__selectedComment = item;
      loadCommentIntoForm(modal, item);

      resultsEl.querySelectorAll(".comment-search-option").forEach(el => {
        el.style.background = "";
        el.style.borderColor = "#ddd";
      });

      option.style.background = "#eef6ff";
      option.style.borderColor = "#66a3ff";
    });

    saveBtn.addEventListener("click", async function () {
      const defaults = modal.__commentFormDefaults || {};
      const editing = modal.__editingComment || null;

      const payload = {
        commentId: editing?.commentId ?? null,
        siteId: editing?.siteId ?? defaults.siteId ?? null,
        guidelineId: editing?.guidelineId ?? defaults.guidelineId ?? null,
        indexNumber: clean(modal.querySelector("#comment-form-indexNumber").value),
        commentText: clean(modal.querySelector("#comment-form-text").value),
        pestComment: Array.isArray(editing?.pests) && editing.pests.length
          ? editing.pests.map(p => p.pestId)
          : (defaults.pestIds || [])
      };

      if (!payload.commentText) {
        alert("Comment text is required.");
        return;
      }

      try {
        saveBtn.disabled = true;

        const saved = await saveComment(payload);
        const savedCommentId = saved?.commentId;

        if (!savedCommentId) {
          alert("Comment saved, but no CommentId was returned.");
          return;
        }

        const refreshed = {
          commentId: savedCommentId,
          siteId: payload.siteId,
          guidelineId: payload.guidelineId,
          indexNumber: payload.indexNumber,
          commentText: payload.commentText,
          pests: (payload.pestComment || []).map(id => ({ pestId: id, name: null }))
        };

        // update modal selection
        modal.__selectedComment = refreshed;
        modal.__editingComment = refreshed;

        // merge/update local option list
        const existing = (modal.__commentOptions || []).find(x => Number(x.commentId) === Number(savedCommentId));
        if (existing) {
          Object.assign(existing, refreshed);
        } else {
          modal.__commentOptions = [refreshed, ...(modal.__commentOptions || [])];
        }

        refreshResults();
        loadCommentIntoForm(modal, refreshed);
        requestAnimationFrame(() => {
          focusCommentSearchOption(resultsEl, refreshed.commentId);
        });
        syncEditedCommentBlock(modal.__targetCommentList, refreshed);

        alert("Comment saved.");
      } catch (err) {
        console.error(err);
        alert("Failed to save comment. Check console for details.");
      } finally {
        saveBtn.disabled = false;
      }
    });

    useBtn.addEventListener("click", function () {
      const selected = modal.__selectedComment;
      const targetList = modal.__targetCommentList;

      if (!selected || !targetList) {
        alert("Please select or save a comment first.");
        return;
      }

      // prevent duplicate insert in the same row editor
      const alreadyThere = Array.from(targetList.querySelectorAll(".comment-editor-block"))
        .some(el => Number(el.dataset.commentId) === Number(selected.commentId));

      if (!alreadyThere) {
        targetList.insertAdjacentHTML("beforeend", renderExistingCommentEditorBlock(selected));
      }

      closeCommentSearchModal();
    });
  }

  





  function renderExistingCommentEditorBlock(comment) {
    const pests = (comment.pests || [])
      .map(p => p.name ? `${p.name} (${p.pestId})` : `Pest ${p.pestId}`)
      .join(", ");

    return `
      <div class="comment-editor-block existing-linked-comment"
          data-comment-index="linked"
          data-comment-id="${escapeHtml(comment.commentId ?? 0)}"
          data-index-number="${escapeHtml(comment.indexNumber ?? "")}"
          data-comment-text="${escapeHtml(comment.commentText || comment.comment || "")}"
          style="border:1px solid #66a3ff; padding:10px; margin-bottom:8px; background:#f5faff;">

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>CommentId:</strong> ${escapeHtml(comment.commentId ?? 0)}
          ${comment.indexNumber ? ` | <strong>Index:</strong> ${escapeHtml(comment.indexNumber)}` : ""}
        </div>

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>SiteId:</strong> ${escapeHtml(comment.siteId ?? "")}
          &nbsp; | &nbsp;
          <strong>GuidelineId:</strong> ${escapeHtml(comment.guidelineId ?? "")}
        </div>

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>Pests:</strong> ${escapeHtml(pests || "None")}
        </div>

        <div style="white-space:pre-wrap; margin-bottom:8px;">
          ${escapeHtml(comment.commentText || "")}
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="edit-linked-comment-btn">Edit</button>
          <button type="button" class="remove-comment-block-btn">Remove</button>
        </div>
      </div>
    `;
  }

  //Added 4/20/2026
  function resetCommentForm(modal, row) {
    modal.__editingComment = null;

    const guidelineId = row?.treatment?.guidelineId ?? row?.guidelineId ?? null;
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? null;
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? null;

    modal.querySelector("#comment-form-id").value = "";
    modal.querySelector("#comment-form-indexNumber").value = "";
    modal.querySelector("#comment-form-text").value = "";
    modal.querySelector("#comment-form-status").textContent = "Creating a new comment.";

    modal.__commentFormDefaults = {
      guidelineId,
      siteId,
      pestIds: pestId ? [Number(pestId)] : []
    };
  }

  function loadCommentIntoForm(modal, comment) {
    modal.__editingComment = comment || null;

    modal.querySelector("#comment-form-id").value = comment?.commentId ?? "";
    modal.querySelector("#comment-form-indexNumber").value = comment?.indexNumber ?? "";
    modal.querySelector("#comment-form-text").value = comment?.commentText ?? "";
    modal.querySelector("#comment-form-status").textContent =
      comment?.commentId ? `Editing Comment ${comment.commentId}` : "Creating a new comment.";
  }

  async function saveComment(payload) {
    const response = await fetch("https://localhost:7144/api/Treatments/save-comment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Save comment failed: ${response.status} ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  //Added 4/23/2026
  function syncEditedCommentBlock(targetList, comment) {
    if (!targetList || !comment?.commentId) return;

    const block = Array.from(targetList.querySelectorAll(".comment-editor-block"))
      .find(el => Number(el.dataset.commentId) === Number(comment.commentId));

    if (!block) return;

    block.outerHTML = renderExistingCommentEditorBlock(comment);
  }
  function focusCommentSearchOption(resultsEl, commentId) {
    if (!resultsEl || !commentId) return;

    const selectedId = Number(commentId);

    const selectedOption = Array.from(
      resultsEl.querySelectorAll(".comment-search-option")
    ).find(el => Number(el.dataset.commentId) === selectedId);

    if (!selectedOption) return;

    resultsEl.querySelectorAll(".comment-search-option").forEach(el => {
      el.style.background = "";
      el.style.borderColor = "#ddd";
    });

    selectedOption.style.background = "#eef6ff";
    selectedOption.style.borderColor = "#66a3ff";

    selectedOption.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
/*
  function syncEditedCommentBlock(targetList, comment) {
    if (!targetList || !comment?.commentId) return;

    const block = Array.from(targetList.querySelectorAll(".comment-editor-block"))
      .find(el => Number(el.dataset.commentId) === Number(comment.commentId));

    if (!block) return;

    block.dataset.commentId = String(comment.commentId ?? 0);
    block.dataset.indexNumber = comment.indexNumber ?? "";
    block.dataset.commentText = comment.commentText ?? comment.comment ?? "";

    block.innerHTML = `
      <div style="font-size:12px; color:#666; margin-bottom:8px;">
        <strong>CommentId:</strong> ${escapeHtml(comment.commentId ?? 0)}
        ${comment.indexNumber ? ` | <strong>Index:</strong> ${escapeHtml(comment.indexNumber)}` : ""}
      </div>

      <div style="font-size:12px; color:#666; margin-bottom:8px;">
        <strong>SiteId:</strong> ${escapeHtml(comment.siteId ?? "")}
        &nbsp; | &nbsp;
        <strong>GuidelineId:</strong> ${escapeHtml(comment.guidelineId ?? "")}
        &nbsp; | &nbsp;
        <strong>PestId:</strong> ${
          escapeHtml(
            Array.isArray(comment.pests) && comment.pests.length
              ? comment.pests.map(p => p.pestId).join(", ")
              : ""
          )
        }
      </div>

      <div style="margin-bottom:8px; white-space:pre-wrap;">
        ${escapeHtml(comment.commentText || comment.comment || "") || "<em>No comment text</em>"}
      </div>

      <div style="display:flex; gap:8px;">
        <button type="button" class="edit-linked-comment-btn">Edit</button>
        <button type="button" class="remove-comment-block-btn">Remove</button>
      </div>
    `;
  }
*/



  // =========================================================
  // Interface?
  // =========================================================
  window.PesticideTableBuilder = {
    buildRows,
    renderTable,
    wireTableEvents
  };
})();