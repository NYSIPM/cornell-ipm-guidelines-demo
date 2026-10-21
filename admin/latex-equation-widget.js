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
  // OPTIONAL TITLE
  // =========================================================
  //
  // Without a title an equation is stored as plain display math:
  //
  //   $$
  //   \frac{a+b}{c}
  //   $$
  //
  // With a title it is wrapped in a Pandoc fenced div, title on its own line:
  //
  //   ::: {.latex-equation}
  //   [My title]{.latex-equation-title style="..."}
  //   $$
  //   \frac{a+b}{c}
  //   $$
  //   :::
  //
  // No blank lines anywhere: Decap only matches an editor component against
  // the text up to the first blank line. The style is inline because the
  // publications don't share a site stylesheet; it matches the table titles.

  const TITLE_STYLE = "display:block;margin:0 0 0.5rem;font-size:1.35rem;line-height:1.25;font-weight:600;";

  function normalizeTitle(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  // Backslash-escapes Markdown punctuation so the title is literal text.
  function escapeMarkdown(value) {
    return value.replace(/[\\`*_{}\[\]()#+\-.!$<>|~^]/g, "\\$&");
  }

  function unescapeMarkdown(value) {
    return String(value || "").replace(/\\(.)/g, "$1");
  }

  // Blank lines would end the block early (in Decap and in Pandoc's display math).
  function removeBlankLines(value) {
    return value.split("\n").filter((line) => line.trim()).join("\n");
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
        name: "title",
        label: "Equation Title",
        widget: "string",
        required: false
      },
      {
        name: "latex",
        label: "LaTeX equation",
        widget: "latex_equation_input",
        required: true
      }
    ],

    /*
     * Recognizes an existing display equation, with or without the
     * titled wrapper described under OPTIONAL TITLE above.
     *
     * match[1] = escaped title (undefined when untitled)
     * match[2] = the equation itself
     */
    //
    // Decap first tries this against the whole rest of the document, so the
    // equation body can't run past its own closing $$ ((?!\n\$\$) below), and
    // the match ends at the end of that line rather than the end of the
    // document. Otherwise a page ending in an equation let an earlier equation
    // swallow everything in between.
    pattern: /^(?::::[ \t]*\{\.latex-equation\}[ \t]*\n\[((?:\\.|[^\\\]\n])*)\]\{\.latex-equation-title[^\n]*\}[ \t]*\n)?\$\$[ \t]*\n((?:(?!\n\$\$)[\s\S])*?)\n\$\$(?:[ \t]*\n:::)?[ \t]*(?=\n|$)/,

    /*
     * Converts Markdown already in the file back into the data
     * shown in the editing dialog.
     */
    fromBlock(match) {
      return {
        title: unescapeMarkdown(match?.[1]),
        latex: normalizeLatex(match?.[2])
      };
    },

    /*
     * Converts the dialog value into Quarto/Pandoc Markdown.
     */
    toBlock(data) {
      const latex = removeBlankLines(removeOuterDelimiters(data?.latex));
      const title = normalizeTitle(data?.title);

      if (!latex) {
        return "";
      }

      const math = `$$\n${latex}\n$$`;

      if (!title) {
        return math;
      }

      return (
        "::: {.latex-equation}\n" +
        `[${escapeMarkdown(title)}]{.latex-equation-title style="${TITLE_STYLE}"}\n` +
        math +
        "\n:::"
      );
    },

    /*
     * For this first version, the Decap preview displays the
     * equation source. Quarto renders the formatted equation
     * during the site build.
     */
    toPreview(data) {
        const title = normalizeTitle(data?.title);
        const titleHtml = title
          ? `<div class="latex-equation-title" style="${TITLE_STYLE}">${escapeHtml(title)}</div>`
          : "";

        return titleHtml + renderEquationPreview(removeOuterDelimiters(data?.latex));
    }
  });

  function renderEquationPreview(latex) {
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