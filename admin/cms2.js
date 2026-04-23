(function () {
  if (!window.CMS) return;

  const SEARCH_API_URL = "https://localhost:7144/api/Treatments/search";
  const GUIDELINE_OPTIONS_API_URL = "https://localhost:7144/api/Treatments/guideline-options";

  let guidelineOptionsCache = null;

  async function fetchGuidelineOptions() {
    if (guidelineOptionsCache) return guidelineOptionsCache;

    const response = await fetch(GUIDELINE_OPTIONS_API_URL, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Guideline options fetch failed: HTTP ${response.status}`);
    }

    const json = await response.json();
    guidelineOptionsCache = json;
    console.log("Guideline options loaded:", json);
    return json;
  }

  async function fetchPesticideTableData(pestId, siteId) {
    const url = new URL(SEARCH_API_URL);
    url.searchParams.set("pestId", pestId);
    url.searchParams.set("siteId", siteId);

    const response = await fetch(url.toString(), { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Pesticide table fetch failed: HTTP ${response.status}`);
    }

    return await response.json();
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderOptionList(items, valueField, labelField, placeholder) {
    const options = [`<option value="">${escapeHtml(placeholder)}</option>`];

    (items || []).forEach(item => {
      options.push(
        `<option value="${escapeHtml(item?.[valueField] ?? "")}">
          ${escapeHtml(item?.[labelField] ?? "")}
        </option>`
      );
    });

    return options.join("");
  }

  function findGuidelineById(guidelines, guidelineId) {
    return (guidelines || []).find(g => String(g.guidelineId ?? "") === String(guidelineId ?? "")) || null;
  }

  function buildShortcode(data) {
    const g = (data.guidelineId || "").trim();
    const p = (data.pestId || "").trim();
    const s = (data.siteId || "").trim();
    return `{{< pesticide-table guidelineId="${g}" pestId="${p}" siteId="${s}" >}}`;
  }

  function parseShortcode(block) {
    const getAttr = (name) => {
      const m = block.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
      return m ? m[1] : "";
    };

    return {
      guidelineId: getAttr("guidelineId"),
      pestId: getAttr("pestId"),
      siteId: getAttr("siteId")
    };
  }

  



    function buildSelectElement(items, valueField, labelField, placeholder, selectedValue = "") {
        const select = document.createElement("select");
        select.style.width = "100%";
        select.style.padding = "6px";

        const placeholderOption = document.createElement("option");
        placeholderOption.value = "";
        placeholderOption.textContent = placeholder;
        select.appendChild(placeholderOption);

        (items || []).forEach(item => {
            const opt = document.createElement("option");
            opt.value = String(item?.[valueField] ?? "");
            opt.textContent = String(item?.[labelField] ?? item?.[valueField] ?? "");
            if (String(opt.value) === String(selectedValue ?? "")) {
            opt.selected = true;
            }
            select.appendChild(opt);
        });

        return select;
    }

    function findFieldInputByLabelText(root, labelText) {
        const labels = Array.from(root.querySelectorAll("label"));

        const normalizedTarget = String(labelText || "").replace(/\s+/g, " ").trim().toLowerCase();

        const label = labels.find(l => {
            const text = String(l.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

            return text.includes(normalizedTarget);
        });

        if (!label) {
            console.warn("No label found for:", labelText, labels.map(l => l.textContent));
            return null;
        }

        let wrapper = label.closest("div");
        while (wrapper) {
            const field = wrapper.querySelector("input, select, textarea");
            if (field) return field;
            wrapper = wrapper.parentElement?.closest?.("div") || null;
        }

        return null;
    }

    function replaceInputWithSelect(originalInput, selectEl) {
        if (!originalInput || !selectEl) return null;

        originalInput.style.display = "none";
        originalInput.dataset.enhancedByCms2 = "1";
        originalInput.parentNode.insertBefore(selectEl, originalInput.nextSibling);

        return selectEl;
    }

    function syncSelectToHiddenInput(selectEl, hiddenInput) {
        if (!selectEl || !hiddenInput) return;
        const sync = () => {
            hiddenInput.value = selectEl.value;
            hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
            hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        };

        selectEl.addEventListener("change", sync);
        sync();
    }

    function getGuidelineLabel(g) {
        const name = String(g?.name ?? "").trim();
        const shortName = String(g?.shortName ?? "").trim();
        const id = String(g?.guidelineId ?? "").trim();

        if (name && shortName) return `${name} (${shortName})`;
        if (name) return name;
        if (shortName) return shortName;
        return id ? `Guideline ${id}` : "";
    }

    function getPestLabel(p) {
        const name = String(p?.name ?? "").trim();
        const id = String(p?.pestId ?? "").trim();
        return name ? `${name} (${id})` : `Pest ${id}`;
    }

    function getSiteLabel(s) {
        const name = String(s?.name ?? "").trim();
        const id = String(s?.siteId ?? "").trim();
        return name ? `${name} (${id})` : `Site ${id}`;
    }




    async function enhancePesticideTableEditorFields() {
    const guidelines = await fetchGuidelineOptions();

    const dialog = document.querySelector('[role="dialog"]');
    console.log("Dialog query result:", dialog);

  if (!dialog) return;

  if (dialog.dataset.pesticideTableEnhanced === "1") return;

    const guidelineInput = findFieldInputByLabelText(dialog, "Guideline ID");
    const pestInput = findFieldInputByLabelText(dialog, "Pest ID");
    const siteInput = findFieldInputByLabelText(dialog, "Site ID");

    console.log("Enhancer dialog found:", dialog);
    console.log("Guideline input found:", guidelineInput);
    console.log("Pest input found:", pestInput);
    console.log("Site input found:", siteInput);

    if (!guidelineInput || !pestInput || !siteInput) {
    console.warn("Could not find one or more pesticide-table fields in Decap dialog.");
    return;
    }

  dialog.dataset.pesticideTableEnhanced = "1";

  const guidelineItems = (guidelines || []).map(g => ({
    guidelineId: g.guidelineId,
    label: getGuidelineLabel(g),
    pests: g.pests || [],
    sites: g.sites || []
  }));

  const guidelineSelect = buildSelectElement(
    guidelineItems,
    "guidelineId",
    "label",
    "-- Select Guideline --",
    guidelineInput.value
  );

  const pestSelect = buildSelectElement([], "pestId", "label", "-- Select Guideline First --", pestInput.value);
  const siteSelect = buildSelectElement([], "siteId", "label", "-- Select Guideline First --", siteInput.value);

  pestSelect.disabled = true;
  siteSelect.disabled = true;

  replaceInputWithSelect(guidelineInput, guidelineSelect);
  replaceInputWithSelect(pestInput, pestSelect);
  replaceInputWithSelect(siteInput, siteSelect);

  syncSelectToHiddenInput(guidelineSelect, guidelineInput);
  syncSelectToHiddenInput(pestSelect, pestInput);
  syncSelectToHiddenInput(siteSelect, siteInput);

  function populateDependentSelects(selectedGuidelineId) {
    const selectedGuideline = findGuidelineById(guidelineItems, selectedGuidelineId);

    pestSelect.innerHTML = "";
    siteSelect.innerHTML = "";

    if (!selectedGuideline) {
      pestSelect.appendChild(new Option("-- Select Guideline First --", ""));
      siteSelect.appendChild(new Option("-- Select Guideline First --", ""));
      pestSelect.disabled = true;
      siteSelect.disabled = true;
      pestSelect.value = "";
      siteSelect.value = "";
      pestInput.value = "";
      siteInput.value = "";
      return;
    }

    const pestItems = (selectedGuideline.pests || []).map(p => ({
      pestId: p.pestId,
      label: getPestLabel(p)
    }));

    const siteItems = (selectedGuideline.sites || []).map(s => ({
      siteId: s.siteId,
      label: getSiteLabel(s)
    }));

    const newPestSelect = buildSelectElement(
      pestItems,
      "pestId",
      "label",
      "-- Select Pest --",
      pestInput.value
    );

    const newSiteSelect = buildSelectElement(
      siteItems,
      "siteId",
      "label",
      "-- Select Site --",
      siteInput.value
    );

    pestSelect.innerHTML = newPestSelect.innerHTML;
    siteSelect.innerHTML = newSiteSelect.innerHTML;

    pestSelect.disabled = false;
    siteSelect.disabled = false;

    if (!Array.from(pestSelect.options).some(o => o.value === pestInput.value)) {
      pestSelect.value = "";
      pestInput.value = "";
    }

    if (!Array.from(siteSelect.options).some(o => o.value === siteInput.value)) {
      siteSelect.value = "";
      siteInput.value = "";
    }

    pestInput.dispatchEvent(new Event("input", { bubbles: true }));
    pestInput.dispatchEvent(new Event("change", { bubbles: true }));
    siteInput.dispatchEvent(new Event("input", { bubbles: true }));
    siteInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  guidelineSelect.addEventListener("change", function () {
    populateDependentSelects(guidelineSelect.value);
  });

  populateDependentSelects(guidelineSelect.value);
}

function startEditorFieldEnhancerLoop() {
  setInterval(async () => {
    try {
      await enhancePesticideTableEditorFields();
    } catch (err) {
      console.error("Failed to enhance pesticide-table editor fields:", err);
    }
  }, 500);
}









  CMS.registerEditorComponent({
    id: "pesticide-table",
    label: "Pesticide Table (DB Picker)",
    fields: [
      { name: "guidelineId", label: "Guideline ID", widget: "string", required: false },
      { name: "pestId", label: "Pest ID", widget: "string" },
      { name: "siteId", label: "Site ID", widget: "string" }
    ],

    pattern: /^\s*\{\{(?:<|%)\s*pesticide-table\b[\s\S]*?(?:>|%)\}\}\s*$/m,

    fromBlock: (match) => {
      const block = match?.[0] || "";
      return parseShortcode(block);
    },

    toBlock: (data) => buildShortcode(data),

    toPreview: (data) => {
      const g = (data.guidelineId || "").trim();
      const p = (data.pestId || "").trim();
      const s = (data.siteId || "").trim();

      return `
        <div class="pesticide-table-preview"
             data-guideline-id="${escapeHtml(g)}"
             data-pest-id="${escapeHtml(p)}"
             data-site-id="${escapeHtml(s)}">
          Loading pesticide table...
        </div>
      `;
    }
  });

  async function hydrateAllPesticideTables(previewDoc) {
    const nodes = previewDoc.querySelectorAll(".pesticide-table-preview");
    if (!nodes.length) return;

    for (const node of nodes) {
      if (node.getAttribute("data-loaded") === "1") continue;

      const pestId = node.getAttribute("data-pest-id") || "";
      const siteId = node.getAttribute("data-site-id") || "";

      try {
        const json = await fetchPesticideTableData(pestId, siteId);

        node.__pesticideRows = window.PesticideTableBuilder.buildRows(json);
        node.__pesticideJson = json;

        node.innerHTML = window.PesticideTableBuilder.renderTable(json);
        window.PesticideTableBuilder.wireTableEvents(node);

        node.setAttribute("data-loaded", "1");
      } catch (err) {
        console.error("Pesticide preview failed:", err);
        node.innerHTML = `<div style="color:#b00020;">Preview failed: ${escapeHtml(err.message || String(err))}</div>`;
        node.setAttribute("data-loaded", "1");
      }
    }
  }

  function getPreviewDocument() {
    const iframe =
      document.querySelector("iframe[class*='PreviewPaneFrame']") ||
      document.querySelector("iframe[title*='Preview']") ||
      document.querySelector("iframe");

    return iframe?.contentDocument || null;
  }

  function startPreviewHydrationLoop() {
    setInterval(async () => {
      const previewDoc = getPreviewDocument();
      if (!previewDoc) return;
      await hydrateAllPesticideTables(previewDoc);
    }, 800);
  }

  startPreviewHydrationLoop();
  startEditorFieldEnhancerLoop();
})();