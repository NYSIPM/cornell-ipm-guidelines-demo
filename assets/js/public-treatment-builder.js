(function () {
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
            const button =
                event.target.closest(".toggle-details-button");

            if (!button) return;

            const detailsRow =
                button.closest(".details-row");

            const details =
                detailsRow?.querySelector(".treatment-details");

            if (!details) return;

            details.classList.toggle("is-hidden");

            button.textContent =
                details.classList.contains("is-hidden")
                    ? "See more details"
                    : "Hide details";
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
            parts.push(escapeHtml(`${rei} hr`));
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

        const phi = clean(sp.phi);
        const phiTime = clean(sp.phiTime);

        if (phi) {
            const phiText = phiTime
                ? `${phi} ${phiTime}`
                : phi;

            parts.push(escapeHtml(phiText));
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

    //MAIN
    function renderTable(data) {
        const treatments = Array.isArray(data) ? data : [data];

        if (!treatments.length) {
        return `<div>No treatments found.</div>`;
        }

        const rows = treatments.map((treatment, index) => {
        const rowClass = index % 2 === 0
            ? "treatment-gray"
            : "treatment-white";
        const treatmentType = getTreatmentType(treatment);
        return `
            <tr class="${rowClass}">
                <td class="treatment-name">
                    <span style="display:none;">
                        ${escapeHtml(treatment.treatmentId)}
                    </span>
                    ${renderRestrictedUseSymbols(treatment)}
                    ${escapeHtml(getControlTechniqueName(treatment))}
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
            <tr class="details-row ${rowClass}">
                <td colspan="6">
                    <button type="button" class="toggle-details-button">
                        See more details
                    </button>

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
                formatComments(treatment)
                ? `
                    <tr class="comment-row ${rowClass}">
                        <td colspan="6">
                            ${formatComments(treatment)}
                        </td>
                    </tr>
                `
                : ""
            }
        `;
        }).join("");

        return `
        <div class="public-treatment-table-wrapper">
            <table class="public-treatment-table">
            <thead>
                <tr>
                <th>Control Technique</th>
                <th>Rate</th>
                <th>REI</th>
                <th>PHI</th>
                <th>Resistance Mgmt.</th>
                <th>Efficacy</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            </table>
        </div>
        `;
    }

    window.PublicTreatmentBuilder = {
        renderTable,
        wireTableEvents,
        version: "basic-v2"
    };

    console.log(
        "Loaded PublicTreatmentBuilder:",
        window.PublicTreatmentBuilder.version
    );
})();