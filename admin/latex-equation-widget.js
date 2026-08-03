(function () {
  "use strict";

  if (!window.CMS) {
    console.error(
      "[LaTeX Equation] Decap CMS was not available when the widget loaded."
    );
    return;
  }

  const h = window.h || window.React.createElement;

  // =========================================================
  // HELPERS
  // =========================================================

  function normalizeLatex(value) {
    return String(value || "").trim();
  }

  /**
   * Authors should paste the LaTeX itself rather than including
   * $...$ or $$...$$. This removes common outer delimiters if
   * they are pasted accidentally.
   */
  function removeOuterDelimiters(value) {
    let latex = normalizeLatex(value);

    if (latex.startsWith("$$") && latex.endsWith("$$")) {
      latex = latex.slice(2, -2).trim();
    } else if (
      latex.startsWith("$") &&
      latex.endsWith("$") &&
      latex.length >= 2
    ) {
      latex = latex.slice(1, -1).trim();
    }

    return latex;
  }

  // =========================================================
  // CUSTOM TEXTAREA WIDGET
  // =========================================================

  const LatexEquationControl = createClass({
    handleChange(event) {
      this.props.onChange(event.target.value);
    },

    render() {
      const value = this.props.value || "";
      const fieldLabel =
        this.props.field?.get?.("label") || "LaTeX equation";

      return h(
        "div",
        {
          className: this.props.classNameWrapper
        },
        [
          h(
            "label",
            {
              key: "label",
              htmlFor: this.props.forID,
              style: {
                display: "block",
                marginBottom: "6px",
                fontWeight: "600"
              }
            },
            fieldLabel
          ),

          h("textarea", {
            key: "textarea",
            id: this.props.forID,
            value: value,
            onChange: this.handleChange,
            rows: 8,
            spellCheck: false,
            placeholder: "\\frac{a+b}{c}",
            style: {
              display: "block",
              boxSizing: "border-box",
              width: "100%",
              minHeight: "160px",
              padding: "12px",
              border: "1px solid #b8b8b8",
              borderRadius: "4px",
              fontFamily:
                'Consolas, "Courier New", Courier, monospace',
              fontSize: "14px",
              lineHeight: "1.5",
              resize: "vertical",
              background: "#fff"
            }
          }),

          h(
            "div",
            {
              key: "help",
              style: {
                marginTop: "7px",
                fontSize: "13px",
                lineHeight: "1.4",
                color: "#555"
              }
            },
            "Paste the LaTeX equation only. The equation block delimiters are added automatically."
          )
        ]
      );
    }
  });

  // This preview is used when the widget is used as a regular field.
  const LatexEquationFieldPreview = createClass({
    render() {
      const value = normalizeLatex(this.props.value);

      if (!value) {
        return h(
          "div",
          {
            style: {
              padding: "12px",
              border: "1px dashed #bbb"
            }
          },
          "No equation entered."
        );
      }

      return h(
        "pre",
        {
          style: {
            boxSizing: "border-box",
            margin: "0",
            padding: "12px",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            border: "1px solid #d6d6d6",
            borderRadius: "4px",
            background: "#f7f7f7",
            fontFamily:
              'Consolas, "Courier New", Courier, monospace'
          }
        },
        value
      );
    }
  });

  CMS.registerWidget(
    "latex_equation_input",
    LatexEquationControl,
    LatexEquationFieldPreview
  );

  // =========================================================
  // INSERTABLE EQUATION COMPONENT
  // =========================================================

  CMS.registerEditorComponent({
    id: "latex-equation",

    label: "Equation",

    fields: [
      {
        name: "latex",
        label: "LaTeX equation",
        widget: "latex_equation_input",
        required: true
      }
    ],

    /*
     * Recognizes an existing display equation:
     *
     * $$
     * \frac{a+b}{c}
     * $$
     *
     * The parentheses capture the equation itself as match[1].
     */
    //pattern: /^\$\$\s*\n([\s\S]*?)\n\$\$\s*$/m,
    pattern: /^\$\$\s*\n([\s\S]*?)\n\$\$\s*$/,
    //pattern: /\{\{<\s*latex-equation\s*>\}\}([\s\S]*?)\{\{<\s*\/latex-equation\s*>\}\}/,

    /*
     * Converts Markdown already in the file back into the data
     * shown in the editing dialog.
     */
    fromBlock(match) {
      return {
        latex: normalizeLatex(match?.[1])
      };
    },

    /*
     * Converts the dialog value into Quarto/Pandoc Markdown.
     */
    toBlock(data) {
      const latex = removeOuterDelimiters(data?.latex);

      if (!latex) {
        return "";
      }

      return `$$\n${latex}\n$$`;
    },

    /*
     * For this first version, the Decap preview displays the
     * equation source. Quarto renders the formatted equation
     * during the site build.
     */
    toPreview(data) {
        const latex = removeOuterDelimiters(data?.latex);

        if (!latex) {
            return `
            <div class="latex-equation-preview latex-equation-preview--empty">
                No equation entered.
            </div>
            `;
        }

        if (!window.katex) {
            return `
            <div class="latex-equation-preview">
                <div class="latex-equation-preview__label">
                Equation preview unavailable
                </div>

                <pre class="latex-equation-preview__source">${escapeHtml(
                latex
                )}</pre>
            </div>
            `;
        }

        try {
            const renderedEquation = window.katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
            strict: false
            });

            return `
            <div class="latex-equation-preview">
                <!--
                <div class="latex-equation-preview__label">
                  Equation
                </div>
                -->
                <div class="latex-equation-preview__rendered">
                ${renderedEquation}
                </div>
            </div>
            `;
        } catch (error) {
            console.error("[LaTeX Equation] Preview failed:", error);

            return `
            <div class="latex-equation-preview">
                <div class="latex-equation-preview__error">
                Could not render this equation.
                </div>

                <pre class="latex-equation-preview__source">${escapeHtml(
                latex
                )}</pre>
            </div>
            `;
        }
        }
  });

  CMS.registerPreviewStyle("https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css");
  CMS.registerPreviewStyle("/assets/css/latex.css");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  console.info(
    "[LaTeX Equation] Registered widget and editor component."
  );
})();