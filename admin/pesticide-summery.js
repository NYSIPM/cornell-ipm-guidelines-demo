(function () {
  "use strict";

  // =========================================================
  // BASIC REQUIREMENTS
  // =========================================================

  if (!window.CMS) {
    console.error(
      "[PesticideSummary] Decap CMS has not been loaded."
    );
    return;
  }

  const CMS = window.CMS;

  const createClass =
    window.createClass ||
    window.React?.createClass;

  if (!createClass) {
    console.error(
      "[PesticideSummary] createClass is unavailable."
    );
    return;
  }

  console.log("[PesticideSummary] Script loaded.");


  // =========================================================
  // CONFIGURATION
  // =========================================================

  const SUMMARY_TYPES = [
    {
      value: "Insecticide",
      label: "Insecticides"
    },
    {
      value: "Fungicide",
      label: "Fungicides"
    },
    {
      value: "Herbicide",
      label: "Herbicides"
    }
  ];

  const shortcodePattern =
    /^{{<\s*pesticide-summary\b[^>]*>}}$/;


  // =========================================================
  // GENERAL HELPERS
  // =========================================================

  function normalizeWidgetValue(value) {
    if (!value) {
      return {};
    }

    if (typeof value.toJS === "function") {
      return value.toJS();
    }

    return value;
  }


  function normalizeSummaryType(value) {
    /*
     * This also handles numeric enum values in case the API
     * serializes the C# enum as a number:
     *
     * 0 = Insecticide
     * 1 = Fungicide
     * 2 = Herbicide
     */

    if (value === 0 || value === "0") {
      return "Insecticide";
    }

    if (value === 1 || value === "1") {
      return "Fungicide";
    }

    if (value === 2 || value === "2") {
      return "Herbicide";
    }

    const normalized = String(value || "")
      .trim()
      .toLowerCase();

    switch (normalized) {
      case "insecticide":
      case "insecticides":
        return "Insecticide";

      case "fungicide":
      case "fungicides":
        return "Fungicide";

      case "herbicide":
      case "herbicides":
        return "Herbicide";

      default:
        return "";
    }
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function getAttributeFromBlock(block, name) {
    const expression = new RegExp(
      `${name}\\s*=\\s*"([^"]*)"`,
      "i"
    );

    const result = String(block || "").match(expression);

    return result ? result[1] : "";
  }


  function getPreviewDocument() {
    const iframe =
      document.querySelector(
        "iframe[class*='PreviewPaneFrame']"
      ) ||
      document.querySelector(
        "iframe[title*='Preview']"
      ) ||
      document.querySelector("iframe");

    return iframe?.contentDocument || null;
  }


  function getApiUrl(siteId, summaryType) {
    if (typeof window.TreatmentApiUrl !== "function") {
      throw new Error(
        "TreatmentApiUrl is unavailable. Make sure cms.js loads before pesticide-summary.js."
      );
    }

    const baseUrl = window.TreatmentApiUrl(
      `/api/pesticide-summaries/site/${encodeURIComponent(siteId)}`
    );

    const url = new URL(baseUrl);

    url.searchParams.set("type", summaryType);

    return url.toString();
  }


  async function getAuthenticationHeaders() {
    if (!window.TreatmentAuth?.authHeaders) {
      throw new Error(
        "Treatment authentication is not ready."
      );
    }

    return await window.TreatmentAuth.authHeaders();
  }


  // =========================================================
  // CUSTOM DECAPP CMS SELECTOR WIDGET
  // =========================================================

  const PesticideSummarySelectorControl = createClass({
    updateValue(changes) {
      const current = normalizeWidgetValue(
        this.props.value
      );

      const next = {
        siteId: current.siteId || "",
        type: normalizeSummaryType(current.type),
        ...changes
      };

      this.props.onChange(next);
    },


    handleSiteIdChange(event) {
      this.updateValue({
        siteId: event.target.value
      });
    },


    handleTypeChange(event) {
      this.updateValue({
        type: normalizeSummaryType(
          event.target.value
        )
      });
    },


    render() {
      const h =
        window.h ||
        window.React.createElement;

      const value = normalizeWidgetValue(
        this.props.value
      );

      const siteId = value.siteId || "";
      const summaryType = normalizeSummaryType(
        value.type
      );

      const fieldStyle = {
        marginBottom: "14px"
      };

      const labelStyle = {
        display: "block",
        fontWeight: "600",
        marginBottom: "5px"
      };

      const inputStyle = {
        width: "100%",
        padding: "8px",
        border: "1px solid #c5c5c5",
        borderRadius: "4px",
        background: "#fff",
        boxSizing: "border-box"
      };

      return h(
        "div",
        {
          style: {
            border: "1px solid #d6d6d6",
            borderRadius: "4px",
            padding: "16px",
            background: "#fff"
          }
        },
        [
          h(
            "div",
            {
              key: "description",
              style: {
                marginBottom: "16px",
                color: "#555"
              }
            },
            "Select a Site ID and the pesticide summary type."
          ),

          h(
            "div",
            {
              key: "siteIdField",
              style: fieldStyle
            },
            [
              h(
                "label",
                {
                  key: "siteIdLabel",
                  style: labelStyle
                },
                "Site ID"
              ),

              h("input", {
                key: "siteIdInput",
                type: "number",
                min: "1",
                step: "1",
                value: siteId,
                placeholder: "Enter SiteId",
                onChange: this.handleSiteIdChange,
                style: inputStyle
              })
            ]
          ),

          h(
            "div",
            {
              key: "typeField",
              style: fieldStyle
            },
            [
              h(
                "label",
                {
                  key: "typeLabel",
                  style: labelStyle
                },
                "Pesticide Summary Type"
              ),

              h(
                "select",
                {
                  key: "typeSelect",
                  value: summaryType,
                  onChange: this.handleTypeChange,
                  style: inputStyle
                },
                [
                  h(
                    "option",
                    {
                      key: "empty",
                      value: ""
                    },
                    "-- Select Summary Type --"
                  ),

                  ...SUMMARY_TYPES.map(option =>
                    h(
                      "option",
                      {
                        key: option.value,
                        value: option.value
                      },
                      option.label
                    )
                  )
                ]
              )
            ]
          )
        ]
      );
    }
  });


  const PesticideSummarySelectorPreview = createClass({
    render() {
      const h =
        window.h ||
        window.React.createElement;

      const value = normalizeWidgetValue(
        this.props.value
      );

      const siteId = value.siteId || "-";

      const summaryType =
        normalizeSummaryType(value.type) || "-";

      return h(
        "span",
        null,
        `Site: ${siteId}, Summary: ${summaryType}`
      );
    }
  });


  CMS.registerWidget(
    "pesticide_summary_selector",
    PesticideSummarySelectorControl,
    PesticideSummarySelectorPreview
  );

  console.log(
    "[PesticideSummary] Registered widget: pesticide_summary_selector"
  );


  // =========================================================
  // DECAPP CMS EDITOR COMPONENT
  // =========================================================

  CMS.registerEditorComponent({
    id: "pesticide-summary",

    label: "Pesticide Summary Table",

    fields: [
      {
        name: "summarySelector",
        label: "Pesticide Summary",
        widget: "pesticide_summary_selector",
        required: true
      }
    ],

    pattern: shortcodePattern,


    fromBlock: match => {
      const block = match?.[0] || "";

      return {
        summarySelector: {
          siteId: getAttributeFromBlock(
            block,
            "siteId"
          ),

          type: normalizeSummaryType(
            getAttributeFromBlock(
              block,
              "type"
            )
          )
        }
      };
    },


    toBlock: data => {
      const selector =
        data.summarySelector || {};

      const siteId = String(
        selector.siteId || ""
      ).trim();

      const summaryType =
        normalizeSummaryType(selector.type);

      return (
        `{{< pesticide-summary ` +
        `siteId="${siteId}" ` +
        `type="${summaryType}" >}}`
      );
    },


    toPreview: data => {
      const selector =
        data.summarySelector || {};

      const siteId = String(
        selector.siteId || ""
      ).trim();

      const summaryType =
        normalizeSummaryType(selector.type);

      return `
        <div
          class="pesticide-summary-preview"
          data-site-id="${escapeHtml(siteId)}"
          data-summary-type="${escapeHtml(summaryType)}">

          Loading pesticide summary...
        </div>
      `;
    }
  });

  console.log(
    "[PesticideSummary] Registered editor component: pesticide-summary"
  );


  // =========================================================
  // PREVIEW HYDRATION
  // =========================================================

  function startPreviewHydrationLoop() {
    window.setInterval(async () => {
      const previewDocument =
        getPreviewDocument();

      if (!previewDocument) {
        return;
      }

      await hydrateAllPesticideSummaries(
        previewDocument
      );
    }, 800);
  }


  async function hydrateAllPesticideSummaries(
    previewDocument
  ) {
    const nodes =
      previewDocument.querySelectorAll(
        ".pesticide-summary-preview"
      );

    if (!nodes.length) {
      return;
    }

    for (const node of nodes) {
      await hydratePesticideSummary(node);
    }
  }


  async function hydratePesticideSummary(node) {
    const siteId = String(
      node.getAttribute("data-site-id") || ""
    ).trim();

    const summaryType =
      normalizeSummaryType(
        node.getAttribute(
          "data-summary-type"
        )
      );

    const loadKey =
      `${siteId}|${summaryType}`;

    /*
     * Prevent the same table from being loaded again
     * every 800 milliseconds.
     */
    if (
      node.getAttribute("data-load-key") ===
      loadKey
    ) {
      return;
    }

    node.setAttribute(
      "data-load-key",
      loadKey
    );

    if (!siteId || !summaryType) {
      node.innerHTML = renderMessage(
        "Select both a Site ID and a pesticide summary type."
      );

      return;
    }

    try {
      node.innerHTML = renderMessage(
        "Loading pesticide summary..."
      );

      const url = getApiUrl(
        siteId,
        summaryType
      );

      console.log(
        "[PesticideSummary] Fetching:",
        url
      );

      const authHeaders =
        await getAuthenticationHeaders();

      const response = await fetch(url, {
        method: "GET",

        headers: {
          Accept: "application/json",
          ...authHeaders
        }
      });

      if (!response.ok) {
        const errorBody =
          await safelyReadResponseText(
            response
          );

        let message =
          `HTTP ${response.status}`;

        if (errorBody) {
          message += ` — ${errorBody}`;
        }

        throw new Error(message);
      }

      const json = await response.json();

      console.log(
        "[PesticideSummary] JSON:",
        json
      );

      node.__pesticideSummaryJson = json;

      node.innerHTML =
        renderPesticideSummaryTable(json);
    } catch (error) {
      console.error(
        "[PesticideSummary] Preview failed:",
        error
      );

      /*
       * Remove the load key after an error so the preview
       * can retry. This can help after an Auth0 redirect or
       * while the local API is restarting.
       */
      node.removeAttribute(
        "data-load-key"
      );

      node.innerHTML =
        renderErrorMessage({
          siteId,
          summaryType,
          message:
            error?.message ||
            String(error)
        });
    }
  }


  async function safelyReadResponseText(
    response
  ) {
    try {
      return await response.text();
    } catch (error) {
      console.warn(
        "[PesticideSummary] Could not read error response:",
        error
      );

      return "";
    }
  }


  // =========================================================
  // TABLE RENDERING
  // =========================================================

  function renderPesticideSummaryTable(json) {
    const pesticides = Array.isArray(
      json?.pesticides
    )
      ? json.pesticides
      : [];

    const summaryType =
      normalizeSummaryType(
        json?.summaryType
      ) || "Pesticide";

    const siteId =
      json?.siteId ?? "";

    const siteName =
      json?.siteName ||
      (siteId
        ? `Site ${siteId}`
        : "Selected Site");

    const resistanceHeading =
      getResistanceHeading(
        summaryType
      );

    if (!pesticides.length) {
      return `
        <div style="${containerStyle()}">
          <h3 style="${titleStyle()}">
            ${escapeHtml(summaryType)} Summary
          </h3>

          <div style="${subtitleStyle()}">
            ${escapeHtml(siteName)}
          </div>

          <div>
            No ${escapeHtml(
              summaryType.toLowerCase()
            )} products were found for this site.
          </div>
        </div>
      `;
    }

    const bodyRows = pesticides
      .map((pesticide, index) => {
        return renderPesticideRow(
          pesticide,
          summaryType,
          index
        );
      })
      .join("");

    return `
      <div style="${containerStyle()}">
        <h3 style="${titleStyle()}">
          ${escapeHtml(summaryType)} Summary
        </h3>

        <div style="${subtitleStyle()}">
          ${escapeHtml(siteName)}
          &mdash;
          ${pesticides.length}
          ${
            pesticides.length === 1
              ? "product"
              : "products"
          }
        </div>

        <div style="overflow-x: auto;">
          <table style="${tableStyle()}">
            <thead>
              <tr>
                <th style="${headingStyle()}">
                  Common Name
                </th>

                <th style="${headingStyle()}">
                  Trade Name
                </th>

                <th style="${headingStyle()}">
                  EPA Registration Number
                </th>

                <th style="${headingStyle()}">
                  PHI
                </th>

                <th style="${headingStyle()}">
                  REI
                </th>

                <th style="${headingStyle()}">
                  ${escapeHtml(
                    resistanceHeading
                  )}
                </th>
              </tr>
            </thead>

            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }


  function renderPesticideRow(
    pesticide,
    summaryType,
    index
  ) {
    const resistanceCodes =
      getResistanceCodes(
        pesticide,
        summaryType
      );

    const rowBackground =
      index % 2 === 0
        ? "#ffffff"
        : "#f8f8f8";

    return `
      <tr style="background: ${rowBackground};">
        <td style="${cellStyle()}">
          ${escapeHtml(
            pesticide?.commonName || ""
          )}
        </td>

        <td style="${cellStyle()}">
          ${escapeHtml(
            pesticide?.tradeName || ""
          )}
        </td>

        <td style="${cellStyle()}">
          ${escapeHtml(
            pesticide?.epaRegistrationNumber ||
            ""
          )}
        </td>

        <td style="${cellStyle()}">
          ${escapeHtml(
            pesticide?.phi || ""
          )}
        </td>

        <td style="${cellStyle()}">
          ${escapeHtml(
            pesticide?.rei || ""
          )}
        </td>

        <td style="${cellStyle()}">
          ${escapeHtml(
            resistanceCodes.join(", ")
          )}
        </td>
      </tr>
    `;
  }


  function getResistanceHeading(
    summaryType
  ) {
    switch (
      normalizeSummaryType(summaryType)
    ) {
      case "Insecticide":
        return "IRAC Code";

      case "Fungicide":
        return "FRAC Code";

      case "Herbicide":
        return "Group Number";

      default:
        return "Resistance Group";
    }
  }


  function getResistanceCodes(
    pesticide,
    summaryType
  ) {
    let values = [];

    switch (
      normalizeSummaryType(summaryType)
    ) {
      case "Insecticide":
        values =
          pesticide?.iracCodes;
        break;

      case "Fungicide":
        values =
          pesticide?.fracCodes;
        break;

      case "Herbicide":
        values =
          pesticide?.herbicideGroupNumbers;
        break;

      default:
        values = [];
        break;
    }

    if (!Array.isArray(values)) {
      return [];
    }

    return Array.from(
      new Set(
        values
          .map(value =>
            String(value || "").trim()
          )
          .filter(Boolean)
      )
    );
  }


  // =========================================================
  // HTML MESSAGE RENDERING
  // =========================================================

  function renderMessage(message) {
    return `
      <div style="${containerStyle()}">
        ${escapeHtml(message)}
      </div>
    `;
  }


  function renderErrorMessage({
    siteId,
    summaryType,
    message
  }) {
    return `
      <div style="${containerStyle()}">
        <div>
          <strong>
            Pesticide summary preview failed.
          </strong>
        </div>

        <div style="margin-top: 8px;">
          SiteId: ${escapeHtml(siteId)}
        </div>

        <div>
          Type: ${escapeHtml(summaryType)}
        </div>

        <div
          style="
            margin-top: 8px;
            color: #b00020;
          ">

          ${escapeHtml(message)}
        </div>
      </div>
    `;
  }


  // =========================================================
  // INLINE PREVIEW STYLES
  // =========================================================

  function containerStyle() {
    return [
      "border: 1px solid #d6d6d6",
      "border-radius: 4px",
      "padding: 16px",
      "background: #ffffff",
      "box-sizing: border-box"
    ].join(";");
  }


  function titleStyle() {
    return [
      "margin-top: 0",
      "margin-bottom: 4px",
      "font-size: 1.35rem"
    ].join(";");
  }


  function subtitleStyle() {
    return [
      "margin-bottom: 14px",
      "color: #555555"
    ].join(";");
  }


  function tableStyle() {
    return [
      "width: 100%",
      "border-collapse: collapse",
      "background: #ffffff"
    ].join(";");
  }


  function headingStyle() {
    return [
      "border: 1px solid #bdbdbd",
      "padding: 8px",
      "text-align: left",
      "vertical-align: top",
      "background: #eeeeee",
      "font-weight: 600"
    ].join(";");
  }


  function cellStyle() {
    return [
      "border: 1px solid #d6d6d6",
      "padding: 8px",
      "text-align: left",
      "vertical-align: top"
    ].join(";");
  }


  // =========================================================
  // START
  // =========================================================

  startPreviewHydrationLoop();

  console.log(
    "[PesticideSummary] Preview hydration started."
  );
})();