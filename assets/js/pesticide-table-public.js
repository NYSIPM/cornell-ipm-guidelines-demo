(function () {
const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE = isLocalDev
  ? "https://webguidelines2.psep.cce.cornell.edu/api/Treatments/search"
  : "https://webguidelines2.psep.cce.cornell.edu/api/Treatments/search";
  /*
  https://localhost:7144/api/Treatments/search"
  */

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

    if (
      !window.PublicTreatmentBuilder ||
      typeof window.PublicTreatmentBuilder.renderTable !==
        "function"
    ) {
      throw new Error(
        "PublicTreatmentBuilder is not loaded."
      );
    }

    el.innerHTML = 
      window.PublicTreatmentBuilder.renderTable(data);
    window.PublicTreatmentBuilder.wireTableEvents(el);

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

  /*
async function hydrateOne(el) {
  const guidelineId = el.dataset.guidelineId;
  const pestId = el.dataset.pestId;
  const siteId = el.dataset.siteId;

  if (!pestId || !siteId) {
    el.innerHTML = `<div class="pesticide-table-error">Missing required data attributes.</div>`;
    return;
  }

  el.innerHTML = `<div class="pesticide-table-loading">Loading table...</div>`;

  
  const params = new URLSearchParams({
    guidelineId,
    pestId,
    siteId
  });

  const url = `${API_BASE}?${params.toString()}`;


  try {
    const token = await window.getTreatmentAccessToken();

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
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    el.innerHTML = window.PublicTreatmentBuilder.renderTable(data); //window.PesticideTableBuilder.renderTable(data);

  } catch (error) {
    console.error("Pesticide table hydration failed:", error);
    el.innerHTML = `<div class="pesticide-table-error">Unable to load pesticide table: ${error.message}</div>`;
  }
}
*/

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