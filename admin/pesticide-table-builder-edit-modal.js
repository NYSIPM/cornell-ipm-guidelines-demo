(function () {
  // =========================================================
  // Edit modal for the pesticide table builder
  //  - Opens when the Edit button on a row is clicked (or a new treatment is added)
  //  - All of the field editors (rate, REI/PHI, efficacy, site timing, etc.)
  //  - Saving the row (save-row)
  // Helpers from pesticide-table-builder.js are passed in with setHelpers().
  // =========================================================
  let helpers = {};

  function setHelpers(injectedHelpers) {
    helpers = injectedHelpers || helpers;
  }

  function escapeHtml(str) {
    return helpers.escapeHtml(str);
  }

  function clean(value) {
    return helpers.clean(value);
  }

  function getRowKey(row) {
    return helpers.getRowKey(row);
  }

  function findRowByElement(tr, container) {
    return helpers.findRowByElement(tr, container);
  }

  function renderIdBlock(row, showTreatmentRateIds) {
    return helpers.renderIdBlock(row, showTreatmentRateIds);
  }

  function renderModifiedDate(row) {
    return helpers.renderModifiedDate(row);
  }

  function getEfficacyCommentText(treatment) {
    return helpers.getEfficacyCommentText(treatment);
  }

  function reloadTableData(container) {
    return helpers.reloadTableData(container);
  }

  // =========================================================
  // Field Editors
  // =========================================================

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

  // =========================================================
  // Locked sections
  // These panels are shown in Edit Treatment for convenience but are NOT part of the treatment:
  //   REI / PHI    -> SitePesticide (this product on this site)
  //   Designation  -> PesticideGuideline (this product in this guideline)
  // They show read-only until the user clicks Edit; only then are they included in save-row.
  // =========================================================
  function renderSitePesticideReadOnly(row, kind) {
    const sp = getPrimarySitePesticide(row);
    const value = clean(sp?.[kind]);
    const time = clean(sp?.[`${kind}Time`]);

    const parts = [];
    if (value) parts.push(time ? `${value} ${time}` : value);
    if (sp?.[`${kind}ReferToLabel`]) parts.push("Refer To Label");
    if (sp?.[`${kind}UntilDry`]) parts.push("Until Dry");

    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>Shared SitePesticide</strong>
      </div>
      <div style="margin-bottom:8px;">
        ${escapeHtml(parts.join(" / ")) || "<em>None</em>"}
      </div>
    `;
  }

  function renderDesignationReadOnly(row) {
    return `
      <div style="font-size:12px; color:#666; margin-bottom:6px;">
        <strong>Shared PesticideGuideline</strong>
      </div>
      <div style="margin-bottom:8px;">
        <div><strong>Conventional:</strong> ${row?.conventional ? "Yes" : "No"}</div>
        <div><strong>Organic:</strong> ${row?.organic ? "Yes" : "No"}</div>
      </div>
    `;
  }

  function renderConventionalOrganicEditor(row) {
    const conventional = row?.conventional ?? false;
    const organic = row?.organic ?? false;

    return `
      <label style="display:block; margin-bottom:6px; font-size:12px;">
        <input type="checkbox" data-field="conventional" ${conventional ? "checked" : ""}>
        Conventional
      </label>

      <label style="display:block; font-size:12px;">
        <input type="checkbox" data-field="organic" ${organic ? "checked" : ""}>
        Organic
      </label>
    `;
  }

  const LOCKED_SECTIONS = {
    rei: {
      title: "REI",
      sharedNote: "Shared by every treatment using this product on this site.",
      saveNote: "Saving will update the REI for this product on this site.",
      readOnly: row => renderSitePesticideReadOnly(row, "rei"),
      editor: row => renderReiEditor(row)
    },
    phi: {
      title: "PHI",
      sharedNote: "Shared by every treatment using this product on this site.",
      saveNote: "Saving will update the PHI for this product on this site.",
      readOnly: row => renderSitePesticideReadOnly(row, "phi"),
      editor: row => renderPhiEditor(row)
    },
    designation: {
      title: "Designation",
      sharedNote: "Shared by every treatment using this product for this guideline.",
      saveNote: "Saving will update the designation for this product for this guideline.",
      readOnly: row => renderDesignationReadOnly(row),
      editor: row => renderConventionalOrganicEditor(row)
    }
  };

  function renderLockedSectionBody(row, key, unlocked) {
    const def = LOCKED_SECTIONS[key];

    if (unlocked) {
      return `
        <div style="font-size:12px; color:#7a4b00; background:#fff4e5; border:1px solid #f0c27a; border-radius:4px; padding:4px 6px; margin-bottom:8px;">
          ${escapeHtml(def.saveNote)}
        </div>
        ${def.editor(row)}
      `;
    }

    return `
      ${def.readOnly(row)}
      <div style="font-size:12px; color:#666;">
        ${escapeHtml(def.sharedNote)}
      </div>
    `;
  }

  function renderLockedSection(row, key) {
    return renderEditSection(LOCKED_SECTIONS[key].title, `
      <div class="locked-section-body">
        ${renderLockedSectionBody(row, key, false)}
      </div>
    `, {
      attrs: `data-locked-section="${key}" data-unlocked="false"`,
      action: `<button type="button" class="toggle-locked-section-btn" style="font-size:12px;">Edit</button>`
    });
  }

  //Switches a locked panel between read-only and editable. Cancel throws away any changes.
  function toggleLockedSection(section, row) {
    const key = section.dataset.lockedSection;
    const unlocking = section.dataset.unlocked !== "true";

    section.dataset.unlocked = unlocking ? "true" : "false";
    section.querySelector(".locked-section-body").innerHTML = renderLockedSectionBody(row, key, unlocking);
    section.querySelector(".toggle-locked-section-btn").textContent = unlocking ? "Cancel" : "Edit";
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

          <div style="
              display:grid;
              grid-template-columns: 1.3fr 1fr 2fr;
              gap:8px;
              align-items:end;
              margin-bottom:6px;">
            <div>
              <label style="display:block; font-size:12px;">Concentration</label>
              <input type="text"
                    data-field="concentration"
                    value=""
                    style="width:100%;">
            </div>

            <div>
              <label style="display:block; font-size:12px;">UnitId</label>
              <select data-field="unitId" style="width:100%;">
                ${renderSelectOptions(units, null, "-")}
              </select>
            </div>

            <div>
              <label style="display:block; font-size:12px;">UnitAreaId</label>
              <select data-field="unitAreaId" style="width:100%;">
                ${renderSelectOptions(unitAreas, null, "-")}
              </select>
            </div>
          </div>

          <div style="margin-bottom:6px;">
            <label style="display:block; font-size:12px;">Amount Note</label>
            <input type="text"
                  data-field="amountNote"
                  value=""
                  style="width:100%;">
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
        ${row.treatmentChanged ? renderModifiedDate(row) : ""}
      </div>

      <!--
      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">RateKind</label>
        <input type="text"
              data-field="rateKind"
              value="${escapeHtml(rate.rateKind || "")}"
              style="width:100%;">
      </div>
      -->

      
      <div style="
          display:grid;
          grid-template-columns: 1.3fr 1fr 2fr;
          gap:8px;
          align-items:end;
          margin-bottom:6px;">
        <div>
          <label style="display:block; font-size:12px;">Concentration</label>
          <input type="text"
                data-field="concentration"
                value="${escapeHtml(rate.concentration || "")}"
                style="width:100%;">
        </div>

        <div>
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

      <div style="margin-bottom:6px;">
        <label style="display:block; font-size:12px;">Amount Note</label>
        <input type="text"
              data-field="amountNote"
              value="${escapeHtml(rate.amountNote || "")}"
              style="width:100%;">
      </div>

    </div>
  `).join("");
}

  //Fetches the Meta Data JSON File
  async function ensureEditMetadata(container) {
    if (container.__editMetadata) {
      return container.__editMetadata;
    }

    const guidelineId = container.dataset.guidelineId;

    const url = window.TreatmentApiUrl(`/api/Treatments/edit-metadata?guidelineId=${guidelineId || ""}`);
    console.log("Fetching edit metadata:", url);

    //const response = await fetch(url);
    const authHeaders = await window.TreatmentAuth.authHeaders();
    const response = await fetch(url, {
      headers: {
        ...authHeaders
      }
    });
  
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

      <label style="display:block; font-size:12px; color:#666; margin-top:8px;">Efficacy</label>
      <select data-field="efficacyId" style="width:100%;">
        ${renderSelectOptions(efficacies, selectedEfficacyId, "-")}
      </select>

      <label style="display:block; font-size:12px; color:#666; margin-top:8px;">Efficacy Comment</label>
      <textarea data-field="efficacyComment" rows="3" style="width:100%; box-sizing:border-box;">${escapeHtml(getEfficacyCommentText(row?.treatment))}</textarea>
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

  // =========================================================
  // Edit Modal
  // =========================================================

  function ensureEditModal() {
    let modal = document.getElementById("treatment-edit-modal");
    if (modal) return modal;

    //z-index is below the product and comment modals (9999) so they open on top of this one
    modal = document.createElement("div");
    modal.id = "treatment-edit-modal";
    modal.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.45);
      z-index:9000;
      align-items:center;
      justify-content:center;
      padding:24px;
      box-sizing:border-box;
    `;

    //Input/select/textarea borders and sizing come from pesticide-table-builder-modals.css
    modal.innerHTML = `
      <div class="treatment-edit-form" style="
        background:#fff;
        width:min(1300px, 96vw);
        max-height:92vh;
        border-radius:8px;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
        display:flex;
        flex-direction:column;
        overflow:hidden;
      ">
        <div class="treatment-edit-header" style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:12px;
          padding:16px 16px 12px 16px;
          border-bottom:1px solid #ddd;
          flex:0 0 auto;
        "></div>

        <div class="treatment-edit-body" style="
          padding:16px;
          overflow-y:auto;
          flex:1 1 auto;
          min-height:0;
        "></div>

        <div style="
          display:flex;
          justify-content:flex-end;
          gap:8px;
          padding:12px 16px;
          border-top:1px solid #ddd;
          flex:0 0 auto;
        ">
          <button type="button" class="cancel-edit-modal-btn">Cancel</button>
          <button type="button" class="save-edit-modal-btn">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    wireEditModal(modal);

    return modal;
  }

  //options.action - html shown to the right of the title (e.g. an Edit button)
  //options.attrs  - extra attributes for the section's outer div
  function renderEditSection(title, content, options = {}) {
    return `
      <div ${options.attrs || ""} style="border:1px solid #ddd; border-radius:4px; padding:10px; min-width:0; flex:1 1 auto; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
          <div style="font-weight:600;">${escapeHtml(title)}</div>
          ${options.action || ""}
        </div>
        ${content}
      </div>
    `;
  }

  function renderEditGrid(sections) {
    return `
      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
        gap:12px;
        margin-bottom:12px;
      ">
        ${sections.join("")}
      </div>
    `;
  }

  //One row of sections that share the width by "flex" (grow shrink min-width), e.g. ["2 1 400px", html].
  //Sections wrap onto the next line when the screen is too narrow for their min-widths.
  function renderEditRow(items) {
    return `
      <div style="
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        margin-bottom:12px;
        align-items:stretch;
      ">
        ${items.map(([flex, html]) => `<div style="flex:${flex}; min-width:0; display:flex; flex-direction:column;">${html}</div>`).join("")}
      </div>
    `;
  }

  function renderEditFormHeader(row) {
    return `
      <div>
        <h3 style="margin:0 0 4px 0;">${row.treatmentId && Number(row.treatmentId) > 0 ? "Edit Treatment" : "New Treatment"}</h3>
        <div style="font-size:15px;">${escapeHtml(row.product)}</div>
        ${row.pesticide && row.resistance ? `
          <div style="font-size:12px; color:#666; margin-top:2px;">
            <strong>Resistance Mgmt.:</strong> ${escapeHtml(row.resistance)}
          </div>` : ""}
        <button type="button" class="edit-product-btn" style="margin-top:8px;">
          Edit Control Technique
        </button>
      </div>

      <div style="font-size:12px; color:#666; text-align:right; flex:0 0 auto;">
        ${renderIdBlock(row, true)}
      </div>
    `;
  }

  function renderEditFormBody(row, metadata) {
    const commentEditor = `
      <div style="border:1px solid #ddd; border-radius:4px; padding:10px;">
        ${window.PesticideTableBuilderComments.renderCommentEditor(row)}
      </div>
    `;

    if (!row.pesticide) {
      return `
        ${renderEditGrid([
          renderEditSection(row.controlTechniqueType || "Control Technique", `
            <div style="line-height:1.3;">
              ${escapeHtml(row.description || "") || "<em>No description</em>"}
            </div>
          `),
          renderEditSection("Efficacy", renderEfficacyEditor(row, metadata)),
          renderEditSection("Site Timing", renderSiteTimingEditor(row, metadata))
        ])}
        ${commentEditor}
      `;
    }

    return `
      ${renderEditRow([
        ["2.2 1 400px", renderEditSection("Rate", renderRateEditor(row, metadata))],
        ["1 1 160px", renderLockedSection(row, "rei")],
        ["1 1 160px", renderLockedSection(row, "phi")],
        ["1.3 1 200px", renderEditSection("Efficacy", renderEfficacyEditor(row, metadata))]
      ])}

      ${renderEditGrid([
        renderLockedSection(row, "designation"),
        renderEditSection("Application Method", renderApplicationMethodEditor(row, metadata)),
        renderEditSection("Site Timing", renderSiteTimingEditor(row, metadata))
      ])}

      ${commentEditor}
    `;
  }

  //tr is the table row that was clicked. It gets highlighted while the modal is open,
  //and the "is-editing" class tells cms.js not to refresh this table while the user is editing.
  async function openEditModal(row, container, tr = null) {
    if (!row || !container) return;

    try {
      await ensureEditMetadata(container);
    } catch (err) {
      console.error("Failed to load metadata:", err);
      alert("Failed to load edit options.");
      return;
    }

    const modal = ensureEditModal();
    clearEditingRow(modal);

    modal.__row = row;
    modal.__container = container;
    modal.__tr = tr;

    if (tr) {
      tr.classList.add("is-editing");
      tr.style.outline = "2px solid #66a3ff";
    }

    const body = modal.querySelector(".treatment-edit-body");
    modal.querySelector(".treatment-edit-header").innerHTML = renderEditFormHeader(row);
    body.innerHTML = renderEditFormBody(row, container.__editMetadata);
    body.scrollTop = 0;

    modal.style.display = "flex";
  }

  function clearEditingRow(modal) {
    if (modal.__tr) {
      modal.__tr.classList.remove("is-editing");
      modal.__tr.style.outline = "";
    }
    modal.__tr = null;
  }

  function closeEditModal() {
    const modal = document.getElementById("treatment-edit-modal");
    if (!modal) return;

    modal.style.display = "none";
    clearEditingRow(modal);
    modal.__row = null;
    modal.__container = null;

    //Clear the form so old inputs are never read by a later save
    modal.querySelector(".treatment-edit-body").innerHTML = "";
  }

  //The product modal reloads the table after it saves.
  //Re-open this modal on the refreshed row so the user stays where they were.
  async function reloadAfterProductSave(container) {
    const modal = document.getElementById("treatment-edit-modal");
    const rowKey = modal?.__row ? getRowKey(modal.__row) : null;

    closeEditModal();
    await reloadTableData(container);

    const freshRow = (container.__pesticideRows || []).find(r => getRowKey(r) === rowKey);
    if (!freshRow) return;

    const freshTr = Array.from(container.querySelectorAll("tr.data-row"))
      .find(el => findRowByElement(el, container) === freshRow) || null;

    await openEditModal(freshRow, container, freshTr);
  }

  function wireEditModal(modal) {
    modal.addEventListener("click", async function (e) {
      const row = modal.__row;
      const container = modal.__container;
      if (!row || !container) return;

      if (e.target.closest(".cancel-edit-modal-btn")) {
        closeEditModal();
        return;
      }

      const saveBtn = e.target.closest(".save-edit-modal-btn");
      if (saveBtn) {
        saveBtn.disabled = true;
        try {
          await handleSaveRow(modal.querySelector(".treatment-edit-form"), row, container);
        } finally {
          saveBtn.disabled = false;
        }
        return;
      }

      const toggleLockedBtn = e.target.closest(".toggle-locked-section-btn");
      if (toggleLockedBtn) {
        toggleLockedSection(toggleLockedBtn.closest("[data-locked-section]"), row);
        return;
      }

      if (e.target.closest(".edit-product-btn")) {
        await window.PesticideTableBuilderProductModal.openProductModal(row, container, {
          escapeHtml,
          clean,
          getRowKey,
          reloadTableData: reloadAfterProductSave,
          editMetadata: container.__editMetadata
        });
        return;
      }

      //Comment buttons (Add / Edit / Remove) - see pesticide-table-builder-comments.js
      await window.PesticideTableBuilderComments.handleCommentClick(e, container, row);
    });
  }

  // =========================================================
  // SAVE - added 3/30/2026
  // form is the edit modal; every field is looked up inside it
  // =========================================================
  async function handleSaveRow(form, row, container) {
    if (form.dataset.isSaving === "true") {
      console.log("Save already in progress for this row.");
      return;
    }
    form.dataset.isSaving = "true";

    console.log("Saving row:", row);

    const treatment = row.treatment || {};
    const getRowField = (field) => form.querySelector(`[data-field="${field}"]`)?.value ?? "";
    const getRowChecked = (field) =>
      Array.from(form.querySelectorAll(`[data-field="${field}"]`))
        .some(el => el.checked);
    const rateBlocks = form.querySelectorAll(".rate-editor-block");

    const commentBlocks = form.querySelectorAll(".comment-editor-block");
    const linkedComments = Array.from(commentBlocks)
      .map(block => {
        const commentId = parseInt(block.dataset.commentId, 10) || 0;
        return commentId > 0 ? { commentId } : null;
      })
      .filter(Boolean);

    const updatedRates = [];

    const getCheckedValues = (field) =>
      Array.from(form.querySelectorAll(`[data-field="${field}"]:checked`))
    .map(el => parseInt(el.value, 10))
    .filter(Number.isFinite);

    const selectedSiteTimingIds = getCheckedValues("siteTimingIds");

    //Checks to see if it is a pesticide.
    const hasPesticide = parseInt(row.pesticideId, 10) > 0;

    //REI/PHI/Designation panels start read-only; "unlocked" means the user clicked Edit on that panel
    const isUnlocked = (key) =>
      form.querySelector(`[data-locked-section="${key}"]`)?.dataset.unlocked === "true";
    const reiUnlocked = isUnlocked("rei");
    const phiUnlocked = isUnlocked("phi");
    const designationUnlocked = isUnlocked("designation");
    const storedSitePesticide = getPrimarySitePesticide(row);

    //I don't understand what this does?
    const parseNullableInt = (value) => {
      const n = parseInt(value, 10);
      return Number.isNaN(n) || n <= 0 ? null : n;
    };

    if (hasPesticide) {
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
    }

    const payload = {
      treatmentId: parseInt(row.treatmentId, 10) || 0,
      controlTechniqueId: parseInt(row.controlTechniqueId, 10) || 0,
      pestId: parseInt(row.pestId, 10) || 0,
      siteId: parseInt(row.siteId, 10) || 0,

      //Non-pesticide rows have no Application Method field, so keep what was already saved
      applicationMethodId: form.querySelector('[data-field="applicationMethodId"]')
        ? parseNullableInt(getRowField("applicationMethodId"))
        : (treatment.applicationMethodId ?? null),
      efficacyId: parseNullableInt(getRowField("efficacyId")),

      deleted: treatment.deleted ?? false,
      guidelineId: treatment.guidelineId ?? null,

      treatmentRates: updatedRates,

      //Use the textarea if it is there, otherwise keep what was already saved
      efficacyComment: form.querySelector('[data-field="efficacyComment"]')
        ? getRowField("efficacyComment").trim()
        : getEfficacyCommentText(treatment),

      siteTimingIds: selectedSiteTimingIds,

      siteHarvestPeriodIds: (treatment.siteHarvestPeriods || [])
        .map(x => x.siteHarvestPeriodId)
        .filter(x => x != null),

      pestLifeCycleIds: (treatment.pestLifeCycles || [])
        .map(x => x.pestLifeCycleId)
        .filter(x => x != null),

      comments: linkedComments,

      pesticide: hasPesticide
      ? {
          pesticideId: parseInt(row.pesticideId, 10) || 0,
          //Designation is not part of the treatment. Only sent when the user clicked Edit on it;
          //null means "leave the PesticideGuideline alone".
          pesticideGuideline: designationUnlocked
            ? {
                conventional: getRowChecked("conventional"),
                organic: getRowChecked("organic")
              }
            : null,
          //REI/PHI are not part of the treatment. Only sent when the user clicked Edit on one of them;
          //null means "leave the SitePesticide alone".
          sitePesticide: (reiUnlocked || phiUnlocked)
            ? {
                siteId: parseInt(row.siteId, 10) || 0,
                pesticideId: parseInt(row.pesticideId, 10) || 0,
                rei: reiUnlocked ? getRowField("rei").trim() : (storedSitePesticide?.rei ?? ""),
                reiTime: reiUnlocked ? getRowField("reiTime").trim() : (storedSitePesticide?.reiTime ?? ""),
                reiReferToLabel: reiUnlocked ? getRowChecked("reiReferToLabel") : !!storedSitePesticide?.reiReferToLabel,
                reiUntilDry: reiUnlocked ? getRowChecked("reiUntilDry") : !!storedSitePesticide?.reiUntilDry,
                phi: phiUnlocked ? getRowField("phi").trim() : (storedSitePesticide?.phi ?? ""),
                phiTime: phiUnlocked ? getRowField("phiTime").trim() : (storedSitePesticide?.phiTime ?? ""),
                phiReferToLabel: phiUnlocked ? getRowChecked("phiReferToLabel") : !!storedSitePesticide?.phiReferToLabel,
                phiUntilDry: phiUnlocked ? getRowChecked("phiUntilDry") : !!storedSitePesticide?.phiUntilDry
              }
            : null
        }
      : null
    };

    console.log("Payload JSON:\n", JSON.stringify(payload, null, 2));
    //console.log("Payload to save:", payload);

    //STUFF
    try {
      const authHeaders = await window.TreatmentAuth.authHeaders();
      const response = await fetch(
          window.TreatmentApiUrl("/api/Treatments/save-row"),
          {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  ...authHeaders
              },
              body: JSON.stringify(payload)
          }
      );
      /*
      //OLD
      const response = await fetch(window.TreatmentApiUrl("/api/Treatments/save-row"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      */

      const responseText = await response.text();

      console.log("Save status:", response.status);
      console.log("Save response:", responseText);

      if (!response.ok) {
        alert("Save failed. Check console for details.");
        return; //Modal stays open so nothing the user entered is lost
      }

      closeEditModal();
      await reloadTableData(container);

      alert("Save succeeded.");
    } catch (err) {
      console.error("Save request failed:", err);
      alert("Save request failed. Check console.");
    } finally {
      form.dataset.isSaving = "false";
    }
  }

  window.PesticideTableBuilderEditModal = {
    setHelpers,
    openEditModal,
    closeEditModal
  };
})();
