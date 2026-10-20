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

        //Kept on one line with no extra spaces inside, so the spacing is exactly the single space added by join(" ")
        return `<span class="restricted-use-symbol" title="${escapeHtml(description)}">${escapeHtml(symbol)}</span>`;
      })
      .filter(Boolean)
      .join(" ");
  }

  //Product name with its RestrictedUse symbols in front, like the public table: "* ** Assail 30SC"
  //Table footer key for the RestrictedUse symbols used in this table: each symbol + description once,
  //in the order they first appear (rows are passed unsorted so the key doesn't change when sorting).
  //Returns "" when no product in the table has a symbol. The cell spans all 8 columns.
  function renderRestrictedUseKey(rows) {
    const seen = new Set();
    const items = [];

    rows.forEach(row => (row.pesticides || []).forEach(pesticide => (pesticide?.restrictedUse || []).forEach(ru => {
      const symbol = clean(ru?.symbol);
      const description = clean(ru?.description);
      const key = `${symbol}|${description}`;

      if (!symbol || seen.has(key)) return;
      seen.add(key);
      items.push({ symbol, description });
    })));

    if (!items.length) return "";

    return `
      <tfoot>
        <tr>
          <td colspan="8" class="restricted-use-key">
            ${items.map(item => `
              <span class="restricted-use-key-item"><span class="restricted-use-symbol">${escapeHtml(item.symbol)}</span> ${escapeHtml(item.description) || "<em>No description</em>"}</span>
            `).join("")}
          </td>
        </tr>
      </tfoot>
    `;
  }

  //Where the "See more details" link goes (added 10-16-2026, may be switched back):
  //  true  = in the Product cell right after the product name; the details row is hidden until opened (saves a line per treatment)
  //  false = on its own line under the treatment, centered (the earlier layout)
  const DETAILS_TOGGLE_IN_PRODUCT = true;

  function renderDetailsToggle() {
    return `<button type="button" class="toggle-misc-row-btn">See more details</button>`;
  }

  //Product cell: one line per pesticide (symbols + name). With DETAILS_TOGGLE_IN_PRODUCT the
  //"See more details" link gets its own line under the name(s).
  function renderProductCellNames(row) {
    const lines = row.pesticideDetails
      ? row.pesticideDetails.map(d => renderProductNameWithSymbols(d.name, d.pesticide))
      : [escapeHtml(row.product)];

    const nameLines = lines.map(line => `<div>${line}</div>`).join("");

    return DETAILS_TOGGLE_IN_PRODUCT
      ? `${nameLines}<div class="product-details-toggle">${renderDetailsToggle()}</div>`
      : nameLines;
  }

  function renderProductNameWithSymbols(name, pesticide) {
    const symbols = renderRestrictedUseSymbols(pesticide);
    return symbols ? `${symbols} ${escapeHtml(name)}` : escapeHtml(name);
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
    if (unitArea) text += "/" + unitArea; //"gal/acre" (no space after the slash)
    if (amountNote) text += (text ? " " : "") + `(${amountNote})`;

    return clean(text);
  }

  //REI / PHI amount with its unit: "12" + "Hours" -> "12 Hours", "1" + "Days" -> "1 Day".
  //defaultUnit is used when no unit was saved (REI has always meant hours, so it passes "hr").
  function formatTimeValue(value, unit, defaultUnit = "") {
    const amount = clean(value);
    if (!amount) return "";

    let label = clean(unit) || defaultUnit;
    if (parseFloat(amount) === 1 && /s$/i.test(label)) {
      label = label.slice(0, -1);
    }

    return label ? `${amount} ${label}` : amount;
  }

  function formatRei(sitePesticideList) {
    const sp = (sitePesticideList || [])[0];
    if (!sp) return "";

    const parts = [];

    //Uses the saved REI unit (Hours/Days). Before 10-16-2026 this always said "hr", even for Days.
    const rei = formatTimeValue(sp.rei, sp.reiTime, "hr");
    if (rei) {
      parts.push(rei);
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

    const phi = formatTimeValue(sp.phi, sp.phiTime);

    if (phi) {
      parts.push(phi);
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
    const groupNumberValues = [];

    (pesticide?.activeIngredients || []).forEach(ai => {
      const irac = clean(ai?.activeIngredientInsecticide?.irac);
      const frac = clean(ai?.activeIngredientFungicide?.frac);
      const groupNumber = clean(ai?.activeIngredientHerbicide?.groupNumber);

      if (irac) iracValues.push(irac);
      if (frac) fracValues.push(frac);
      if (groupNumber) groupNumberValues.push(groupNumber);
    });

    return [
      ["IRAC", unique(iracValues).join(", ")],
      ["FRAC", unique(fracValues).join(", ")],
      ["Group Number", unique(groupNumberValues).join(", ")]
    ]
      .filter(([, text]) => text)
      .map(([label, text]) => `${label}: ${text}`)
      .join(" / ");
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

      //One row per treatment. A mixture (a control technique with more than one pesticide) stays on ONE row;
      //each pesticide's rate / REI / PHI / resistance is listed under that pesticide's name.
      if (pesticides.length) {
        const isMixture = pesticides.length > 1;
        const applicationMethodText = clean(treatment?.applicationMethod?.name);
        const siteTimingText = formatSiteTimings(treatment);

        const pesticideDetails = pesticides.map(pesticide => {
          const pesticideRates = rates.filter(r => r?.pesticideId === pesticide?.pesticideId);

          return {
            pesticide: pesticide,
            name: formatProductName(pesticide),
            rates: pesticideRates,
            rate: unique(pesticideRates.map(formatRate).filter(Boolean)).join("<br>"),
            rei: formatRei(pesticide?.sitePesticide || []),
            phi: formatPhi(pesticide?.sitePesticide || []),
            resistance: formatResistance(pesticide),
            conventional: pesticide?.pesticideGuideline?.conventional ?? false,
            organic: pesticide?.pesticideGuideline?.organic ?? false
          };
        });

        //Plain-text version for places that show one line (mixtures get "Name: value; Name: value")
        const joinText = (field) => pesticideDetails
          .filter(d => d[field])
          .map(d => isMixture ? `${d.name}: ${d[field]}` : d[field])
          .join("; ");

        const allActiveIngredients = pesticides.flatMap(p => p?.activeIngredients || []);
        const firstPesticide = pesticides[0];

        rows.push({
          treatmentId: treatment?.treatmentId ?? "",
          controlTechniqueId: treatment?.controlTechniqueId ?? treatment?.controlTechnique?.controlTechniqueId ?? "",
          pesticideId: firstPesticide?.pesticideId ?? "", //First pesticide - used in the row key. See pesticides for all of them.
          pestId: treatment?.pestId ?? "",
          siteId: treatment?.siteId ?? "",
          dateLastModified: treatment?.dateLastModified ?? "", //Change Logs
          changedSince: options.changedSince || "",
          wasRecentlyChanged: isRecentlyChanged(treatment?.dateLastModified, options.changedSince),
          treatmentChanged: treatmentChanged,
          treatment: treatment,
          pesticide: firstPesticide, //First pesticide only - use pesticides / pesticideDetails for mixtures
          pesticides: pesticides,
          pesticideDetails: pesticideDetails,
          isMixture: isMixture,
          matchingRates: rates.filter(r => pesticides.some(p => p?.pesticideId === r?.pesticideId)),
          product: pesticideDetails.map(d => d.name).join(" + "),
          applicationMethod: applicationMethodText,
          siteTimings: siteTimingText,
          conventional: firstPesticide?.pesticideGuideline?.conventional ?? false,
          organic: firstPesticide?.pesticideGuideline?.organic ?? false,
          //Mixtures: one line per pesticide, in the same order as the Product column (no names; "–" keeps the order when empty)
          rate: isMixture
            ? pesticideDetails.map(d => `<div>${d.rate || "&ndash;"}</div>`).join("")
            : pesticideDetails[0].rate,
          rei: joinText("rei"),
          phi: joinText("phi"),
          resistance: joinText("resistance"),
          eiq: unique(allActiveIngredients.map(ai => clean(ai?.eiq)).filter(Boolean)).join("<br>"),
          finalEiq: unique(allActiveIngredients.map(ai => clean(ai?.finalEiq)).filter(Boolean)).join("<br>"),
          efficacy: efficacy,
          efficacyComment: efficacyComment,
          comments: comments
        });
      }

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

  //A table cell value that can differ per pesticide. Mixtures show one line per pesticide, in the same
  //order as the Product column, so the lines match up without repeating the names. "–" keeps the order when a value is empty.
  function renderPerPesticideText(row, field) {
    if (!row.isMixture) {
      return escapeHtml(row[field]);
    }

    return row.pesticideDetails
      .map(d => `<div>${escapeHtml(d[field]) || "&ndash;"}</div>`)
      .join("");
  }

  //"Refer To Label" / "Until Dry" shown as small tags, like the public table (renderStatusLabel in public-treatment-builder.js)
  function renderStatusLabel(text) {
    return `<span class="treatment-status-label">${escapeHtml(text)}</span>`;
  }

  //REI or PHI for one pesticide: the value, then the tags.
  //separator is "<br>" (tags on their own lines) or " " (tags on the same line, used for mixtures so lines stay lined up)
  function renderTimingHtml(pesticide, kind, separator) {
    const sp = (pesticide?.sitePesticide || [])[0];
    if (!sp) return "";

    const parts = [];

    //Same wording as formatRei / formatPhi
    const value = formatTimeValue(sp[kind], sp[`${kind}Time`], kind === "rei" ? "hr" : "");
    if (value) {
      parts.push(escapeHtml(value));
    }
    if (sp[`${kind}ReferToLabel`]) parts.push(renderStatusLabel("Refer To Label"));
    if (sp[`${kind}UntilDry`]) parts.push(renderStatusLabel("Until Dry"));

    return parts.join(separator);
  }

  //REI / PHI table cell. Mixtures: one line per pesticide in Product order ("–" when empty).
  function renderTimingCell(row, kind) {
    const pesticides = row.pesticides || [];

    if (!row.isMixture) {
      return renderTimingHtml(pesticides[0], kind, "<br>");
    }

    return pesticides
      .map(pesticide => `<div>${renderTimingHtml(pesticide, kind, " ") || "&ndash;"}</div>`)
      .join("");
  }

  function renderPerPesticideYesNo(row, field) {
    if (!row.isMixture) {
      return row[field] ? "Yes" : "No";
    }

    return row.pesticideDetails
      .map(d => `${escapeHtml(d.name)}: ${d[field] ? "Yes" : "No"}`)
      .join(", ");
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
      <div><strong>P:</strong> ${escapeHtml((row.pesticides || []).map(p => p?.pesticideId).join(", ") || row.pesticideId)}</div>
      ${rateIds}
    `;
  }

  // =========================================================
  // Sorting - works like the public table (assets/js/public-treatment-builder.js):
  // click a column header to sort ascending, again for descending, a third time for the API's order.
  // Rows with no value for the column always sort last. The sort is kept on the container
  // (container.__treatmentSort) so it survives saves and reloads.
  // =========================================================

  //REI/PHI in hours so "2 Days" sorts after "24 Hours"
  function getTimeInHours(sitePesticide, kind) {
    const amount = parseFloat(clean(sitePesticide?.[kind]));
    if (Number.isNaN(amount)) return null;

    const unit = clean(sitePesticide?.[`${kind}Time`]).toLowerCase();
    if (unit.startsWith("week")) return amount * 168;
    if (unit.startsWith("day")) return amount * 24;
    return amount;
  }

  //Mixtures sort by the first pesticide that has a value
  function getSortHours(row, kind) {
    for (const pesticide of (row.pesticides || [])) {
      const hours = getTimeInHours(pesticide?.sitePesticide?.[0], kind);
      if (hours !== null) return hours;
    }
    return null;
  }

  function stripHtml(html) {
    return clean(String(html ?? "").replace(/<[^>]*>/g, " "));
  }

  const SORT_COLUMNS = [
    //New, unsaved treatments (id 0) sort last
    { key: "id", label: "Id", type: "number", value: row => parseInt(row.treatmentId, 10) > 0 ? parseInt(row.treatmentId, 10) : null },
    { key: "product", label: "Product", type: "text", value: row => clean(row.product) },
    {
      key: "rate",
      label: "Rate",
      type: "text",
      value: row => (row.pesticideDetails || []).map(d => stripHtml(d.rate)).filter(Boolean).join(" ")
    },
    { key: "rei", label: "REI", type: "number", value: row => getSortHours(row, "rei") },
    { key: "phi", label: "PHI", type: "number", value: row => getSortHours(row, "phi") },
    { key: "resistance", label: "Resistance Mgmt.", type: "text", value: row => clean(row.resistance) },
    { key: "efficacy", label: "Efficacy", type: "text", value: row => clean(row.efficacy) }
  ];

  const sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  function sortRows(rows, sort) {
    const column = SORT_COLUMNS.find(c => c.key === sort?.key);
    if (!column) return rows;

    const direction = sort.direction === "desc" ? -1 : 1;

    return rows
      .map((row, index) => ({ row, index, value: column.value(row) }))
      .sort((a, b) => {
        const aMissing = a.value === null || a.value === "";
        const bMissing = b.value === null || b.value === "";

        if (aMissing || bMissing) {
          if (aMissing && bMissing) return a.index - b.index;
          return aMissing ? 1 : -1;
        }

        const result = column.type === "number"
          ? a.value - b.value
          : sortCollator.compare(a.value, b.value);

        return result !== 0 ? result * direction : a.index - b.index;
      })
      .map(entry => entry.row);
  }

  function renderSortableHeader(key, sort) {
    const column = SORT_COLUMNS.find(c => c.key === key);
    const active = sort?.key === key;
    const ariaSort = active ? (sort.direction === "desc" ? "descending" : "ascending") : "none";

    return `
      <th aria-sort="${ariaSort}">
        <button type="button" class="sort-button" data-sort-key="${escapeHtml(key)}">
          ${escapeHtml(column.label)}
        </button>
      </th>
    `;
  }

  //Cycles asc -> desc -> back to the API's order. Only the table is redrawn (not the title above it).
  function handleSortClick(container, key) {
    const current = container.__treatmentSort;
    let next = null;

    if (!current || current.key !== key) {
      next = { key, direction: "asc" };
    } else if (current.direction === "asc") {
      next = { key, direction: "desc" };
    }

    container.__treatmentSort = next;

    const html = renderTable(container.__pesticideJson || [], {
      showDeleted: container.__showDeleted === true,
      changedSince: container.__changedSince || "",
      sort: next
    });

    replaceTableHtml(container, html);

    container.querySelector(`.sort-button[data-sort-key="${key}"]`)?.focus();
  }

  // Swaps only the table wrapper so anything rendered above it (the treatment table title) survives a redraw.
  function replaceTableHtml(container, html) {
    const wrapper = container.querySelector(".pesticide-table-wrapper");
    if (wrapper) {
      wrapper.outerHTML = html;
    } else {
      container.innerHTML = html;
    }
  }

  function renderTable(data, options = {}) {
    const unsortedRows = buildRows(data, options);
    const rows = sortRows(unsortedRows, options.sort);
    const restrictedUseKey = renderRestrictedUseKey(unsortedRows); //"" when no product has a symbol
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

    //Alternating gray/white per treatment, like the public table (all three rows of a treatment share a color)
    const bodyRows = rows.map((row, index) => {
      const stripeClass = index % 2 === 0 ? "treatment-gray" : "treatment-white";
      return `
      <tr
          class="data-row ${stripeClass}"
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
              ${renderProductCellNames(row)}
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
                ${renderTimingCell(row, "rei")}
              </div>
            </td>

            <td class="data-cell phi-cell">
              <div class="cell-text">
                ${renderTimingCell(row, "phi")}
              </div>
            </td>

            <td class="data-cell resistance-cell">
              <div class="cell-text">
                ${renderPerPesticideText(row, "resistance")}
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

      <tr class="misc-row ${stripeClass}${DETAILS_TOGGLE_IN_PRODUCT ? " is-hidden" : ""}">
        <td colspan="6" class="misc-content-cell">
          ${DETAILS_TOGGLE_IN_PRODUCT ? "" : renderDetailsToggle()}

          <div class="misc-details is-hidden">
            <div class="misc-detail-line">
              <strong>Conventional:</strong>
              ${renderPerPesticideYesNo(row, "conventional")}
            </div>

            <div class="misc-detail-line">
              <strong>Organic:</strong>
              ${renderPerPesticideYesNo(row, "organic")}
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

      <tr class="comment-row ${stripeClass}">
          <td colspan="6" class="comment-content-cell">
              <!--<strong>Comments:</strong><br>-->
              ${row.comments || "<em>No comments</em>"}
          </td>
      </tr>
    `;
    }).join("");

    return `
      <div class="pesticide-table-wrapper">
        ${AddTreatmentButton}
        <table class="pesticide-admin-table${restrictedUseKey ? " has-key" : ""}" style="
            border-collapse:collapse;
            width:100%;
            ${options.showDeleted ? "outline:2px solid #b36b00;" : ""}">
          <thead>
            <tr>
              <th>Edit</th>
              ${["id", "product", "rate", "rei", "phi", "resistance", "efficacy"].map(key => renderSortableHeader(key, options.sort)).join("")}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
          ${restrictedUseKey}
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
      //Column header sorting - Added 10-16-2026
      const sortBtn = e.target.closest(".sort-button");
      if (sortBtn) {
        handleSortClick(container, sortBtn.dataset.sortKey);
        return;
      }

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
        //The link sits either in the details row itself or in the Product cell (see DETAILS_TOGGLE_IN_PRODUCT)
        const miscRow = toggleMiscRowBtn.closest("tr.misc-row") ||
          toggleMiscRowBtn.closest("tr.data-row")?.nextElementSibling;
        const details = miscRow?.querySelector(".misc-details");

        if (details) {
          details.classList.toggle("is-hidden");
          const hidden = details.classList.contains("is-hidden");

          //With the link in the Product cell, the details row only takes up space while it is open
          if (DETAILS_TOGGLE_IN_PRODUCT) {
            miscRow.classList.toggle("is-hidden", hidden);
          }

          toggleMiscRowBtn.textContent = hidden ? "See more details" : "Hide details";
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

    replaceTableHtml(container, renderTable(json, {
      showDeleted: container.__showDeleted === true,
      changedSince: container.__changedSince || "",
      sort: container.__treatmentSort || null
    }));

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
      replaceTableHtml(container, renderTable(container.__pesticideJson || [], {
        showDeleted: container.__showDeleted === true,
        changedSince: container.__changedSince || "",
        sort: container.__treatmentSort || null
      }));

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

    replaceTableHtml(container, renderTable(container.__pesticideJson, {
      showDeleted: container.__showDeleted === true,
      changedSince: container.__changedSince || "",
      sort: container.__treatmentSort || null
    }));

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
    formatTimeValue,
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