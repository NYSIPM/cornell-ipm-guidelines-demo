(function () {
    "use strict";

    const isLocalDev =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    const API_BASE = isLocalDev
        ? "https://webguidelines2.psep.cce.cornell.edu/api/Treatments/search"
        : "https://webguidelines2.psep.cce.cornell.edu/api/Treatments/search";

    function escapeHtml(value) {
        return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    //Buttons and Actions
    function wireTableEvents(container) {
        if (!container) return;

        if (container.__publicTreatmentEventsBound) {
            return;
        }

        container.__publicTreatmentEventsBound = true;

        container.addEventListener("click", function (event) {
            const sortButton =
                event.target.closest(".sort-button");

            if (sortButton) {
                handleSortClick(container, sortButton.dataset.sortKey);
                return;
            }

            const button =
                event.target.closest(".toggle-details-button");

            if (!button) return;

            // The link sits in the Control Technique cell; its details row is the next row,
            // hidden until opened (like the admin table's DETAILS_TOGGLE_IN_PRODUCT layout).
            const mainRow = button.closest("tr");
            const detailsRow = mainRow?.nextElementSibling;
            const details =
                detailsRow?.querySelector(".treatment-details");

            if (!details) return;

            details.classList.toggle("is-hidden");
            const hidden = details.classList.contains("is-hidden");
            detailsRow.classList.toggle("is-hidden", hidden);

            // Without a comments row, the line between treatments goes under whichever
            // of the two rows is the treatment's last visible one.
            if (!detailsRow.nextElementSibling?.classList.contains("comment-row")) {
                mainRow.classList.toggle("treatment-end", hidden);
                detailsRow.classList.toggle("treatment-end", !hidden);
            }

            button.textContent = hidden ? "See more details" : "Hide details";
        });
    }

    //Helpers
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

        if (concentration) text += concentration;
        if (unit) text += (text ? " " : "") + unit;
        if (unitArea) text += "/" + unitArea; // "gal/acre" (no space after the slash)
        if (amountNote) text += (text ? " " : "") + `(${amountNote})`;

        return clean(text);
    }

    // REI / PHI amount with its unit: "12" + "Hours" -> "12 Hours", "1" + "Days" -> "1 Day".
    // defaultUnit is used when no unit was saved (REI has always meant hours, so it passes "hr").
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

        // Uses the saved REI unit (Hours/Days). Before 10-16-2026 this always said "hr", even for Days.
        const rei = formatTimeValue(sp.rei, sp.reiTime, "hr");

        if (rei) {
            parts.push(escapeHtml(rei));
        }

        if (sp.reiReferToLabel) {
            parts.push(renderStatusLabel("Refer To Label"));
        }

        if (sp.reiUntilDry) {
            parts.push(renderStatusLabel("Until Dry"));
        }

        return parts.join("<br>");
    }

    function formatPhi(sitePesticideList) {
        const sp = (sitePesticideList || [])[0];
        if (!sp) return "";

        const parts = [];

        const phi = formatTimeValue(sp.phi, sp.phiTime);

        if (phi) {
            parts.push(escapeHtml(phi));
        }

        if (sp.phiReferToLabel) {
            parts.push(renderStatusLabel("Refer To Label"));
        }

        if (sp.phiUntilDry) {
            parts.push(renderStatusLabel("Until Dry"));
        }

        return parts.join("<br>");
    }

    function getTreatmentType(treatment) {
        const ct = treatment?.controlTechnique;

        if (!ct) return "";

        if ((ct.pesticides || []).length)
            return "pesticide";

        if ((ct.biologicalControls || []).length)
            return "biological";

        if ((ct.culturalPractices || []).length)
            return "cultural";

        return "";
    }
    function getDescriptionText(treatment) {
        const ct = treatment?.controlTechnique;

        const biological =
            (ct?.biologicalControls || [])
                .map(x => clean(x.description))
                .filter(Boolean);

        const cultural =
            (ct?.culturalPractices || [])
                .map(x => clean(x.description))
                .filter(Boolean);

        return [...new Set([...biological, ...cultural])]
            .join("<br>");
    }

    //Sub Functions
    function unique(values) {
        return [...new Set((values || []).filter(Boolean))];
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

        if (iracText && fracText) {
            return `IRAC: ${iracText} / FRAC: ${fracText}`;
        }

        if (iracText) {
            return `IRAC: ${iracText}`;
        }

        if (fracText) {
            return `FRAC: ${fracText}`;
        }

        return "";
    }

    //Comments
    function formatComments(treatment) {
        const SHOW_INDEX = false;
        const comments = (treatment?.comments || []).map(c => {
            const idx = clean(c.indexNumber);
            const text = clean(c.comment || c.commentText);

            if (!text) return "";

            return (SHOW_INDEX && idx)
            ? `${idx}: ${text}`
            : text;
        });
        return unique(comments).join("<br>");
    }

    //Sub Function Rate
    function getControlTechniqueName(treatment)
    {
        const controlTechnique = treatment?.controlTechnique;

        if (!controlTechnique) {
            return "";
        }

        const names = [];

        (controlTechnique.pesticides || []).forEach(pesticide => {
            const tradeName = pesticide?.tradeName?.trim();
            const commonName = pesticide?.commonName?.trim();

            if (tradeName && commonName) {
            names.push(`${tradeName} (${commonName})`);
            } else if (tradeName) {
            names.push(tradeName);
            } else if (commonName) {
            names.push(commonName);
            }
        });

        (controlTechnique.biologicalControls || []).forEach(item => {
            if (item?.name) {
            names.push(item.name);
            }
        });

        (controlTechnique.culturalPractices || []).forEach(item => {
            if (item?.name) {
            names.push(item.name);
            }
        });

        return names.join(", ");
    }
    function getRateText(treatment) {
        const rates = treatment?.treatmentRates || [];
        if (!rates.length) {
            return "";
        }

        return rates
            .map(rate => formatRate(rate))
            .filter(Boolean)
            .join("<br>");
    }

    function getReiText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const values = pesticides
            .map(pesticide =>
            formatRei(pesticide?.sitePesticide)
            )
            .filter(Boolean);

        return [...new Set(values)].join("<br>");
    }

    function getPhiText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const values = pesticides
            .map(pesticide =>
            formatPhi(pesticide?.sitePesticide)
            )
            .filter(Boolean);

        return [...new Set(values)].join("<br>");
    }
    function getResistanceText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];

        const values = pesticides
            .map(pesticide => formatResistance(pesticide))
            .filter(Boolean);

        return unique(values).join("<br>");
    }
    //See More Details
    function getConventionalText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const isConventional = pesticides.some(
            pesticide =>
            pesticide?.pesticideGuideline?.conventional === true
        );
        return isConventional ? "Yes" : "No";
    }
    function getOrganicText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const isOrganic = pesticides.some(
            pesticide =>
            pesticide?.pesticideGuideline?.organic === true
        );
        return isOrganic ? "Yes" : "No";
    }
    function getApplicationMethodText(treatment) {
        return clean(treatment?.applicationMethod?.name);
    }
    function getSiteTimingText(treatment) {
        const timings = (treatment?.siteTimings || [])
            .map(st => clean(st?.name))
            .filter(Boolean);
        return unique(timings).join(", ");
    }
    function getEiqText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const values = pesticides.flatMap(pesticide =>
            (pesticide?.activeIngredients || [])
            .map(ai => clean(ai?.eiq))
            .filter(Boolean)
        );
        return unique(values).join(", ");
    }
    function getFinalEiqText(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const values = pesticides.flatMap(pesticide =>
            (pesticide?.activeIngredients || [])
            .map(ai => clean(ai?.finalEiq))
            .filter(Boolean)
        );
        return unique(values).join(", ");
    }
    //Comments
    function getCommentsHtml(treatment) {
        return formatComments(treatment);
    }

    //Render
    function renderStatusLabel(text) {
        return `
            <span class="treatment-status-label">
                ${escapeHtml(text)}
            </span>
        `;
    }
    function renderRestrictedUseSymbols(treatment) {
        const pesticides = treatment?.controlTechnique?.pesticides || [];
        const symbols = pesticides.flatMap(pesticide =>
            (pesticide?.restrictedUse || [])
                .map(item => {
                    const symbol = clean(item?.symbol);
                    const description = clean(item?.description);

                    if (!symbol) {
                        return "";
                    }

                    return `
                        <span
                            class="restricted-use-symbol"
                            title="${escapeHtml(description)}">
                            ${escapeHtml(symbol)}
                        </span>
                    `;
                })
                .filter(Boolean)
        );
        return unique(symbols).join("");
    }

    // Key under the table for the RestrictedUse symbols it uses, same as the admin table
    // (renderRestrictedUseKey in admin/pesticide-table-builder.js): each symbol + description
    // once, in the order they first appear. "" when no product has a symbol.
    function renderRestrictedUseKey(treatments) {
        const seen = new Set();
        const items = [];

        treatments.forEach(treatment =>
            (treatment?.controlTechnique?.pesticides || []).forEach(pesticide =>
                (pesticide?.restrictedUse || []).forEach(item => {
                    const symbol = clean(item?.symbol);
                    const description = clean(item?.description);
                    const key = `${symbol}|${description}`;

                    if (!symbol || seen.has(key)) return;
                    seen.add(key);
                    items.push({ symbol, description });
                })));

        if (!items.length) return "";

        return `
            <tfoot>
                <tr>
                    <td colspan="6" class="restricted-use-key">
                        ${items.map(item => `<span class="restricted-use-key-item"><span class="restricted-use-symbol">${escapeHtml(item.symbol)}</span> ${escapeHtml(item.description)}</span>`).join("")}
                    </td>
                </tr>
            </tfoot>
        `;
    }

    //Sorting
    // Rows with no value for the active column always sort last, in either direction.
    function getSitePesticides(treatment) {
        return (treatment?.controlTechnique?.pesticides || [])
            .map(pesticide => (pesticide?.sitePesticide || [])[0])
            .filter(Boolean);
    }

    // Normalized to hours like PHI, so an REI of "2 Days" sorts after "24 Hours" (no unit = hours)
    function getReiSortValue(treatment) {
        for (const sp of getSitePesticides(treatment)) {
            const amount = parseFloat(clean(sp.rei));
            if (Number.isNaN(amount)) continue;

            const unit = clean(sp.reiTime).toLowerCase();
            if (unit.startsWith("week")) return amount * 168;
            if (unit.startsWith("day")) return amount * 24;
            return amount;
        }
        return null;
    }

    // Normalized to hours so "2 days" sorts after "24 hours".
    function getPhiSortValue(treatment) {
        for (const sp of getSitePesticides(treatment)) {
            const amount = parseFloat(clean(sp.phi));
            if (Number.isNaN(amount)) continue;

            const unit = clean(sp.phiTime).toLowerCase();
            if (unit.startsWith("week")) return amount * 168;
            if (unit.startsWith("day")) return amount * 24;
            return amount;
        }
        return null;
    }

    const SORT_COLUMNS = [
        {
            key: "name",
            label: "Control Technique",
            type: "text",
            value: getControlTechniqueName
        },
        {
            key: "rate",
            label: "Rate",
            type: "text",
            value: treatment => (treatment?.treatmentRates || [])
                .map(formatRate)
                .filter(Boolean)
                .join(" ")
        },
        {
            key: "rei",
            label: "REI",
            type: "number",
            value: getReiSortValue
        },
        {
            key: "phi",
            label: "PHI",
            type: "number",
            value: getPhiSortValue
        },
        {
            key: "resistance",
            label: "Resistance Mgmt.",
            type: "text",
            value: treatment => getResistanceText(treatment).replace(/<br>/g, " ")
        },
        {
            key: "efficacy",
            label: "Efficacy",
            type: "text",
            value: treatment => clean(treatment?.efficacy?.name)
        }
    ];

    const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base"
    });

    function sortTreatments(treatments, sort) {
        const column = SORT_COLUMNS.find(c => c.key === sort?.key);
        if (!column) return treatments;

        const direction = sort.direction === "desc" ? -1 : 1;

        return treatments
            .map((treatment, index) => ({
                treatment,
                index,
                value: column.value(treatment)
            }))
            .sort((a, b) => {
                const aMissing = a.value === null || a.value === "";
                const bMissing = b.value === null || b.value === "";

                if (aMissing || bMissing) {
                    if (aMissing && bMissing) return a.index - b.index;
                    return aMissing ? 1 : -1;
                }

                const result = column.type === "number"
                    ? a.value - b.value
                    : collator.compare(a.value, b.value);

                return result !== 0 ? result * direction : a.index - b.index;
            })
            .map(entry => entry.treatment);
    }

    // Cycles asc -> desc -> back to the API's default order.
    function handleSortClick(container, key) {
        if (!container.__treatments) return;

        const current = container.__treatmentSort;
        let next = null;

        if (!current || current.key !== key) {
            next = { key, direction: "asc" };
        } else if (current.direction === "asc") {
            next = { key, direction: "desc" };
        }

        container.__treatmentSort = next;
        container.innerHTML = renderTable(container.__treatments, next);

        container
            .querySelector(`.sort-button[data-sort-key="${key}"]`)
            ?.focus();
    }

    function renderSortableHeader(column, sort) {
        const active = sort?.key === column.key;
        const ariaSort = active
            ? (sort.direction === "desc" ? "descending" : "ascending")
            : "none";

        return `
            <th aria-sort="${ariaSort}">
                <button type="button" class="sort-button" data-sort-key="${column.key}">
                    ${escapeHtml(column.label)}
                </button>
            </th>
        `;
    }

    //MAIN
    function renderTable(data, sort) {
        const allTreatments = Array.isArray(data) ? data : [data];

        if (!allTreatments.length) {
        return `<div>No treatments found.</div>`;
        }

        const treatments = sortTreatments(allTreatments, sort);

        const rows = treatments.map((treatment, index) => {
        const rowClass = index % 2 === 0
            ? "treatment-gray"
            : "treatment-white";
        const treatmentType = getTreatmentType(treatment);
        const comments = formatComments(treatment);
        // The treatment's last visible row draws the line between treatments: the comments
        // row if there is one, otherwise the main row (the details row starts hidden).
        const endClass = " treatment-end";
        return `
            <tr class="${rowClass}${comments ? "" : endClass}">
                <td class="treatment-name">
                    <span style="display:none;">
                        ${escapeHtml(treatment.treatmentId)}
                    </span>
                    ${renderRestrictedUseSymbols(treatment)}
                    ${escapeHtml(getControlTechniqueName(treatment))}
                    <div class="product-details-toggle">
                        <button type="button" class="toggle-details-button">See more details</button>
                    </div>
                </td>
                ${
                    treatmentType === "pesticide"
                        ? `
                            <td>${getRateText(treatment)}</td>
                            <td>${getReiText(treatment)}</td>
                            <td>${getPhiText(treatment)}</td>
                            <td>${getResistanceText(treatment)}</td>
                        `
                        : `
                            <td colspan="4" class="treatment-description">
                                ${getDescriptionText(treatment)}
                            </td>
                        `
                }
                <td>${escapeHtml(treatment.efficacy?.name)}</td>
            </tr>
            <tr class="details-row ${rowClass} is-hidden">
                <td colspan="6">
                    <div class="treatment-details is-hidden">
                        <strong>Conventional:</strong>
                        ${getConventionalText(treatment)}

                        &nbsp;&nbsp;

                        <strong>Organic:</strong>
                        ${getOrganicText(treatment)}

                        &nbsp;&nbsp;

                        <strong>Application Method:</strong>
                        ${escapeHtml(getApplicationMethodText(treatment)) || "None"}

                        &nbsp;&nbsp;

                        <strong>Site Timing:</strong>
                        ${escapeHtml(getSiteTimingText(treatment)) || "None"}

                        &nbsp;&nbsp;

                        <strong>EIQ:</strong>
                        ${escapeHtml(getEiqText(treatment)) || "None"}

                        &nbsp;&nbsp;

                        <strong>Final EIQ:</strong>
                        ${escapeHtml(getFinalEiqText(treatment)) || "None"}
                    </div>
                </td>
            </tr>
            ${
                comments
                ? `
                    <tr class="comment-row ${rowClass}${endClass}">
                        <td colspan="6">
                            ${comments}
                        </td>
                    </tr>
                `
                : ""
            }
        `;
        }).join("");

        // Built from the unsorted list so the key's order doesn't change when sorting.
        const restrictedUseKey = renderRestrictedUseKey(allTreatments);

        return `
        <div class="public-treatment-table-wrapper">
            <table class="public-treatment-table${restrictedUseKey ? " has-key" : ""}">
            <thead>
                <tr>
                ${SORT_COLUMNS.map(column => renderSortableHeader(column, sort)).join("")}
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            ${restrictedUseKey}
            </table>
        </div>
        <div class="treatment-table-footer">
            ${allTreatments.length}
            ${allTreatments.length === 1 ? "treatment" : "treatments"}
        </div>
        `;
    }

    //Loader — finds the placeholder(s) dropped in by the
    //{{< pesticide-table >}} shortcode and hydrates them from the API.
    async function hydrateOne(el) {
        const guidelineId = el.dataset.guidelineId;
        const pestId = el.dataset.pestId;
        const siteId = el.dataset.siteId;

        if (!pestId || !siteId) {
            el.innerHTML =
                `<div class="pesticide-table-error">
                    Missing required data attributes.
                </div>`;

            return;
        }

        el.innerHTML =
            `<div class="pesticide-table-loading">
                Loading table...
            </div>`;

        const params = new URLSearchParams({
            guidelineId,
            pestId,
            siteId
        });

        const url = `${API_BASE}?${params.toString()}`;

        try {
            if (
                typeof window.getTreatmentAccessToken !== "function"
            ) {
                throw new Error(
                    "Authentication helper is not loaded."
                );
            }

            const token =
                await window.getTreatmentAccessToken();

            if (!token) {
                return;
            }

            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const responseText = await response.text();

                throw new Error(
                    `HTTP ${response.status}` +
                    (responseText ? `: ${responseText}` : "")
                );
            }

            const data = await response.json();

            el.__treatments = data;
            el.__treatmentSort = null;
            el.innerHTML = renderTable(data);
            wireTableEvents(el);

        } catch (error) {
            console.error(
                "Pesticide table hydration failed:",
                error
            );

            el.innerHTML =
                `<div class="pesticide-table-error">
                    Unable to load pesticide table:
                    ${error.message}
                </div>`;
        }
    }

    function hydrateAll() {
        const elements = document.querySelectorAll(".pesticide-table-public");
        elements.forEach(hydrateOne);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hydrateAll);
    } else {
        hydrateAll();
    }
})();
