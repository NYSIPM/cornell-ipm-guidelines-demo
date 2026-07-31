(function (window, document) {
  "use strict";

  const SELECTOR = ".pesticide-summary-public, [data-pesticide-summary]";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalizeSummaryType(value) {
    if (value === 0 || value === "0") return "Insecticide";
    if (value === 1 || value === "1") return "Fungicide";
    if (value === 2 || value === "2") return "Herbicide";

    const text = clean(value).toLowerCase();

    if (text === "insecticide" || text === "insecticides") return "Insecticide";
    if (text === "fungicide" || text === "fungicides") return "Fungicide";
    if (text === "herbicide" || text === "herbicides") return "Herbicide";

    return "";
  }

  function getApiUrl(siteId, summaryType) {
    if (typeof window.TreatmentApiUrl === "function") {
      const baseUrl = window.TreatmentApiUrl(
        `/api/pesticide-summaries/site/${encodeURIComponent(siteId)}`
      );

      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.set("type", summaryType);
      return url.toString();
    }

    const configuredBase =
      window.PesticideSummaryPublicConfig?.apiBaseUrl ||
      "https://webguidelines2.psep.cce.cornell.edu";

    const base = String(configuredBase).replace(/\/$/, "");
    const url = new URL(
      `${base}/api/pesticide-summaries/site/${encodeURIComponent(siteId)}`
    );

    url.searchParams.set("type", summaryType);
    return url.toString();
  }

  function getResistanceHeading(summaryType) {
    switch (normalizeSummaryType(summaryType)) {
      case "Insecticide": return "IRAC Code";
      case "Fungicide": return "FRAC Code";
      case "Herbicide": return "Group Number";
      default: return "Resistance Group";
    }
  }

  function getResistanceCodes(pesticide, summaryType) {
    let values = [];

    switch (normalizeSummaryType(summaryType)) {
      case "Insecticide":
        values = pesticide?.iracCodes;
        break;
      case "Fungicide":
        values = pesticide?.fracCodes;
        break;
      case "Herbicide":
        values = pesticide?.herbicideGroupNumbers;
        break;
      default:
        values = [];
    }

    if (!Array.isArray(values)) return [];

    return Array.from(
      new Set(
        values
          .map(value => clean(value))
          .filter(Boolean)
      )
    );
  }

  function renderMessage(message) {
    return `
      <div class="pesticide-summary pesticide-summary-message">
        ${escapeHtml(message)}
      </div>
    `;
  }

  function renderError(siteId, summaryType, message) {
    return `
      <div class="pesticide-summary pesticide-summary-error">
        <div><strong>Pesticide summary could not be loaded.</strong></div>
        <div class="pesticide-summary-error__detail">SiteId: ${escapeHtml(siteId)}</div>
        <div>Type: ${escapeHtml(summaryType)}</div>
        <div class="pesticide-summary-error__message">${escapeHtml(message)}</div>
      </div>
    `;
  }

  function renderPesticideRow(pesticide, summaryType, groupIndex) {
    const resistanceCodes = getResistanceCodes(pesticide, summaryType);
    const rowClass = groupIndex % 2 === 0 ? "is-even" : "is-odd";

    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(pesticide?.commonName || "")}</td>
        <td>${escapeHtml(pesticide?.tradeName || "")}</td>
        <td>${escapeHtml(pesticide?.epaRegistrationNumber || "")}</td>
        <td>${escapeHtml(pesticide?.phi || "")}</td>
        <td>${escapeHtml(pesticide?.rei || "")}</td>
        <td>${escapeHtml(resistanceCodes.join(", "))}</td>
      </tr>
    `;
  }

  function renderTable(json, requestedSummaryType) {
    const pesticides = Array.isArray(json?.pesticides) ? json.pesticides : [];
    const summaryType =
      normalizeSummaryType(json?.summaryType) ||
      normalizeSummaryType(requestedSummaryType) ||
      "Pesticide";
    const siteId = json?.siteId ?? "";
    const siteName = json?.siteName || (siteId ? `Site ${siteId}` : "Selected Site");
    const resistanceHeading = getResistanceHeading(summaryType);

    if (!pesticides.length) {
      return `
        <div class="pesticide-summary">
          <div class="pesticide-summary__subtitle">${escapeHtml(siteName)}</div>
          <div>No ${escapeHtml(summaryType.toLowerCase())} products were found for this site.</div>
        </div>
      `;
    }

    let currentCommonName = null;
    let groupIndex = -1;

    const bodyRows = pesticides
      .map(pesticide => {
        const commonName = clean(pesticide?.commonName).toLowerCase();

        if (commonName !== currentCommonName) {
          currentCommonName = commonName;
          groupIndex += 1;
        }

        return renderPesticideRow(pesticide, summaryType, groupIndex);
      })
      .join("");

    return `
      <div class="pesticide-summary pesticide-summary--public">
        <div class="pesticide-summary__table-wrap">
          <table class="pesticide-summary__table">
            <thead>
              <tr>
                <th>Common Name</th>
                <th>Trade Name</th>
                <th>EPA Reg. Number</th>
                <th>PHI</th>
                <th>REI</th>
                <th>${escapeHtml(resistanceHeading)}</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
      <div class="pesticide-summary__footer">
        ${escapeHtml(siteName)} &mdash; ${pesticides.length}
        ${pesticides.length === 1 ? "product" : "products"}
      </div>
    `;
  }

  async function readErrorBody(response) {
    try {
      return clean(await response.text());
    } catch {
      return "";
    }
  }

  async function hydrate(container) {
    const siteId = clean(container.getAttribute("data-site-id"));
    const summaryType = normalizeSummaryType(
      container.getAttribute("data-summary-type")
    );
    const loadKey = `${siteId}|${summaryType}`;

    if (container.getAttribute("data-load-key") === loadKey) return;

    if (!siteId || !summaryType) {
      container.innerHTML = renderMessage(
        "This pesticide summary is missing a Site ID or summary type."
      );
      return;
    }

    container.setAttribute("data-load-key", loadKey);
    container.innerHTML = renderMessage("Loading pesticide summary...");

    try {
      if (typeof window.getTreatmentAccessToken !== "function") {
        throw new Error(
          "Authentication is not available. Please log in and reload the page."
        );
      }

      const token = await window.getTreatmentAccessToken();
      if (!token) return;

      const response = await fetch(getApiUrl(siteId, summaryType), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(
          body ? `HTTP ${response.status} — ${body}` : `HTTP ${response.status}`
        );
      }

      const json = await response.json();
      console.log("[PublicPesticideSummary] API response:", json);

      container.__pesticideSummaryJson = json;
      container.innerHTML = renderTable(json, summaryType);
    } catch (error) {
      console.error("[PublicPesticideSummary] Failed to load summary:", error);
      container.removeAttribute("data-load-key");
      container.innerHTML = renderError(
        siteId,
        summaryType,
        error?.message || String(error)
      );
    }
  }

  async function hydrateAll(root) {
    const scope = root || document;
    const containers = Array.from(scope.querySelectorAll(SELECTOR));
    await Promise.all(containers.map(hydrate));
  }

  function start() {
    hydrateAll(document);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (node.matches?.(SELECTOR)) hydrate(node);
          hydrateAll(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  window.PublicPesticideSummary = {
    hydrate,
    hydrateAll,
    renderTable,
    version: "2.1.0"
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  console.log(
    "[PublicPesticideSummary] Loaded:",
    window.PublicPesticideSummary.version
  );
})(window, document);
