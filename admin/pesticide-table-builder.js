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

  //Added 5/22/2026
  function isRecentlyChanged(dateLastModified, changedSince) {
    if (!dateLastModified || !changedSince) return false;

    const modifiedDate = new Date(dateLastModified);
    const sinceDate = new Date(changedSince);

    if (Number.isNaN(modifiedDate.getTime()) || Number.isNaN(sinceDate.getTime())) {
      return false;
    }

    return modifiedDate >= sinceDate;
  }

  function getWasChangedSince(dateValue, changedSince) {
    if (!dateValue || !changedSince) return false;

    const modified = new Date(dateValue);
    const since = new Date(changedSince);

    if (Number.isNaN(modified.getTime()) || Number.isNaN(since.getTime())) {
      return false;
    }

    return modified >= since;
  }

  //5/26/2026
  function formatModifiedDate(dateValue) {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }


  //Added 5/22/2026
  function renderModifiedDate(row) {
    if (!row?.dateLastModified) return "";

    return `
      <div style="font-size:11px; color:#999; margin-top:4px;">
        Modified: ${escapeHtml(formatModifiedDate(row.dateLastModified))}
      </div>
    `;
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  //Added 5-8-2026
  function formatControlTechniqueName(item, typeLabel) {
    const name = clean(item?.name);
    if (!name) return typeLabel;
    return `${name}`;
  }

  function formatProductName(pesticide) {
    const tradeName = clean(pesticide?.tradeName);
    const commonName = clean(pesticide?.commonName);

    if (tradeName && commonName) return `${tradeName} (${commonName})`;
    if (tradeName) return tradeName;
    if (commonName) return commonName;

    return "";
  }

  //Added 5/6/2026
  function renderRestrictedUseSymbols(pesticide) {
    const items = pesticide?.restrictedUse || [];
    if (!items.length) return "";

    return items
      .map(ru => {
        const symbol = clean(ru.symbol);
        const description = clean(ru.description);

        if (!symbol) return "";

        return `
          <span class="restricted-use-symbol"
                title="${escapeHtml(description)}"
                style="display:inline-block; margin-left:4px; font-weight:700; cursor:help;">
            ${escapeHtml(symbol)}
          </span>
        `;
      })
      .filter(Boolean)
      .join("");
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

  //EfficacyComment comes back from the API as an object once it has a value (save-row sends a plain string)
  function getEfficacyCommentText(treatment) {
    const value = treatment?.efficacyComment;
    if (value == null) return "";
    if (typeof value === "string") return value.trim();

    const text = value.comment ?? value.commentText ?? value.efficacyCommentText ?? value.text ?? value.description;
    if (typeof text === "string") return text.trim();

    console.warn("Unknown efficacyComment shape, add its text field to getEfficacyCommentText:", value);
    return "";
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

  function buildRows(data, options = {}) {
    const treatments = Array.isArray(data) ? data : [data];
    const rows = [];

    treatments.forEach(treatment => {
      const efficacy = clean(treatment?.efficacy?.name);
      const efficacyComment = getEfficacyCommentText(treatment); //Not using clean() so line breaks are kept
      const comments = formatComments(treatment);
      const pesticides = treatment?.controlTechnique?.pesticides || [];
      const rates = treatment?.treatmentRates || [];
      const treatmentChanged = isRecentlyChanged(
          treatment?.dateLastModified,
          options.changedSince
        );

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
          dateLastModified: treatment?.dateLastModified ?? "", //Change Logs
          changedSince: options.changedSince || "",
          wasRecentlyChanged: isRecentlyChanged(treatment?.dateLastModified, options.changedSince),
          treatmentChanged: treatmentChanged,
          treatment: treatment,
          pesticide: pesticide,
          matchingRates: matchingRates,
          product: formatProductName(pesticide),
          //rate: [applicationMethodText, rateText].filter(Boolean).join("<br>"),
          applicationMethod: applicationMethodText,
          siteTimings: siteTimingText,
          conventional: pesticide?.pesticideGuideline?.conventional ?? false,
          organic: pesticide?.pesticideGuideline?.organic ?? false,
          rate: rateText,
          rei: formatRei(pesticide?.sitePesticide || []),
          phi: formatPhi(pesticide?.sitePesticide || []),
          resistance: formatResistance(pesticide),
          eiq: unique(
              (pesticide?.activeIngredients || [])
                .map(ai => clean(ai?.eiq))
                .filter(Boolean)
            ).join("<br>"),

            finalEiq: unique(
              (pesticide?.activeIngredients || [])
                .map(ai => clean(ai?.finalEiq))
                .filter(Boolean)
            ).join("<br>"),
          efficacy: efficacy,
          efficacyComment: efficacyComment,
          comments: comments
        });
      });

      //Cultural Practice
      const culturalPractices = treatment?.controlTechnique?.culturalPractices || [];
      culturalPractices.forEach(cp => {
        const applicationMethodText = clean(treatment?.applicationMethod?.name);
        const siteTimingText = formatSiteTimings(treatment);

        rows.push({
          treatmentId: treatment?.treatmentId ?? "",
          controlTechniqueId: treatment?.controlTechniqueId ?? treatment?.controlTechnique?.controlTechniqueId ?? "",
          pesticideId: "",
          pestId: treatment?.pestId ?? "",
          siteId: treatment?.siteId ?? "",
          dateLastModified: treatment?.dateLastModified ?? "",
          changedSince: options.changedSince || "",
          wasRecentlyChanged: isRecentlyChanged(treatment?.dateLastModified, options.changedSince),
          treatmentChanged: treatmentChanged,
          treatment: treatment,
          pesticide: null,
          culturalPractice: cp,
          biologicalControl: null,
          controlTechniqueType: "Cultural Practice",

          matchingRates: [],
          product: formatControlTechniqueName(cp, "Cultural Practice"),
          description: clean(cp?.description),

          applicationMethod: applicationMethodText,
          siteTimings: siteTimingText,
          conventional: false,
          organic: false,

          rate: "",
          rei: "",
          phi: "",
          resistance: "",
          eiq: "",
          finalEiq: "",
          efficacy: efficacy,
          efficacyComment: efficacyComment,
          comments: comments
        });
      });

      //Biological Control
      const biologicalControls = treatment?.controlTechnique?.biologicalControls || [];
      biologicalControls.forEach(bc => {
        const applicationMethodText = clean(treatment?.applicationMethod?.name);
        const siteTimingText = formatSiteTimings(treatment);

        rows.push({
          treatmentId: treatment?.treatmentId ?? "",
          controlTechniqueId: treatment?.controlTechniqueId ?? treatment?.controlTechnique?.controlTechniqueId ?? "",
          pesticideId: "",
          pestId: treatment?.pestId ?? "",
          siteId: treatment?.siteId ?? "",
          dateLastModified: treatment?.dateLastModified ?? "",
          changedSince: options.changedSince || "",
          wasRecentlyChanged: isRecentlyChanged(treatment?.dateLastModified, options.changedSince),
          treatmentChanged: treatmentChanged,
          treatment: treatment,
          pesticide: null,
          culturalPractice: null,
          biologicalControl: bc,
          controlTechniqueType: "Biological Control",

          matchingRates: [],
          product: formatControlTechniqueName(bc, "Biological Control"),
          description: clean(bc?.description),

          applicationMethod: applicationMethodText,
          siteTimings: siteTimingText,
          conventional: false,
          organic: false,

          rate: "",
          rei: "",
          phi: "",
          resistance: "",
          eiq: "",
          finalEiq: "",
          efficacy: efficacy,
          efficacyComment: efficacyComment,
          comments: comments
        });
      });
    });

    return rows;
  }

  function renderEditButtons(options = {}) {
    const isDeletedView = options.showDeleted === true;

    return `
      <div style="display:flex; gap:4px; flex-wrap:wrap;">
        <button type="button" class="edit-row-btn">Edit</button>

        ${isDeletedView
          ? `<button type="button" class="restore-row-btn">Restore</button>`
          : `<button type="button" class="delete-row-btn">Remove</button>`
        }
      </div>
    `;
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

  function renderTable(data, options = {}) {
    const rows = buildRows(data, options);
    const currentUser =
        window.TreatmentAuth?.getDisplayName?.() ?? "";
    const AddTreatmentButton = `
      <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-top:12px;
          margin-bottom:8px;
          gap:12px;
          flex-wrap:wrap;
      ">
        <button type="button" class="insert-treatment-btn">
          Add Treatment
        </button>
        
        ${options.showDeleted ? `
          <div style="
              border:1px solid #b36b00;
              background:#fff4e5;
              padding:3px 10px;
              border-radius:4px;
              font-size:12px;
              font-weight:600;
              color:#7a4b00;
          ">
            Viewing Deleted Treatments - Use Restore to bring one back.
          </div>
        ` : `<div></div>`}

        

        <label style="
            font-size:12px;
            display:flex;
            align-items:center;
            gap:4px;
            white-space:nowrap;
        ">
          <input type="checkbox"
                class="show-deleted-toggle"
                ${options.showDeleted ? "checked" : ""}>
          Show Deleted
        </label>
      </div>
    `;

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
            ${renderEditButtons(options)}
          </td>
          <td rowspan="3" class="id-cell">
            ${renderIdBlock(row, true)}
          </td>
          <td class="product-cell">
            <div class="product-text">
              ${escapeHtml(row.product)}${renderRestrictedUseSymbols(row.pesticide)}
            </div>
          </td>

          ${row.pesticide ? `
            <td class="data-cell rate-cell" style="${row.treatmentChanged ? 'background:#fff4b8;' : ''}">
              <div class="cell-text">
                ${row.rate || ""}
                ${row.treatmentChanged ? renderModifiedDate(row) : ""}
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
          ` : `
            <td class="data-cell non-pesticide-description-cell" colspan="4">
              <div class="cell-text">
                <strong>${escapeHtml(row.controlTechniqueType)}:</strong>
                ${escapeHtml(row.description) || "<em>No description</em>"}
              </div>
            </td>
          `}

          <td class="data-cell efficacy-cell"
            style="${row.treatmentChanged ? 'background:#fff4b8;' : ''}">
            <div class="cell-text">
              ${escapeHtml(row.efficacy)}
              ${row.efficacyComment ? `
                <div class="efficacy-comment" style="font-size:12px; color:#555; margin-top:4px; white-space:pre-wrap;">${escapeHtml(row.efficacyComment)}</div>` : ""}
              ${row.treatmentChanged ? renderModifiedDate(row) : ""}
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
              ${row.conventional ? "Yes" : "No"}
            </div>

            <div class="misc-detail-line">
              <strong>Organic:</strong>
              ${row.organic ? "Yes" : "No"}
            </div>

            <div>
              <strong>Application Method:</strong>
              ${escapeHtml(row.applicationMethod) || "<em>None</em>"}
            </div>

            <div>
              <strong>Site Timing:</strong>
              ${row.siteTimings || "<em>None</em>"}
            </div>

            <div class="misc-detail-line">
              <strong>EIQ:</strong>
              ${row.eiq || "<em>None</em>"}
            </div>

            <div class="misc-detail-line">
              <strong>Final EIQ:</strong>
              ${row.finalEiq || "<em>None</em>"}
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
        ${AddTreatmentButton}
        <table style="
            border-collapse:collapse;
            width:100%;
            border:${options.showDeleted ? "2px solid #b36b00" : "1px solid #ccc"};">
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
        

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-top:10px;
          font-size:12px;
          color:#666;
        ">
          <div>
              DB Logged in as <strong>${escapeHtml(currentUser)}</strong>
          </div>
          <button
              type="button"
              class="treatment-logout-btn"
              style="
                  border:none;
                  background:none;
                  color:#666;
                  cursor:pointer;
                  font-size:12px;
                  text-decoration:underline;
              ">
              Sign out
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================
  // 4. TABLE EVENTS (editing a row happens in pesticide-table-builder-edit-modal.js)
  // =========================================================
  function wireTableEvents(container) {
    /*
    if (!container || container.__pesticideTableEventsBound) return;
    container.__pesticideTableEventsBound = true;

    container.addEventListener("click", async function (e) {
    */
    if (!container) return;

    if (container.__pesticideClickHandler) {
      container.removeEventListener("click", container.__pesticideClickHandler);
    }

    container.__pesticideClickHandler = async function (e) {
      console.log("Pesticide table click:", e.target);
      const editBtn = e.target.closest(".edit-row-btn");
      const deleteBtn = e.target.closest(".delete-row-btn"); //Added 5-8-2026
      const restoreBtn = e.target.closest(".restore-row-btn"); //Added 5-13-2026
      const insertTreatmentBtn = e.target.closest(".insert-treatment-btn"); //For Insert Button Added 4/7/2026
      //Added 4-28-2026
      const toggleMiscRowBtn = e.target.closest(".toggle-misc-row-btn");
      //Added 5-12-2026
      const showDeletedToggle = e.target.closest(".show-deleted-toggle");
      //Added 6-9-2026
      const logoutBtn = e.target.closest(".treatment-logout-btn");
      if (logoutBtn) {
        e.preventDefault();

        if (window.TreatmentAuth?.logout) {
          await window.TreatmentAuth.logout();
        }

        return;
      }

      if (showDeletedToggle) {
        container.__showDeleted = showDeletedToggle.checked;
        await reloadTableData(container);
        return;
      }

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

      //Editing happens in a modal - see pesticide-table-builder-edit-modal.js
      if (editBtn) {
        const tr = editBtn.closest("tr.data-row");
        if (!tr) return;

        const row = findRowByElement(tr, container);
        if (!row) return;

        await window.PesticideTableBuilderEditModal.openEditModal(row, container, tr);
        return;
      }

      if (insertTreatmentBtn) {
        await openControlTechniqueModal(container);
        return;
      }
      
      if (deleteBtn) {
        const tr = deleteBtn.closest("tr.data-row");
        if (!tr) return;

        const row = findRowByElement(tr, container);

        if (!row) {
          console.error("Could not find row for delete:", tr);
          alert("Could not find row data.");
          return;
        }

        await deleteTreatmentRow(row, container);
        return;
      }

      if (restoreBtn) {
        const tr = restoreBtn.closest("tr.data-row");
        if (!tr) return;

        const row = findRowByElement(tr, container);

        if (!row) {
          console.error("Could not find row for restore:", tr);
          alert("Could not find row data.");
          return;
        }

        await restoreTreatmentRow(row, container);
        return;
      }

    //});
    //}
    };
    container.addEventListener("click", container.__pesticideClickHandler);
  }


  

  

  



  
  

  

  

  





  





  // =========================================================
  // 5. RELOAD
  // =========================================================

  async function reloadTableData(container) {
    const pestId = container.dataset.pestId;
    const siteId = container.dataset.siteId;
    const guidelineId = container.dataset.guidelineId;

    const params = new URLSearchParams();
    if (guidelineId) params.append("guidelineId", guidelineId);
    if (pestId) params.append("pestId", pestId);
    if (siteId) params.append("siteId", siteId);

    if (container.__showDeleted) {
      params.append("deletedOnly", "true");
    }

    const url = window.TreatmentApiUrl(`/api/Treatments/search?${params.toString()}`);
    console.log("Reloading pesticide JSON:", url);

    const authHeaders = await window.TreatmentAuth.authHeaders();
    const response = await fetch(url, {
      headers: {
        ...authHeaders
      }
    });

    if (!response.ok) {
      throw new Error(`Reload failed with status ${response.status}`);
    }
    /*
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Reload failed with status ${response.status}`);
    }
    */

    const json = await response.json();

    container.__pesticideJson = json;
    container.__pesticideRows = buildRows(json, {
      changedSince: container.__changedSince || ""
    });

    container.innerHTML = renderTable(json, {
      showDeleted: container.__showDeleted === true,
      changedSince: container.__changedSince || ""
    });
    
    //container.__pesticideTableEventsBound = false;
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

    const url = window.TreatmentApiUrl(`/api/Treatments/control-technique-options?${params.toString()}`);
    //const response = await fetch(url);
    const authHeaders = await window.TreatmentAuth.authHeaders();
    const response = await fetch(url, {
      headers: {
        ...authHeaders
      }
    });

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

    //showCreateBtn.addEventListener("click", function () {
      //createForm.style.display = "block";
    //});
    showCreateBtn.addEventListener("click", async function () {
      const container = modal.__targetContainer;
      const searchTerm = searchBox.value.trim();

      if (!window.PesticideTableBuilderProductModal?.openProductModalForCreate) {
        alert("Product modal create function is not loaded.");
        return;
      }

      closeControlTechniqueModal();

      await window.PesticideTableBuilderProductModal.openProductModalForCreate(
        container,
        {
          escapeHtml,
          clean,
          getRowKey,
          reloadTableData,
          insertNewTreatmentRow,
          editMetadata: container.__editMetadata
        },
        {
          tradeName: searchTerm
        }
      );
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
        guidelineId: parseInt(container.dataset.guidelineId, 10) || 0,
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
    /*
    function renderRowsFromStoredState(container) {
      const rows = container.__pesticideRows || [];
      container.innerHTML = renderRowsTable(rows);
      container.__pesticideTableEventsBound = false;
      wireTableEvents(container);
    }*/

    //Added 5/27/2026
    function renderRowsFromStoredState(container) {
      container.innerHTML = renderTable(container.__pesticideJson || [], {
        showDeleted: container.__showDeleted === true,
        changedSince: container.__changedSince || ""
      });

      container.__pesticideRows = buildRows(container.__pesticideJson || [], {
        changedSince: container.__changedSince || ""
      });

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
    /*
    const response = await fetch(window.TreatmentApiUrl("/api/Treatments/save-control-technique"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    */
    const authHeaders = await window.TreatmentAuth.authHeaders();
    const response = await fetch(window.TreatmentApiUrl("/api/Treatments/save-control-technique"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
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

    const tempTreatment = {
      treatmentId: 0,
      controlTechniqueId: selectedCt.controlTechniqueId ?? 0,
      pestId,
      siteId,
      guidelineId,
      deleted: false,
      applicationMethodId: null,
      efficacyId: null,
      dateLastModified: null,
      comments: [],
      treatmentRates: [],
      siteTimings: [],
      siteHarvestPeriods: [],
      pestLifeCycles: [],
      efficacyComment: null,

      controlTechnique: {
        controlTechniqueId: selectedCt.controlTechniqueId ?? 0,
        isMixture: selectedCt.isMixture ?? false,
        pesticides: selectedCt.pesticides || [],
        biologicalControls: selectedCt.biologicalControls || [],
        culturalPractices: selectedCt.culturalPractices || []
      }
    };

    const existingJson = Array.isArray(container.__pesticideJson)
      ? container.__pesticideJson
      : [];

    container.__pesticideJson = [tempTreatment, ...existingJson];

    container.innerHTML = renderTable(container.__pesticideJson, {
      showDeleted: container.__showDeleted === true,
      changedSince: container.__changedSince || ""
    });

    container.__pesticideRows = buildRows(container.__pesticideJson, {
      changedSince: container.__changedSince || ""
    });

    container.__pesticideTableEventsBound = false;
    wireTableEvents(container);

    const newTr = container.querySelector(
      `tr.data-row[data-treatment-id="0"][data-control-technique-id="${escapeHtml(selectedCt.controlTechniqueId ?? 0)}"]`
    );

    if (newTr) {
      window.PesticideTableBuilderEditModal.openEditModal(findRowByElement(newTr, container), container, newTr);
    }
  }

  //Added 5-8-2026
  async function deleteTreatmentRow(row, container) {
    const treatmentId = parseInt(row.treatmentId, 10) || 0;

    if (!treatmentId) {
      alert("Cannot remove this treatment because it has not been saved yet.");
      return;
    }

    const confirmed = confirm(
      `Would you like to remove this treatment?\n\n${row.product || "Treatment"}`
    );

    if (!confirmed) return;

    /*
    const response = await fetch(window.TreatmentApiUrl(`/api/Treatments/delete-row/${treatmentId}`), {
      method: "POST"
    });
    */
   // POST: delete-row
    const authHeaders = await window.TreatmentAuth.authHeaders();
    const response = await fetch(window.TreatmentApiUrl(`/api/Treatments/delete-row/${treatmentId}`), {
      method: "POST",
      headers: {
        ...authHeaders
      }
    });

    const text = await response.text();

    console.log("Delete status:", response.status);
    console.log("Delete response:", text);

    if (!response.ok) {
      alert("Remove failed. Check console for details.");
      return;
    }

    await reloadTableData(container);
  }

  //Added 5-13-2026
  async function restoreTreatmentRow(row, container) {
    const treatmentId = parseInt(row.treatmentId, 10) || 0;

    if (!treatmentId) {
      alert("Cannot restore this treatment because it does not have a valid TreatmentId.");
      return;
    }

    const confirmed = confirm(
      `Would you like to restore this treatment?\n\n${row.product || "Treatment"}`
    );

    if (!confirmed) return;

    /*
    const response = await fetch(window.TreatmentApiUrl(`/api/Treatments/restore-row/${treatmentId}`), {
      method: "POST"
    });
    */
    const authHeaders = await window.TreatmentAuth.authHeaders();
    const response = await fetch(window.TreatmentApiUrl(`/api/Treatments/restore-row/${treatmentId}`), {
      method: "POST",
      headers: {
        ...authHeaders
      }
    });

    const text = await response.text();

    console.log("Restore status:", response.status);
    console.log("Restore response:", text);

    if (!response.ok) {
      alert("Restore failed. Check console for details.");
      return;
    }

    await reloadTableData(container);
  }
  



  // =========================================================
  // Interface?
  // =========================================================
  window.PesticideTableBuilderEditModal.setHelpers({
    escapeHtml,
    clean,
    getRowKey,
    findRowByElement,
    renderIdBlock,
    renderModifiedDate,
    getEfficacyCommentText,
    reloadTableData
  });

  window.PesticideTableBuilderComments.setHelpers({
    escapeHtml,
    clean,
    getRowKey,
    findRowByElement
  });

  window.PesticideTableBuilder = {
    buildRows,
    renderTable,
    wireTableEvents
  };
})();