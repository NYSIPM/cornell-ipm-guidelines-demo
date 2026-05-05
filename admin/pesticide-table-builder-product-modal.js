(function () {
  let helpers = {};

  function h() {
    return helpers;
  }

  async function openProductModal(row, container, injectedHelpers) {
    helpers = injectedHelpers || helpers;

    const modal = ensureProductModal();
    modal.style.display = "flex";

    modal.__rowKey = h().getRowKey(row);
    modal.__targetContainer = container;

    const current = modal.querySelector("#product-modal-current");

    current.innerHTML = `
      <div style="margin-bottom:8px;">
        <strong>PesticideId:</strong> ${h().escapeHtml(row.pesticideId || "")}
      </div>

      <div style="margin-bottom:8px;">
        <label style="display:block; font-size:12px;">Trade Name</label>
        <input type="text" data-product-field="tradeName"
          value="${h().escapeHtml(row.pesticide?.tradeName || "")}"
          style="width:100%; padding:6px;">
      </div>

      <div style="margin-bottom:8px;">
        <label style="display:block; font-size:12px;">EPA Registration Number</label>
        <input type="text" data-product-field="epaRegistrationNumber"
          value="${h().escapeHtml(row.pesticide?.epaRegistrationNumber || "")}"
          style="width:100%; padding:6px;">
      </div>

      <div style="margin-bottom:8px;">
        <label style="display:block; font-size:12px;">Formulation</label>
        <input type="text" data-product-field="formulation"
          value="${h().escapeHtml(row.pesticide?.formulation || "")}"
          style="width:100%; padding:6px;">
      </div>



      <div style="margin-bottom:8px; border:1px solid #ddd; padding:10px; background:#fafafa;">
        <label style="display:block; font-size:12px; margin-bottom:6px;">
            <input type="checkbox"
                data-product-field="commonNameUserDefined"
                ${row.pesticide?.commonNameUserDefined ? "checked" : ""}>
                Manually enter Common Name
            </label>

            <label style="display:block; font-size:12px;">Common Name</label>
            <input type="text"
                data-product-field="commonName"
                value="${h().escapeHtml(row.pesticide?.commonName || "")}"
                style="width:100%; padding:6px; box-sizing:border-box;"
                ${row.pesticide?.commonNameUserDefined ? "" : "readonly"}>

            <div style="font-size:12px; color:#666; margin-top:4px;">
                If unchecked, this will be generated from selected Active Ingredients.
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

            <div id="product-ai-selected-list"
                style="min-height:220px; max-height:300px; overflow:auto; border:1px solid #ddd; padding:6px; background:#fff;">
            </div>
            </div>

            <div>
            <label for="product-ai-search" style="font-weight:600; display:block; font-size:12px; margin-bottom:4px;">
                Search Active Ingredients
            </label>

            <input type="text"
                    id="product-ai-search"
                    placeholder="Type to filter active ingredients..."
                    style="width:100%; padding:6px; margin-bottom:8px; box-sizing:border-box;">

            <div style="font-weight:600; font-size:12px; margin-bottom:4px;">
                Available Active Ingredients
            </div>

            <div id="product-ai-results"
                style="min-height:180px; max-height:260px; overflow:auto; border:1px solid #ddd; padding:6px; background:#fff;">
                Loading active ingredients...
            </div>
            </div>

        </div>
    </div>
    `;

    modal.__selectedActiveIngredients = (row.pesticide?.activeIngredients || []).map(ai => ({
      activeIngredientId: ai.activeIngredientId,
      name: ai.name,
      eiq: ai.eiq,
      finalEiq: ai.finalEiq,
      activeIngredientFungicide: ai.activeIngredientFungicide,
      activeIngredientInsecticide: ai.activeIngredientInsecticide,
      activeIngredientHerbicide: ai.activeIngredientHerbicide
    }));

    renderSelectedActiveIngredients(modal);

    await ensureActiveIngredientOptions();
    renderAvailableActiveIngredients(modal);

    modal.__aiPickerBound = false;
    wireProductAiPicker(modal);
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
          <h3 style="margin:0;">Edit Product</h3>
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

    modal.addEventListener("click", async function (e) {
      if (e.target.closest(".close-product-modal-btn")) {
        closeProductModal();
        return;
      }

      const saveBtn = e.target.closest(".save-product-fields-btn");
      if (!saveBtn) return;

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

      const getProductValue = (field) =>
        modal.querySelector(`[data-product-field="${field}"]`)?.value?.trim() ?? "";

      const payload = {
        controlTechniqueId: parseInt(row.controlTechniqueId, 10) || 0,
        isMixture: row.treatment?.controlTechnique?.isMixture ?? false,
        pesticides: [
          {
            pesticideId: parseInt(row.pesticideId, 10) || 0,
            tradeName: getProductValue("tradeName"),
            commonName: row.pesticide?.commonName ?? "",
            commonNameUserDefined: row.pesticide?.commonNameUserDefined ?? false,
            formulation: getProductValue("formulation"),
            epaRegistrationNumber: getProductValue("epaRegistrationNumber"),
            deleted: row.pesticide?.deleted ?? false,
            activeIngredients: (modal.__selectedActiveIngredients || []).map(ai => ({
              activeIngredientId: parseInt(ai.activeIngredientId, 10) || 0,
              percentActiveIngredient: 0,
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

      console.log("Save control technique payload:", JSON.stringify(payload, null, 2));

      try {
        saveBtn.disabled = true;

        const response = await fetch("https://localhost:7144/api/Treatments/save-control-technique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const text = await response.text();

        if (!response.ok) {
          console.error("Save pesticide failed:", response.status, text);
          alert("Failed to save product. Check console for details.");
          return;
        }

        closeProductModal();
        await h().reloadTableData(container);
        alert("Product saved.");
      } catch (err) {
        console.error(err);
        alert("Failed to save product. Check console.");
      } finally {
        saveBtn.disabled = false;
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

  function wireProductAiPicker(modal) {
    if (modal.__aiPickerBound) return;
    modal.__aiPickerBound = true;

    const search = modal.querySelector("#product-ai-search");
    const results = modal.querySelector("#product-ai-results");

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
    });

    modal.addEventListener("click", function (e) {
      const removeBtn = e.target.closest(".remove-product-ai-btn");
      if (!removeBtn) return;

      const id = parseInt(removeBtn.dataset.activeIngredientId, 10);

      modal.__selectedActiveIngredients = (modal.__selectedActiveIngredients || [])
        .filter(ai => Number(ai.activeIngredientId) !== id);

      renderSelectedActiveIngredients(modal);
      renderAvailableActiveIngredients(modal, search.value);
    });
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

  function renderSelectedActiveIngredients(modal) {
    const list = modal.querySelector("#product-ai-selected-list");
    if (!list) return;

    const selected = modal.__selectedActiveIngredients || [];

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
          data-active-ingredient-id="${h().escapeHtml(ai.activeIngredientId)}"
          style="float:right;">
          Remove
        </button>
      </div>
    `).join("");
  }

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
        style="border:1px solid #ddd; padding:6px; margin-bottom:6px; cursor:pointer; background:#fff;">
        <strong>${h().escapeHtml(ai.name || "")}</strong>
        <div style="font-size:12px; color:#666;">
          AI: ${h().escapeHtml(ai.activeIngredientId)}
        </div>
      </div>
    `).join("");
  }

  window.PesticideTableBuilderProductModal = {
    openProductModal
  };
})();

// =========================================================
// PRODUCT MODAL
// =========================================================
/*
async function openProductModal(row, container) {
    const modal = ensureProductModal();
    modal.style.display = "flex";

    modal.__rowKey = h().getRowKey(row);
    modal.__targetContainer = container;

    const current = modal.querySelector("#product-modal-current");
    current.innerHTML = `
        <div style="margin-bottom:8px;">
        <strong>PesticideId:</strong> ${h().escapeHtml(row.pesticideId || "")}
        </div>

        <div style="margin-bottom:8px;">
        <label style="display:block; font-size:12px;">Trade Name</label>
        <input type="text"
                data-product-field="tradeName"
                value="${h().escapeHtml(row.pesticide?.tradeName || "")}"
                style="width:100%; padding:6px;">
        </div>

        <div style="margin-bottom:8px;">
        <label style="display:block; font-size:12px;">EPA Registration Number</label>
        <input type="text"
                data-product-field="epaRegistrationNumber"
                value="${h().escapeHtml(row.pesticide?.epaRegistrationNumber || "")}"
                style="width:100%; padding:6px;">
        </div>

        <div style="margin-bottom:8px;">
        <label style="display:block; font-size:12px;">Formulation</label>
        <input type="text"
                data-product-field="formulation"
                value="${h().escapeHtml(row.pesticide?.formulation || "")}"
                style="width:100%; padding:6px;">
        </div>

        <div style="margin-bottom:8px;">
        <strong>Common Name:</strong>
        ${h().escapeHtml(row.pesticide?.commonName || "")}
        <div style="font-size:12px; color:#666;">Common Name editing can be added next.</div>
        </div>

        <div style="border-top:1px solid #ddd; margin-top:12px; padding-top:12px;">
        <div style="font-weight:600; margin-bottom:8px;">Active Ingredients</div>

        <label for="product-ai-search" style="display:block; font-size:12px; margin-bottom:4px;">
            Search Active Ingredients
        </label>

        <input type="text"
                id="product-ai-search"
                placeholder="Type to filter active ingredients..."
                style="width:100%; padding:6px; margin-bottom:8px;">

        <div style="font-weight:600; font-size:12px; margin-bottom:4px;">
            Available Active Ingredients
        </div>

        <div id="product-ai-results" style="max-height:180px; overflow:auto; border:1px solid #ddd; padding:6px; margin-bottom:10px;">
            Loading active ingredients...
        </div>
        </div>
    `;

    modal.__selectedActiveIngredients = (row.pesticide?.activeIngredients || []).map(ai => ({
        activeIngredientId: ai.activeIngredientId,
        name: ai.name,
        eiq: ai.eiq,
        finalEiq: ai.finalEiq
    }));

    renderSelectedActiveIngredients(modal);

    await ensureActiveIngredientOptions();
    renderAvailableActiveIngredients(modal);

    modal.__aiPickerBound = false;
    wireProductAiPicker(modal);
}
*/

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

        <div id="product-modal-current" style="margin-bottom:12px;"></div>

        <div style="margin-top:16px; display:flex; gap:8px;">
          <button type="button" class="save-product-fields-btn">Save Product</button>
          <button type="button" class="close-product-modal-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", async function(e) {
      if (e.target.closest(".close-product-modal-btn")) {
        closeProductModal();
        return;
      }

      const saveBtn = e.target.closest(".save-product-fields-btn");
      if (!saveBtn) return;

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

      const getProductValue = (field) =>
        modal.querySelector(`[data-product-field="${field}"]`)?.value?.trim() ?? "";

      const payload = {
        controlTechniqueId: parseInt(row.controlTechniqueId, 10) || 0,
        isMixture: row.treatment?.controlTechnique?.isMixture ?? false,

        pesticides: [
          {
            pesticideId: parseInt(row.pesticideId, 10) || 0,
            tradeName: getProductValue("tradeName"),

            // For now this preserves the existing value.
            // Later we will update this from the manual common-name UI.
            commonName: row.pesticide?.commonName ?? "",
            commonNameUserDefined: row.pesticide?.commonNameUserDefined ?? false,

            formulation: getProductValue("formulation"),
            epaRegistrationNumber: getProductValue("epaRegistrationNumber"),
            deleted: row.pesticide?.deleted ?? false,

            activeIngredients: (modal.__selectedActiveIngredients || []).map(ai => ({
              activeIngredientId: parseInt(ai.activeIngredientId, 10) || 0,
              percentActiveIngredient: 0,
              name: ai.name ?? null,
              eiq: ai.eiq ?? null,
              frac: ai.activeIngredientFungicide?.frac ?? null,
              irac: ai.activeIngredientInsecticide?.irac ?? null,
              groupNumber: ai.activeIngredientHerbicide?.groupNumber ?? null
            }))
          }
          /*
          {
            pesticideId: parseInt(row.pesticideId, 10) || 0,
            tradeName: getProductValue("tradeName"),
            commonName: row.pesticide?.commonName ?? "",
            commonNameUserDefined: row.pesticide?.commonNameUserDefined ?? false,
            formulation: getProductValue("formulation"),
            epaRegistrationNumber: getProductValue("epaRegistrationNumber"),
            deleted: row.pesticide?.deleted ?? false
          }*/
        ],

        biologicalControls: [],
        culturalPractices: []
      };

      console.log("Save control technique payload:", JSON.stringify(payload, null, 2));

      try {
        saveBtn.disabled = true;

        const response = await fetch("https://localhost:7144/api/Treatments/save-control-technique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const text = await response.text();

        if (!response.ok) {
          console.error("Save pesticide failed:", response.status, text);
          alert("Failed to save product. Check console for details.");
          return;
        }

        closeProductModal();
        await h().reloadTableData(container);
        alert("Product saved.");
      } catch (err) {
        console.error(err);
        alert("Failed to save product. Check console.");
      } finally {
        saveBtn.disabled = false;
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

//Add 5-1-2026
function wireProductAiPicker(modal) {
    if (modal.__aiPickerBound) return;
    modal.__aiPickerBound = true;

    const search = modal.querySelector("#product-ai-search");
    const results = modal.querySelector("#product-ai-results");

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
    });

    modal.addEventListener("click", function (e) {
      const removeBtn = e.target.closest(".remove-product-ai-btn");
      if (!removeBtn) return;

      const id = parseInt(removeBtn.dataset.activeIngredientId, 10);

      modal.__selectedActiveIngredients = (modal.__selectedActiveIngredients || [])
        .filter(ai => Number(ai.activeIngredientId) !== id);

      renderSelectedActiveIngredients(modal);
    });
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

    /*
    window.__activeIngredientOptions = await response.json();
    console.log("Loaded active ingredients:", window.__activeIngredientOptions);
    return window.__activeIngredientOptions;
    */
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

// =========================================================
// HELPER
// =========================================================