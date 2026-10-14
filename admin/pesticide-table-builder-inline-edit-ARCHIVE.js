// =========================================================
// ARCHIVED - OLD INLINE ROW EDITING (not loaded, not used)
//
// This is how a row was edited before the edit modal
// (pesticide-table-builder-edit-modal.js) replaced it on 2026-10-14.
// The row's table cells were swapped for editors in place, which made the
// row grow and shrink and made it hard to keep your place in the table.
//
// It is kept here only for reference, in case we decide to go back.
// It is NOT in admin/index.html. If we never need it, delete this file;
// nothing else depends on it.
//
// To bring it back it would need:
//  - These functions moved back inside pesticide-table-builder.js
//    (they use findRowByElement, renderIdBlock, renderTable, wireTableEvents,
//    reloadTableData, getEfficacyCommentText from there)
//  - The field editors (renderRateEditor, renderReiEditor, renderEfficacyEditor,
//    renderSiteTimingEditor, ensureEditMetadata, ...) which now live in
//    pesticide-table-builder-edit-modal.js
//  - The click handler branches at the bottom of this file put back in
//    wireTableEvents
// Note: this old save has a bug - applicationMethodId was looked up only in
// the main <tr>, but its dropdown is in the misc row, so it always saved null.
// =========================================================
(function () {

  function enterEditMode(tr, container) {
    console.log("enterEditMode called");
    const row = findRowByElement(tr, container);
    console.log("row found:", row);
    if (!row) return;
    if (tr.classList.contains("is-editing")) return;

    tr.classList.add("is-editing");

    const cells = tr.querySelectorAll("td");
    if (!row.pesticide) {
      enterNonPesticideEditMode(tr, row, container, cells);
      return;
    }
    if (cells.length < 8) return;

    /*
    cells[0].innerHTML = `
      <button type="button" class="save-row-btn">Save</button>
      <button type="button" class="cancel-row-btn" style="margin-left:6px;">Cancel</button>
    `;
    */
    cells[0].innerHTML = `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="save-row-btn">Save</button>
        <button type="button" class="cancel-row-btn">Cancel</button>
      </div>
    `;


    cells[1].innerHTML = renderIdBlock(row, true);
    //cells[2].innerHTML = escapeHtml(row.product);
    cells[2].innerHTML = `
      <div>${escapeHtml(row.product)}</div>
      <button type="button" class="edit-product-btn" style="margin-top:6px;">
        Edit Control Technique
      </button>
    `;
    cells[3].innerHTML = row.pesticide
      ? renderRateEditor(row, container.__editMetadata)
      : `<em>Not applicable</em>`;

    cells[4].innerHTML = row.pesticide
      ? renderReiEditor(row)
      : "";

    cells[5].innerHTML = row.pesticide
      ? renderPhiEditor(row)
      : "";

    cells[6].innerHTML = row.pesticide
      ? escapeHtml(row.resistance)
      : escapeHtml(row.description || "");
      
    //cells[3].innerHTML = renderRateEditor(row, container.__editMetadata);
    //cells[4].innerHTML = renderReiEditor(row);
    //cells[5].innerHTML = renderPhiEditor(row);
    //cells[6].innerHTML = escapeHtml(row.resistance);

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
                <div class="misc-edit-title">Designation</div>
                ${renderConventionalOrganicEditor(row)}
              </div>
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
        commentCell.innerHTML = window.PesticideTableBuilderComments.renderCommentEditor(row);
      }
    }
    /*
    const commentTr = tr.nextElementSibling;
    if (commentTr && commentTr.classList.contains("comment-row")) {
      const commentCell = commentTr.querySelector(".comment-content-cell");
      if (commentCell) {
        commentCell.innerHTML = window.PesticideTableBuilderComments.renderCommentEditor(row);
      }
    }
    */
  }

  function enterNonPesticideEditMode(tr, row, container, cells) {
    if (cells.length < 5) return;

    cells[0].innerHTML = `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="save-row-btn">Save</button>
        <button type="button" class="cancel-row-btn">Cancel</button>
      </div>
    `;

    cells[1].innerHTML = renderIdBlock(row, true);

    cells[2].innerHTML = `
      <div>${escapeHtml(row.product)}</div>
      <button type="button" class="edit-product-btn" style="margin-top:6px;">
        Edit Control Technique
      </button>
    `;

    cells[3].innerHTML = `
      <div style="font-size:12px; color:#666; margin-bottom:4px;">
        <strong>${escapeHtml(row.controlTechniqueType || "Control Technique")}</strong>
      </div>
      <div style="line-height:1.3;">
        ${escapeHtml(row.description || "") || "<em>No description</em>"}
      </div>
    `;

    cells[4].innerHTML = renderEfficacyEditor(row, container.__editMetadata);

    const miscTr = tr.nextElementSibling;
    if (miscTr && miscTr.classList.contains("misc-row")) {
      const miscCell = miscTr.querySelector(".misc-content-cell");
      if (miscCell) {
        miscCell.innerHTML = `
          <div class="misc-edit-wrapper">
            <div><strong>Miscellaneous</strong></div>
            <div class="misc-edit-grid">
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
        commentCell.innerHTML = window.PesticideTableBuilderComments.renderCommentEditor(row);
      }
    }
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
    const getRowChecked = (field) =>
      !![tr, tr.nextElementSibling]
        .filter(Boolean)
        .flatMap(rowEl => Array.from(rowEl.querySelectorAll(`[data-field="${field}"]`)))
        .some(el => el.checked);
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

    //Checks to see if it is a pesticide.
    const hasPesticide = parseInt(row.pesticideId, 10) > 0;

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

      applicationMethodId: parseNullableInt(getRowField("applicationMethodId")),
      efficacyId: parseNullableInt(getRowField("efficacyId")),

      deleted: treatment.deleted ?? false,
      guidelineId: treatment.guidelineId ?? null,

      treatmentRates: updatedRates,

      //Use the textarea if the row is in edit mode, otherwise keep what was already saved
      efficacyComment: tr.querySelector('[data-field="efficacyComment"]')
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
          pesticideGuideline: {
            conventional: getRowChecked("conventional"),
            organic: getRowChecked("organic")
          },
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

  // =========================================================
  // Old click handler branches from wireTableEvents (reference only)
  // =========================================================
  /*
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

        //await openProductModal(row, container);
        await window.PesticideTableBuilderProductModal.openProductModal(row, container, {
          escapeHtml,
          clean,
          getRowKey,
          reloadTableData,
          editMetadata: container.__editMetadata
        });
        return;
      }

      //Comment buttons (Add / Edit / Remove / Link) - see pesticide-table-builder-comments.js
      if (await window.PesticideTableBuilderComments.handleCommentClick(e, container)) {
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

      // --- In insertNewTreatmentRow (Add Treatment) ---
    if (newTr) {
      ensureEditMetadata(container)
        .then(() => enterEditMode(newTr, container))
        .catch(err => {
          console.error("Failed to load metadata for new row:", err);
        });
    }
  */
})();
