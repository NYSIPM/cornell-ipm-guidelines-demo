(function () {
    let helpers = {};

    function h() {
        return helpers;
    }

    function createFakeControlTechniqueRow(type, initialName = "") {
        const normalizedType = type || "P";

        const controlTechnique = {
            controlTechniqueId: 0,
            isMixture: false,
            pesticides: [],
            biologicalControls: [],
            culturalPractices: []
        };

        const fakeRow = {
            controlTechniqueId: 0,
            pesticideId: 0,
            treatment: {
                controlTechnique
            },
            pesticide: null
        };

        if (normalizedType === "P") {
            const pesticide = {
                pesticideId: 0,
                tradeName: initialName,
                commonName: "",
                commonNameUserDefined: false,
                formulation: "",
                epaRegistrationNumber: "",
                deleted: false,
                activeIngredients: [],
                restrictedUse: []
            };

            controlTechnique.pesticides.push(pesticide);
            fakeRow.pesticide = pesticide;
            fakeRow.pesticideId = 0;
        }

        if (normalizedType === "BC") {
            controlTechnique.biologicalControls.push({
                biologicalControlId: 0,
                name: initialName,
                factSheetUrl: "",
                description: "",
                deleted: false
            });
        }

        if (normalizedType === "CP") {
            controlTechnique.culturalPractices.push({
                culturalPracticeId: 0,
                name: initialName,
                description: "",
                deleted: false
            });
        }

        return fakeRow;
    }

    //New Create Product Added 5/26/2026
    async function openProductModalForCreate(container, injectedHelpers, initialValues = {}) {
        helpers = injectedHelpers || helpers;

        const modal = ensureProductModal();
        modal.style.display = "flex";

        modal.__mode = "create";
        modal.__rowKey = null;
        modal.__targetContainer = container;

        const current = modal.querySelector("#product-modal-current");
        const tradeName = initialValues.tradeName || "";

        //Added 6-1-2026
        const initialType = initialValues.type || "P";
        const initialName = initialValues.tradeName || initialValues.name || "";

        let fakeRow = createFakeControlTechniqueRow(initialType, initialName);
        modal.__createRow = fakeRow;
        modal.__createType = initialType;

        /*
        const fakeRow = {
            controlTechniqueId: 0,
            pesticideId: 0,
            treatment: {
                controlTechnique: {
                    controlTechniqueId: 0,
                    isMixture: false,
                    pesticides: [
                        {
                            pesticideId: 0,
                            tradeName: tradeName,
                            commonName: "",
                            commonNameUserDefined: false,
                            formulation: "",
                            epaRegistrationNumber: "",
                            deleted: false,
                            activeIngredients: [],
                            restrictedUse: []
                        }
                    ],
                    biologicalControls: [],
                    culturalPractices: []
                }
            },
            pesticide: {
                pesticideId: 0,
                tradeName: tradeName,
                commonName: "",
                commonNameUserDefined: false,
                formulation: "",
                epaRegistrationNumber: "",
                deleted: false,
                activeIngredients: [],
                restrictedUse: []
            }
        };

        modal.__createRow = fakeRow;
        */

        

        const controlTechnique = fakeRow.treatment.controlTechnique;
        const pesticides = controlTechnique.pesticides || [];

        modal.__pesticides = pesticides;
        modal.__selectedActiveIngredientsByPesticide = {};
        modal.__selectedRestrictedUseIdsByPesticide = {};

        pesticides.forEach((pesticide, index) => {
            modal.__selectedActiveIngredientsByPesticide[index] = [];
            modal.__selectedRestrictedUseIdsByPesticide[index] = [];
        });

        renderCreateControlTechniqueForm(modal);

        await ensureActiveIngredientOptions();

        pesticides.forEach((pesticide, index) => {
            renderSelectedActiveIngredients(modal, index);
            renderAvailableActiveIngredients(modal, "", index);
            syncCommonNamePreview(modal, index);
        });

        modal.__aiPickerBound = false;
        wireProductAiPicker(modal);
    }

    function renderCreateControlTechniqueForm(modal) {
        const current = modal.querySelector("#product-modal-current");
        const fakeRow = modal.__createRow;
        const controlTechnique = fakeRow.treatment.controlTechnique;

        const pesticides = controlTechnique.pesticides || [];
        const biologicalControls = controlTechnique.biologicalControls || [];
        const culturalPractices = controlTechnique.culturalPractices || [];

        current.innerHTML = `
            <div style="margin-bottom:12px; font-size:16px; color:#666;">
                <strong>New Control Technique</strong>
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; font-size:13px;">
                    Control Technique Type
                </label>
                <select class="create-control-technique-type" style="padding:6px; width:260px;">
                    <option value="P" ${modal.__createType === "P" ? "selected" : ""}>Pesticide</option>
                    <option value="BC" ${modal.__createType === "BC" ? "selected" : ""}>Biological Control</option>
                    <option value="CP" ${modal.__createType === "CP" ? "selected" : ""}>Cultural Practice</option>
                </select>
            </div>

            ${pesticides.map((p, i) => renderPesticideEditor(p, i)).join("")}
            ${renderBiologicalControlSections(biologicalControls)}
            ${renderCulturalPracticeSections(culturalPractices)}
        `;
    }

    //Nothing New here.
    async function openProductModal(row, container, injectedHelpers) {
        helpers = injectedHelpers || helpers;

        const modal = ensureProductModal();
        modal.style.display = "flex";

        modal.__mode = "edit";
        modal.__createRow = null;

        modal.__rowKey = h().getRowKey(row);
        modal.__targetContainer = container;

        const current = modal.querySelector("#product-modal-current");
        const controlTechnique = row.treatment?.controlTechnique || {};
        const pesticides = controlTechnique.pesticides || [];
        const biologicalControls = controlTechnique.biologicalControls || [];
        const culturalPractices = controlTechnique.culturalPractices || [];

        modal.__pesticides = pesticides;
        modal.__selectedActiveIngredientsByPesticide = {};
        modal.__selectedRestrictedUseIdsByPesticide = {};

        pesticides.forEach((pesticide, index) => {
        modal.__selectedActiveIngredientsByPesticide[index] =
            (pesticide?.activeIngredients || []).map(ai => ({
            activeIngredientId: ai.activeIngredientId,
            name: ai.name,
            eiq: ai.eiq,
            finalEiq: ai.finalEiq,
            activeIngredientFungicide: ai.activeIngredientFungicide,
            activeIngredientInsecticide: ai.activeIngredientInsecticide,
            activeIngredientHerbicide: ai.activeIngredientHerbicide,
            percentActiveIngredient: ai.percentActiveIngredient ?? ai.percent ?? 0
            }));

        modal.__selectedRestrictedUseIdsByPesticide[index] =
            (pesticide?.restrictedUse || [])
            .map(x => Number(x.restrictedUseId))
            .filter(Number.isFinite);
        });

        current.innerHTML = `
        <div style="margin-bottom:6px; font-size:16px; color:#666;">
            <strong>ControlTechniqueId:</strong> ${h().escapeHtml(row.controlTechniqueId || "")}
        </div>

        ${pesticides.length ? pesticides.map((p, i) => renderPesticideEditor(p, i)).join("") : ""}
        ${renderBiologicalControlSections(biologicalControls)}
        ${renderCulturalPracticeSections(culturalPractices)}
        `;

        await ensureActiveIngredientOptions();

        pesticides.forEach((pesticide, index) => {
        renderSelectedActiveIngredients(modal, index);
        renderAvailableActiveIngredients(modal, "", index);
        syncCommonNamePreview(modal, index);
        });

        modal.__aiPickerBound = false;
        wireProductAiPicker(modal);

        /*
        helpers = injectedHelpers || helpers;

        const modal = ensureProductModal();
        modal.style.display = "flex";

        modal.__rowKey = h().getRowKey(row);
        modal.__targetContainer = container;

        const current = modal.querySelector("#product-modal-current");

        current.innerHTML = 

        modal.__selectedActiveIngredients = (row.pesticide?.activeIngredients || []).map(ai => ({
        activeIngredientId: ai.activeIngredientId,
        name: ai.name,
        eiq: ai.eiq,
        finalEiq: ai.finalEiq,
        activeIngredientFungicide: ai.activeIngredientFungicide,
        activeIngredientInsecticide: ai.activeIngredientInsecticide,
        activeIngredientHerbicide: ai.activeIngredientHerbicide,
        percentActiveIngredient: ai.percentActiveIngredient ?? ai.percent ?? 0
        }));

        modal.__selectedRestrictedUseIds = (row.pesticide?.restrictedUse || [])
            .map(x => Number(x.restrictedUseId))
            .filter(Number.isFinite);

        renderSelectedActiveIngredients(modal);

        await ensureActiveIngredientOptions();
        renderAvailableActiveIngredients(modal);

        modal.__aiPickerBound = false;
        wireProductAiPicker(modal);

        syncCommonNamePreview(modal);
        */
    }

    function renderRestrictedUseCheckboxesForPesticide(pesticide, pesticideIndex) {
        const options = h().editMetadata?.restrictedUses || [];
        const selectedIds = new Set(
            (pesticide?.restrictedUse || [])
            .map(x => Number(x.restrictedUseId))
            .filter(Number.isFinite)
        );

        if (!options.length) {
            return `<div style="font-size:12px; color:#666;">No restricted use options found.</div>`;
        }

        return options.map(opt => {
            const id = Number(opt.restrictedUseId);
            const checked = selectedIds.has(id) ? "checked" : "";

            return `
            <label style="display:block; font-size:12px; margin-bottom:4px;">
                <input type="checkbox"
                    data-product-restricted-use-id="${h().escapeHtml(id)}"
                    data-pesticide-index="${h().escapeHtml(pesticideIndex)}"
                    ${checked}>
                <strong>${h().escapeHtml(opt.symbol || "")}</strong>
                ${opt.description ? ` — ${h().escapeHtml(opt.description)}` : ""}
            </label>
            `;
        }).join("");
    }

    function renderPesticideEditor(pesticide, index) {
        return `
            <div class="pesticide-editor-block"
                data-pesticide-index="${h().escapeHtml(index)}"
                data-pesticide-id="${h().escapeHtml(pesticide?.pesticideId || 0)}"
                style="border:1px solid #ccc; border-radius:6px; padding:12px; margin-top:12px; background:#fafafa;">

                <div style="margin-bottom:6px; font-size:16px; color:#666;">
                    <strong>PesticideId:</strong> ${h().escapeHtml(pesticide?.pesticideId || 0)}
                </div>
            
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
                    <!-- Trade Name -->
                    <div>
                        <label style="display:block; font-weight:600; font-size:13px;">Trade Name</label>
                        <input type="text"
                        class="pesticide-input"
                        data-product-field="tradeName"
                        value="${h().escapeHtml(pesticide?.tradeName || "")}"
                        style="width:100%; padding:6px;">
                    </div>
                    <!-- Common Name -->
                    <div>
                        <label style="display:block; font-weight:600; font-size:13px;">Common Name</label>
                        <input type="text"
                        class="pesticide-input"
                        data-product-field="commonName"
                        value="${h().escapeHtml(pesticide?.commonName || "")}"
                        style="width:100%; padding:6px; box-sizing:border-box; ${pesticide?.commonNameUserDefined ? "" : "background:#eee; color:#666;"}"
                        ${pesticide?.commonNameUserDefined ? "" : "readonly"}>

                        <label style="display:block; font-size:11px; margin-top:4px;">
                        <input type="checkbox"
                            data-product-field="commonNameUserDefined"
                            ${pesticide?.commonNameUserDefined ? "checked" : ""}>
                        Manually enter Common Name (If unchecked this name will be generated from selected Active Ingredients.)
                        </label>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
                    <!-- EPA -->
                    <div>
                        <label style="display:block; font-weight:600; font-size:13px;">EPA Reg #</label>
                        <input type="text"
                        class="pesticide-input"
                        data-product-field="epaRegistrationNumber"
                        value="${h().escapeHtml(pesticide?.epaRegistrationNumber || "")}"
                        style="width:100%; padding:6px;">
                    </div>
                    <!-- Formulation -->
                    <div>
                        <label style="display:block; font-weight:600; font-size:13px;">Formulation</label>
                        <input type="text"
                        class="pesticide-input"
                        data-product-field="formulation"
                        value="${h().escapeHtml(pesticide?.formulation || "")}"
                        style="width:100%; padding:6px;">
                    </div>
                </div>

                <div style="border:1px solid #ccc; border-radius:6px; padding:12px; margin-top:12px; background:#fafafa;">
                    <div style="font-weight:600; font-size:14px; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #ddd;">
                        Active Ingredients
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <div style="font-weight:600; font-size:12px; margin-bottom:6px;">
                                Selected Active Ingredients
                            </div>

                            <div class="product-ai-selected-list" data-pesticide-index="${h().escapeHtml(index)}"
                                style="min-height:220px; max-height:300px; overflow:auto; border:1px solid #ddd; padding:6px; background:#fff;">
                            </div>
                        </div>
                        <div>
                            <label for="product-ai-search" style="font-weight:600; display:block; font-size:12px; margin-bottom:4px;">
                                Search Active Ingredients
                            </label>
                            <input type="text"
                                class="pesticide-input product-ai-search" data-pesticide-index="${h().escapeHtml(index)}"
                                placeholder="Type to filter active ingredients..."
                                style="width:100%; padding:6px; margin-bottom:8px; box-sizing:border-box;">
                            <div style="font-weight:600; font-size:12px; margin-bottom:4px;">
                                Available Active Ingredients
                            </div>
                            <div 
                                class="product-ai-results"
                                data-pesticide-index="${h().escapeHtml(index)}"
                                style="min-height:180px; max-height:260px; overflow:auto; border:1px solid #ddd; padding:6px; background:#fff;">
                                Loading active ingredients...
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:16px; border-radius:6px; border:1px solid #ddd; padding:10px; background:#fafafa;">
                    <div style="font-weight:600; font-size:13px; margin-bottom:6px;">
                        Restricted Use
                    </div>
                    <div id="product-restricted-use-list">
                        ${renderRestrictedUseCheckboxesForPesticide(pesticide, index)}
                    </div>
                </div>
            </div>
        `;
    }

    function renderBiologicalControlSections(items) {
        if (!items.length) return "";

        return `
            <div class="ct-section-card"
                style="border:1px solid #ccc; border-radius:6px; padding:12px; margin-top:12px; background:#fafafa;">

                <div style="font-weight:600; font-size:16px; color:#666; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #ddd;">
                    Biological Controls
                </div>

                ${items.map((item, index) => `
                    <div class="biological-control-editor"
                        data-biological-control-index="${index}"
                        style="border:1px solid #ddd; border-radius:6px; padding:10px; margin-bottom:10px; background:#fff;">

                        <input type="hidden"
                            data-field="biologicalControlId"
                            value="${h().escapeHtml(item.biologicalControlId || 0)}">

                        <div style="margin-bottom:8px; font-size:13px; color:#666;">
                            <strong>BiologicalControlId:</strong>
                            ${h().escapeHtml(item.biologicalControlId || 0)}
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="display:block; font-weight:600; font-size:13px;">Name</label>
                            <input class="pesticide-input"
                                data-field="name"
                                value="${h().escapeHtml(item.name || "")}"
                                style="width:100%; padding:6px; box-sizing:border-box;">
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="display:block; font-weight:600; font-size:13px;">Fact Sheet URL</label>
                            <input class="pesticide-input"
                                data-field="factSheetUrl"
                                value="${h().escapeHtml(item.factSheetUrl || "")}"
                                style="width:100%; padding:6px; box-sizing:border-box;">
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="display:block; font-weight:600; font-size:13px;">Description</label>
                            <textarea class="pesticide-input"
                                    data-field="description"
                                    rows="10"
                                    style="width:100%; min-height:220px; padding:6px; box-sizing:border-box; resize:vertical;">${h().escapeHtml(item.description || "")}</textarea>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function renderCulturalPracticeSections(items) {
        if (!items.length) return "";

        return `
            <div class="ct-section-card"
                style="border:1px solid #ccc; border-radius:6px; padding:12px; margin-top:12px; background:#fafafa;">

                <div style="font-weight:600; font-size:16px; color:#666; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #ddd;">
                    Cultural Practices
                </div>

                ${items.map((item, index) => `
                    <div class="cultural-practice-editor"
                        data-cultural-practice-index="${index}"
                        style="border:1px solid #ddd; border-radius:6px; padding:10px; margin-bottom:10px; background:#fff;">

                        <input type="hidden"
                            data-field="culturalPracticeId"
                            value="${h().escapeHtml(item.culturalPracticeId || 0)}">

                        <div style="margin-bottom:8px; font-size:13px; color:#666;">
                            <strong>CulturalPracticeId:</strong>
                            ${h().escapeHtml(item.culturalPracticeId || 0)}
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="display:block; font-weight:600; font-size:13px;">Name</label>
                            <input class="pesticide-input"
                                data-field="name"
                                value="${h().escapeHtml(item.name || "")}"
                                style="width:100%; padding:6px; box-sizing:border-box;">
                        </div>

                        <div style="margin-bottom:8px;">
                            <label style="display:block; font-weight:600; font-size:13px;">Description</label>
                            <textarea class="pesticide-input"
                                    data-field="description"
                                    rows="10"
                                    style="width:100%; min-height:220px; padding:6px; box-sizing:border-box; resize:vertical;">${h().escapeHtml(item.description || "")}</textarea>
                        </div>
                    </div>
                `).join("")}
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
        <div style="background:#fff; width:min(900px, 92vw); max-height:85vh; overflow:auto; border-radius:8px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0;">Edit Control Technique</h3>
            <button type="button" class="close-product-modal-btn">Close</button>
            </div>

            <div id="product-modal-current" style="margin-bottom:12px;"></div>

            <div style="margin-top:16px; display:flex; gap:8px;">
            <button type="button" class="save-product-fields-btn">Save Product</button>
            <button type="button" class="close-product-modal-btn">Cancel</button>
            </div>
        </div>
        `;

        document.body.appendChild(modal);

        

        //Added 6-1-2026
        if (typeSelect && modal.__mode === "create") {
            const currentName =
                modal.querySelector('[data-product-field="tradeName"]')?.value?.trim() ||
                modal.querySelector('.biological-control-editor [data-field="name"]')?.value?.trim() ||
                modal.querySelector('.cultural-practice-editor [data-field="name"]')?.value?.trim() ||
                "";

            modal.__createType = typeSelect.value;
            modal.__createRow = createFakeControlTechniqueRow(typeSelect.value, currentName);

            renderCreateControlTechniqueForm(modal);

            if (typeSelect.value === "P") {
                await ensureActiveIngredientOptions();

                const pesticides = modal.__createRow.treatment.controlTechnique.pesticides || [];
                modal.__selectedActiveIngredientsByPesticide = {};
                modal.__selectedRestrictedUseIdsByPesticide = {};

                pesticides.forEach((pesticide, index) => {
                    modal.__selectedActiveIngredientsByPesticide[index] = [];
                    modal.__selectedRestrictedUseIdsByPesticide[index] = [];
                    renderSelectedActiveIngredients(modal, index);
                    renderAvailableActiveIngredients(modal, "", index);
                    syncCommonNamePreview(modal, index);
                });

                modal.__aiPickerBound = false;
                wireProductAiPicker(modal);
            }

            return;
        }

        //Added 6-4-2026
        modal.addEventListener("click", async function (e) {
            if (e.target.closest(".close-product-modal-btn")) {
                closeProductModal();
                return;
            }

            const typeSelect = e.target.closest(".create-control-technique-type");

            if (typeSelect && modal.__mode === "create") {
                const currentName =
                modal.querySelector('[data-product-field="tradeName"]')?.value?.trim() ||
                modal.querySelector('.biological-control-editor [data-field="name"]')?.value?.trim() ||
                modal.querySelector('.cultural-practice-editor [data-field="name"]')?.value?.trim() ||
                "";

                modal.__createType = typeSelect.value;
                modal.__createRow = createFakeControlTechniqueRow(typeSelect.value, currentName);

                renderCreateControlTechniqueForm(modal);

                if (typeSelect.value === "P") {
                await ensureActiveIngredientOptions();

                modal.__selectedActiveIngredientsByPesticide = {};
                modal.__selectedRestrictedUseIdsByPesticide = {};

                const pesticides = modal.__createRow.treatment.controlTechnique.pesticides || [];

                pesticides.forEach((pesticide, index) => {
                    modal.__selectedActiveIngredientsByPesticide[index] = [];
                    modal.__selectedRestrictedUseIdsByPesticide[index] = [];
                    renderSelectedActiveIngredients(modal, index);
                    renderAvailableActiveIngredients(modal, "", index);
                    syncCommonNamePreview(modal, index);
                });

                modal.__aiPickerBound = false;
                wireProductAiPicker(modal);
                }

                return;
            }

            const saveBtn = e.target.closest(".save-product-fields-btn");
            if (!saveBtn) return;

        // save logic continues here...
        });

        modal.addEventListener("click", async function (e) {
            const typeSelect = e.target.closest(".create-control-technique-type");
            
            if (e.target.closest(".close-product-modal-btn")) {
                closeProductModal();
                return;
            }

            const saveBtn = e.target.closest(".save-product-fields-btn");
        if (!saveBtn) return;

        /*
        const rowKey = modal.__rowKey;
        const container = modal.__targetContainer;

        if (!rowKey || !container) {
            alert("Could not find the selected product row.");
            return;
        }

        const row = (container.__pesticideRows || [])
            .find(r => h().getRowKey(r) === rowKey);

        if (!row) {
            alert("Could not find product row data.");
            return;
        }
        */

        const container = modal.__targetContainer;

        if (!container) {
            alert("Could not find the target table.");
            return;
        }

        let row = null;

        if (modal.__mode === "create") {
            row = modal.__createRow;
        } else {
            const rowKey = modal.__rowKey;

            if (!rowKey) {
                alert("Could not find the selected product row.");
                return;
            }

            row = (container.__pesticideRows || [])
                .find(r => h().getRowKey(r) === rowKey);

            if (!row) {
                alert("Could not find product row data.");
                return;
            }
        }

        const getProductValue = (field) =>
            modal.querySelector(`[data-product-field="${field}"]`)?.value?.trim() ?? "";

        const pesticidePayloads = Array.from(modal.querySelectorAll(".pesticide-editor-block")).map(block => {
            const pesticideIndex = parseInt(block.dataset.pesticideIndex, 10) || 0;
            const pesticideId = parseInt(block.dataset.pesticideId, 10) || 0;

            const getValue = field =>
            block.querySelector(`[data-product-field="${field}"]`)?.value?.trim() ?? "";

            const commonNameUserDefined =
            !!block.querySelector('[data-product-field="commonNameUserDefined"]')?.checked;

            const restrictedUseIds = Array.from(
            block.querySelectorAll("[data-product-restricted-use-id]:checked")
            )
            .map(x => parseInt(x.dataset.productRestrictedUseId, 10))
            .filter(Number.isFinite);

            return {
                pesticideId,
                tradeName: getValue("tradeName"),
                commonName: commonNameUserDefined
                    ? getValue("commonName")
                    : buildCommonNameFromSelectedAis(modal, pesticideIndex),
                commonNameUserDefined,
                formulation: getValue("formulation"),
                epaRegistrationNumber: getValue("epaRegistrationNumber"),
                deleted: false,
                restrictedUse: restrictedUseIds.map(id => ({ restrictedUseId: id })),
                activeIngredients: (modal.__selectedActiveIngredientsByPesticide?.[pesticideIndex] || []).map(ai => ({
                    activeIngredientId: parseInt(ai.activeIngredientId, 10) || 0,
                    percentActiveIngredient:
                    parseFloat(block.querySelector(`[data-ai-percent-id="${ai.activeIngredientId}"]`)?.value) || 0,
                    name: ai.name ?? null,
                    eiq: ai.eiq ?? null,
                    frac: ai.activeIngredientFungicide?.frac ?? null,
                    irac: ai.activeIngredientInsecticide?.irac ?? null,
                    groupNumber: ai.activeIngredientHerbicide?.groupNumber ?? null
                }))
                };
            });

            const biologicalControlPayloads = Array.from(modal.querySelectorAll(".biological-control-editor"))
            .map(block => ({
                biologicalControlId: parseInt(block.querySelector('[data-field="biologicalControlId"]')?.value, 10) || null,
                name: block.querySelector('[data-field="name"]')?.value?.trim() || "",
                factSheetUrl: block.querySelector('[data-field="factSheetUrl"]')?.value?.trim() || "",
                description: block.querySelector('[data-field="description"]')?.value?.trim() || "",
                deleted: false
            }));

            const culturalPracticePayloads = Array.from(modal.querySelectorAll(".cultural-practice-editor"))
            .map(block => ({
                culturalPracticeId: parseInt(block.querySelector('[data-field="culturalPracticeId"]')?.value, 10) || null,
                name: block.querySelector('[data-field="name"]')?.value?.trim() || "",
                description: block.querySelector('[data-field="description"]')?.value?.trim() || "",
                deleted: false
            }));

            const payload = {
            controlTechniqueId: parseInt(row.controlTechniqueId, 10) || 0,
            isMixture: row.treatment?.controlTechnique?.isMixture ?? false,
            pesticides: pesticidePayloads,
            biologicalControls: biologicalControlPayloads,
            culturalPractices: culturalPracticePayloads
        };

        /*
        const commonName =
            modal.querySelector('[data-product-field="commonName"]')?.value?.trim() ?? "";

        const commonNameUserDefined =
            !!modal.querySelector('[data-product-field="commonNameUserDefined"]')?.checked;

        const restrictedUseIds = Array.from(
            modal.querySelectorAll("[data-product-restricted-use-id]:checked")
            )
            .map(x => parseInt(x.dataset.productRestrictedUseId, 10))
            .filter(Number.isFinite);

        const payload = {
            controlTechniqueId: parseInt(row.controlTechniqueId, 10) || 0,
            isMixture: row.treatment?.controlTechnique?.isMixture ?? false,
            pesticides: [
            {
                pesticideId: parseInt(row.pesticideId, 10) || 0,
                tradeName: getProductValue("tradeName"),

                commonName: commonNameUserDefined ? commonName : buildCommonNameFromSelectedAis(modal),
                commonNameUserDefined: commonNameUserDefined,

                formulation: getProductValue("formulation"),
                epaRegistrationNumber: getProductValue("epaRegistrationNumber"),
                deleted: row.pesticide?.deleted ?? false,
                restrictedUse: restrictedUseIds.map(id => ({restrictedUseId: id})),
                activeIngredients: (modal.__selectedActiveIngredients || []).map(ai => ({
                activeIngredientId: parseInt(ai.activeIngredientId, 10) || 0,
                percentActiveIngredient: parseFloat(modal.querySelector(`[data-ai-percent-id="${ai.activeIngredientId}"]`)?.value) || 0,
                name: ai.name ?? null,
                eiq: ai.eiq ?? null,
                frac: ai.activeIngredientFungicide?.frac ?? null,
                irac: ai.activeIngredientInsecticide?.irac ?? null,
                groupNumber: ai.activeIngredientHerbicide?.groupNumber ?? null
                }))
            }
            ],
            biologicalControls: [],
            culturalPractices: []
        };

        */

        console.log("Save control technique payload:", JSON.stringify(payload, null, 2));

        try {
            saveBtn.disabled = true;

            const response = await fetch("https://localhost:7144/api/Treatments/save-control-technique", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
            });

            const text = await response.text();

            const saved = text ? JSON.parse(text) : {};

            if (!response.ok) {
            console.error("Save pesticide failed:", response.status, text);
            alert("Failed to save product. Check console for details.");
            return;
            }
            
            //Added 5/27/2026
            /*
            const saved = text ? JSON.parse(text) : {};
            if (modal.__mode === "create") {
                const firstPesticidePayload = pesticidePayloads[0] || null;
                const firstPesticideId = saved.pesticideIds?.[0] || 0;

                const selectedCt = {
                    controlTechniqueId: saved.controlTechniqueId || 0,
                    isMixture: saved.isMixture || false,
                    displayName:
                        firstPesticidePayload?.tradeName ||
                        firstPesticidePayload?.commonName ||
                        "New Control Technique",

                    pesticides: firstPesticidePayload ? [
                        {
                            pesticideId: firstPesticideId,
                            tradeName: firstPesticidePayload.tradeName || "",
                            commonName: firstPesticidePayload.commonName || "",
                            formulation: firstPesticidePayload.formulation || "",
                            epaRegistrationNumber: firstPesticidePayload.epaRegistrationNumber || "",
                            activeIngredients: firstPesticidePayload.activeIngredients || [],
                            restrictedUse: firstPesticidePayload.restrictedUse || [],
                            sitePesticide: []
                        }
                    ] : [],

                    biologicalControls: [],
                    culturalPractices: []
                };

                closeProductModal();

                if (h().insertNewTreatmentRow) {
                    h().insertNewTreatmentRow(selectedCt, container);
                } else {
                    await h().reloadTableData(container);
                }

                alert("Control Technique created. Finish the Treatment row and click Save.");
                return;
            }
            */
            if (modal.__mode === "create") {
                const firstPesticidePayload = pesticidePayloads[0] || null;
                const firstPesticideId = saved.pesticideIds?.[0] || 0;

                const firstBiologicalPayload = biologicalControlPayloads[0] || null;
                const firstBiologicalId = saved.biologicalControlIds?.[0] || 0;

                const firstCulturalPayload = culturalPracticePayloads[0] || null;
                const firstCulturalId = saved.culturalPracticeIds?.[0] || 0;

                const selectedCt = {
                    controlTechniqueId: saved.controlTechniqueId || 0,
                    isMixture: saved.isMixture || false,
                    displayName:
                        firstPesticidePayload?.tradeName ||
                        firstPesticidePayload?.commonName ||
                        firstBiologicalPayload?.name ||
                        firstCulturalPayload?.name ||
                        "New Control Technique",

                    pesticides: firstPesticidePayload ? [
                        {
                            pesticideId: firstPesticideId,
                            tradeName: firstPesticidePayload.tradeName || "",
                            commonName: firstPesticidePayload.commonName || "",
                            formulation: firstPesticidePayload.formulation || "",
                            epaRegistrationNumber: firstPesticidePayload.epaRegistrationNumber || "",
                            activeIngredients: firstPesticidePayload.activeIngredients || [],
                            restrictedUse: firstPesticidePayload.restrictedUse || [],
                            sitePesticide: []
                        }
                    ] : [],

                    biologicalControls: firstBiologicalPayload ? [
                        {
                            biologicalControlId: firstBiologicalId,
                            name: firstBiologicalPayload.name || "",
                            factSheetUrl: firstBiologicalPayload.factSheetUrl || "",
                            description: firstBiologicalPayload.description || ""
                        }
                    ] : [],

                    culturalPractices: firstCulturalPayload ? [
                        {
                            culturalPracticeId: firstCulturalId,
                            name: firstCulturalPayload.name || "",
                            description: firstCulturalPayload.description || ""
                        }
                    ] : []
                };

                closeProductModal();

                if (h().insertNewTreatmentRow) {
                    h().insertNewTreatmentRow(selectedCt, container);
                } else {
                    await h().reloadTableData(container);
                }

                alert("Control Technique created. Finish the Treatment row and click Save.");
                return;
            }


            closeProductModal();
            await h().reloadTableData(container);
            alert("Product saved.");

            //closeProductModal();
            //await h().reloadTableData(container);
            //alert("Product saved.");
        } catch (err) {
            console.error(err);
            alert("Failed to save product. Check console.");
        } finally {
            saveBtn.disabled = false;
        }
        });

        return modal;
    }

    //Added 5-6-2026
    function renderRestrictedUseCheckboxes(row) {
        const options = h().editMetadata?.restrictedUses || [];
        const selectedIds = new Set(
            (row.pesticide?.restrictedUse || [])
            .map(x => Number(x.restrictedUseId))
            .filter(Number.isFinite)
        );

        if (!options.length) {
            return `<div style="font-size:12px; color:#666;">No restricted use options found.</div>`;
        }

        return options.map(opt => {
            const id = Number(opt.restrictedUseId);
            const checked = selectedIds.has(id) ? "checked" : "";

            return `
            <label style="display:block; font-size:12px; margin-bottom:4px;">
                <input type="checkbox"
                    data-product-restricted-use-id="${h().escapeHtml(id)}"
                    ${checked}>
                <strong>${h().escapeHtml(opt.symbol || "")}</strong>
                ${opt.description ? ` — ${h().escapeHtml(opt.description)}` : ""}
            </label>
            `;
        }).join("");
    }

    function closeProductModal() {
        const modal = document.getElementById("product-edit-modal");
        if (!modal) return;
        modal.style.display = "none";
        modal.__selectedProduct = null;
        modal.__rowKey = null;
    }

    async function ensureActiveIngredientOptions() {
        if (window.__activeIngredientOptions) {
        return window.__activeIngredientOptions;
        }

        const response = await fetch("https://localhost:7144/api/Treatments/active-ingredient-options");

        if (!response.ok) {
        throw new Error(`Failed to load active ingredients: ${response.status}`);
        }

        window.__activeIngredientOptions = await response.json();
        return window.__activeIngredientOptions;
    }

    function renderSelectedActiveIngredients(modal, pesticideIndex = 0) {
        const list = modal.querySelector(`.product-ai-selected-list[data-pesticide-index="${pesticideIndex}"]`);
        //const list = modal.querySelector("#product-ai-selected-list");
        if (!list) return;

        const selected = modal.__selectedActiveIngredientsByPesticide?.[pesticideIndex] || [];
        //const selected = modal.__selectedActiveIngredients || [];

        if (!selected.length) {
        list.innerHTML = `<div style="font-size:12px; color:#666;">No active ingredients selected.</div>`;
        return;
        }

        list.innerHTML = selected.map(ai => `
            <div style="border:1px solid #ddd; padding:6px; margin-bottom:6px; background:#fff;">
                <strong>${h().escapeHtml(ai.name || "")}</strong>
                <span style="font-size:12px; color:#666;"> AI: ${h().escapeHtml(ai.activeIngredientId)}</span>

                <button type="button"
                        class="remove-product-ai-btn"
                        data-pesticide-index="${h().escapeHtml(pesticideIndex)}"
                        data-active-ingredient-id="${h().escapeHtml(ai.activeIngredientId)}"
                        style="float:right;">
                    Remove
                </button>

                <div style="margin-top:6px;">
                <label style="display:block; font-size:12px;">Percent Active Ingredient</label>
                <input type="number"
                    class="pesticide-input"
                    step="0.0000001"
                    min="0"
                    max="100"
                    data-pesticide-index="${h().escapeHtml(pesticideIndex)}"
                    data-ai-percent-id="${h().escapeHtml(ai.activeIngredientId)}"
                    value="${h().escapeHtml(ai.percentActiveIngredient ?? 0)}"
                    style="width:80px; padding:4px;">
                <span style="font-size:12px; color:#666;">%</span>
                </div>
            </div>
        `).join("");
        /*
        list.innerHTML = selected.map(ai => `
        <div style="border:1px solid #ddd; padding:6px; margin-bottom:6px; background:#fff;">
            <strong>${h().escapeHtml(ai.name || "")}</strong>
            <span style="font-size:12px; color:#666;"> AI: ${h().escapeHtml(ai.activeIngredientId)}</span>
            <button type="button"
            class="remove-product-ai-btn"
            data-active-ingredient-id="${h().escapeHtml(ai.activeIngredientId)}"
            style="float:right;">
            Remove
            </button>
        </div>
        `).join("");
        */
    }

    function renderAvailableActiveIngredients(modal, term = "", pesticideIndex = 0) {
        const results = modal.querySelector(`.product-ai-results[data-pesticide-index="${pesticideIndex}"]`);
        if (!results) return;

        const all = window.__activeIngredientOptions || [];
        const search = term.trim().toLowerCase();

        const selectedIds = new Set(
        (modal.__selectedActiveIngredientsByPesticide?.[pesticideIndex] || [])
            .map(ai => Number(ai.activeIngredientId))
        );

        const matches = all
        .filter(ai => !selectedIds.has(Number(ai.activeIngredientId)))
        .filter(ai => !search || (ai.name || "").toLowerCase().includes(search))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .slice(0, 25);

        if (!matches.length) {
        results.innerHTML = `<div style="font-size:12px; color:#666;">No active ingredients found.</div>`;
        return;
        }

        results.innerHTML = matches.map(ai => `
        <div class="product-ai-option"
            data-pesticide-index="${h().escapeHtml(pesticideIndex)}"
            data-active-ingredient-id="${h().escapeHtml(ai.activeIngredientId)}"
            style="border:1px solid #ddd; padding:6px; margin-bottom:6px; cursor:pointer; background:#fff;">
            <strong>${h().escapeHtml(ai.name || "")}</strong>
            <div style="font-size:12px; color:#666;">
            AI: ${h().escapeHtml(ai.activeIngredientId)}
            </div>
        </div>
        `).join("");
    }


    //Add 5-1-2026
    function wireProductAiPicker(modal) {
        if (modal.__aiPickerBound) return;
        modal.__aiPickerBound = true;

        modal.querySelectorAll(".product-ai-search").forEach(search => {
            const pesticideIndex = parseInt(search.dataset.pesticideIndex, 10) || 0;

            search.addEventListener("input", function () {
            renderAvailableActiveIngredients(modal, search.value, pesticideIndex);
            });
        });

        modal.addEventListener("click", async function (e) {
            const option = e.target.closest(".product-ai-option");
            if (option) {
            const pesticideIndex = parseInt(option.dataset.pesticideIndex, 10) || 0;
            const id = parseInt(option.dataset.activeIngredientId, 10);
            const all = await ensureActiveIngredientOptions();
            const ai = all.find(x => Number(x.activeIngredientId) === id);

            if (!ai) return;

            modal.__selectedActiveIngredientsByPesticide[pesticideIndex] =
                modal.__selectedActiveIngredientsByPesticide[pesticideIndex] || [];

            const selected = modal.__selectedActiveIngredientsByPesticide[pesticideIndex];

            const alreadySelected = selected.some(x => Number(x.activeIngredientId) === id);

            if (!alreadySelected) {
                selected.push(ai);
                selected.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
            }

            const search = modal.querySelector(`.product-ai-search[data-pesticide-index="${pesticideIndex}"]`);

            renderSelectedActiveIngredients(modal, pesticideIndex);
            renderAvailableActiveIngredients(modal, search?.value || "", pesticideIndex);
            syncCommonNamePreview(modal, pesticideIndex);
            return;
            }

            const removeBtn = e.target.closest(".remove-product-ai-btn");
            if (removeBtn) {
            const pesticideIndex = parseInt(removeBtn.dataset.pesticideIndex, 10) || 0;
            const id = parseInt(removeBtn.dataset.activeIngredientId, 10);

            modal.__selectedActiveIngredientsByPesticide[pesticideIndex] =
                (modal.__selectedActiveIngredientsByPesticide[pesticideIndex] || [])
                .filter(ai => Number(ai.activeIngredientId) !== id);

            const search = modal.querySelector(`.product-ai-search[data-pesticide-index="${pesticideIndex}"]`);

            renderSelectedActiveIngredients(modal, pesticideIndex);
            renderAvailableActiveIngredients(modal, search?.value || "", pesticideIndex);
            syncCommonNamePreview(modal, pesticideIndex);
            return;
        }
    });

    modal.querySelectorAll('[data-product-field="commonNameUserDefined"]').forEach(checkbox => {
        const block = checkbox.closest(".pesticide-editor-block");
        const pesticideIndex = parseInt(block?.dataset.pesticideIndex, 10) || 0;
        const commonNameInput = block?.querySelector('[data-product-field="commonName"]');

        checkbox.addEventListener("change", function () {
        if (!commonNameInput) return;

        commonNameInput.readOnly = !checkbox.checked;

        if (checkbox.checked) {
            commonNameInput.style.background = "#fff";
            commonNameInput.style.color = "";
        } else {
            commonNameInput.style.background = "#eee";
            commonNameInput.style.color = "#666";
            commonNameInput.value = buildCommonNameFromSelectedAis(modal, pesticideIndex);
        }
        });
    });
    }
  /*
  function wireProductAiPicker(modal) {
    if (modal.__aiPickerBound) return;
    modal.__aiPickerBound = true;

    const search = modal.querySelector("#product-ai-search");
    const results = modal.querySelector("#product-ai-results");


    const manualCommonName = modal.querySelector('[data-product-field="commonNameUserDefined"]');
    const commonNameInput = modal.querySelector('[data-product-field="commonName"]');

    if (manualCommonName && commonNameInput) {
        manualCommonName.addEventListener("change", function () {
            commonNameInput.readOnly = !manualCommonName.checked;
            if (manualCommonName.checked) {
                commonNameInput.style.background = "#fff";
                commonNameInput.style.color = "";
            } 
            else 
            {
                commonNameInput.style.background = "#eee";
                commonNameInput.style.color = "#666";
                commonNameInput.value = buildCommonNameFromSelectedAis(modal);
            }
        });
    }

    if (!search || !results) return;

    search.addEventListener("input", function () {
      renderAvailableActiveIngredients(modal, search.value);
    });

    results.addEventListener("click", async function (e) {
      const option = e.target.closest(".product-ai-option");
      if (!option) return;

      const id = parseInt(option.dataset.activeIngredientId, 10);
      const all = await ensureActiveIngredientOptions();
      const ai = all.find(x => Number(x.activeIngredientId) === id);

      if (!ai) return;

      modal.__selectedActiveIngredients = modal.__selectedActiveIngredients || [];

      const alreadySelected = modal.__selectedActiveIngredients
        .some(x => Number(x.activeIngredientId) === id);

      if (!alreadySelected) {
        modal.__selectedActiveIngredients.push(ai);
        modal.__selectedActiveIngredients.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );
      }

      renderSelectedActiveIngredients(modal);

      renderAvailableActiveIngredients(modal, search.value);
      syncCommonNamePreview(modal);
    });

    modal.addEventListener("click", function (e) {
        const removeBtn = e.target.closest(".remove-product-ai-btn");
        if (!removeBtn) return;

        const id = parseInt(removeBtn.dataset.activeIngredientId, 10);

        modal.__selectedActiveIngredients = (modal.__selectedActiveIngredients || [])
            .filter(ai => Number(ai.activeIngredientId) !== id);

        renderSelectedActiveIngredients(modal);
        renderAvailableActiveIngredients(modal, search.value);
        syncCommonNamePreview(modal);
    });
  }
  */


    function syncCommonNamePreview(modal, pesticideIndex = 0) {
        const block = modal.querySelector(`.pesticide-editor-block[data-pesticide-index="${pesticideIndex}"]`);
        const manualCommonName = block?.querySelector('[data-product-field="commonNameUserDefined"]');
        const commonNameInput = block?.querySelector('[data-product-field="commonName"]');

        if (!manualCommonName || !commonNameInput) return;

        if (!manualCommonName.checked) {
            commonNameInput.value = buildCommonNameFromSelectedAis(modal, pesticideIndex);
        }
    }
/*
  function syncCommonNamePreview(modal) {
    const manualCommonName = modal.querySelector('[data-product-field="commonNameUserDefined"]');
    const commonNameInput = modal.querySelector('[data-product-field="commonName"]');

    if (!manualCommonName || !commonNameInput) return;

    if (!manualCommonName.checked) {
        commonNameInput.value = buildCommonNameFromSelectedAis(modal);
    }
  }*/

    //Added 5-5-2026
    function buildCommonNameFromSelectedAis(modal, pesticideIndex = 0) {
        return (modal.__selectedActiveIngredientsByPesticide?.[pesticideIndex] || [])
            .map(ai => h().clean ? h().clean(ai.name) : String(ai.name || "").trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .join(", ");
    }

    window.PesticideTableBuilderProductModal = {
        openProductModal,
        openProductModalForCreate
    };
})();

// =========================================================
// PRODUCT MODAL
// =========================================================

/*
function closeProductModal() {
    const modal = document.getElementById("product-edit-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.__selectedProduct = null;
    modal.__rowKey = null;
}

//Added 5-1-2026
async function ensureActiveIngredientOptions() {
    if (window.__activeIngredientOptions) {
      return window.__activeIngredientOptions;
    }

    const response = await fetch("https://localhost:7144/api/Treatments/active-ingredient-options");

    if (!response.ok) {
      throw new Error(`Failed to load active ingredients: ${response.status}`);
    }

    window.__activeIngredientOptions = await response.json();
    return window.__activeIngredientOptions;
}



function renderSelectedActiveIngredients(modal) {
    const list = modal.querySelector("#product-ai-selected-list");
    if (!list) return;

    const selected = modal.__selectedActiveIngredients || [];

    if (!selected.length) {
      list.innerHTML = `<div style="font-size:12px; color:#666;">No active ingredients selected.</div>`;
      return;
    }

    list.innerHTML = selected.map(ai => `
      <div style="border:1px solid #ddd; padding:6px; margin-bottom:6px; background:#fafafa;">
        <strong>${h().escapeHtml(ai.name || "")}</strong>
        <span style="font-size:12px; color:#666;"> AI: ${h().escapeHtml(ai.activeIngredientId)}</span>
        <button type="button"
                class="remove-product-ai-btn"
                data-active-ingredient-id="${h().escapeHtml(ai.activeIngredientId)}"
                style="float:right;">
          Remove
        </button>
      </div>
    `).join("");
}

//Added 5-5-2026
function renderAvailableActiveIngredients(modal, term = "") {
    const results = modal.querySelector("#product-ai-results");
    if (!results) return;

    const all = window.__activeIngredientOptions || [];
    const search = term.trim().toLowerCase();

    const selectedIds = new Set(
      (modal.__selectedActiveIngredients || [])
        .map(ai => Number(ai.activeIngredientId))
    );

    const matches = all
      .filter(ai => !selectedIds.has(Number(ai.activeIngredientId)))
      .filter(ai => !search || (ai.name || "").toLowerCase().includes(search))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .slice(0, 25);

    if (!matches.length) {
      results.innerHTML = `<div style="font-size:12px; color:#666;">No active ingredients found.</div>`;
      return;
    }

    results.innerHTML = matches.map(ai => `
      <div class="product-ai-option"
          data-active-ingredient-id="${h().escapeHtml(ai.activeIngredientId)}"
          style="border:1px solid #ddd; padding:6px; margin-bottom:6px; cursor:pointer;">
        <strong>${h().escapeHtml(ai.name || "")}</strong>
        <div style="font-size:12px; color:#666;">
          AI: ${h().escapeHtml(ai.activeIngredientId)}
        </div>
      </div>
    `).join("");
}
*/
// =========================================================
// HELPER
// =========================================================