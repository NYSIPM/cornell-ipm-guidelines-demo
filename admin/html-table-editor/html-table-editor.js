// admin/html-table-editor/html-table-editor.js
//
// Self-contained Decap CMS widget + editor component for generating and
// editing an inline HTML <table>, including merging/splitting cells
// (rowspan/colspan). No dependency on TinyMCE or any table-editing
// library -- plain React-style grid built on the createClass/h helpers
// Decap already exposes, parsing/serializing tables with the browser's
// native DOMParser. Independent of tinymce-table-widget.js /
// editor-components.js (the "html-table" component), so neither existing
// file needs to change.
//
// Storage format (written into the .qmd source):
//
//   ```{=html}
//   <!-- html-table-editor -->
//   <table>...</table>
//   ```
//
// A Pandoc raw-HTML block, not a Quarto {{< shortcode >}}: the table is
// literal markup that should be output verbatim, not a reference resolved
// by a Lua filter at build time. (Earlier versions of this file used bare
// <!-- start/end --> comment delimiters instead, to avoid colliding with
// the legacy TinyMCE-based "html-table" component's pattern, which
// matched any ```{=html} fence containing a <table>. That component has
// since been removed, so the fence form is back -- it's Pandoc's more
// explicit, idiomatic way to mark a raw block.)
//
// Inside the fence: an optional title <div>, a one-line <style
// data-html-table-style> (see TABLE_CSS), then the <table> inside a
// <div class="html-table-wrap"> (header rows in <thead>, body rows in
// <tbody>, and the optional footnote as the only <tfoot> row,
// <tr data-table-footnote>), then -- only when some header cell is
// a sort key (<th data-sort-col="N">) -- a small <script data-html-table-sort>
// that makes those columns sortable. See enhanceSortableTables().
//
// GRID MODEL
// ----------
// `rows` is a full logical grid: rows[r][c] is either
//   - an origin cell object { text, rowSpan, colSpan } (top-left of a
//     merge, or an ordinary 1x1 cell), or
//   - null, meaning this position is covered by some other origin cell's
//     rowSpan/colSpan and gets no <td> of its own (same as how HTML
//     tables represent merges).
// Every row has the same length (colCount), ghosts included, so the
// model always looks "rectangular" even though rendered cells don't.

(function () {
  "use strict";

  if (!window.CMS) {
    console.error("[HTML Table Editor] Decap CMS was not available when the widget loaded.");
    return;
  }

  const createClass = window.createClass;
  const h = window.h || (window.React && window.React.createElement);

  if (!createClass || !h) {
    console.error("[HTML Table Editor] Decap helpers createClass/h not found.");
    return;
  }

  const WIDGET_NAME = "html_table_editor_input";
  const COMPONENT_ID = "html-table-editor";
  const MARKER = "html-table-editor";
  const MAX_HISTORY = 50;

  // =========================================================
  // GRID HELPERS
  // =========================================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================
  // INLINE FORMATTING (cells and footnote)
  // =========================================================
  //
  // Cell and footnote text is plain text plus a small, fixed set of
  // Pandoc-style inline Markdown, turned into HTML when the table is saved:
  //
  //   **bold**   *italic*   [text](https://...)   ^superscript^   ~subscript~
  //   a new line (Enter) inside a cell -> line break
  //   \*  \^  \~  \[  \]  \\  -> that character, literally
  //
  // Marked text can't start or end with a space, so a lone "*" (e.g. a
  // restricted-use symbol) or "a * b" stays literal. markupFromElement() is
  // the exact inverse, so a saved table reopens with the same text.
  //
  // To add a format: a rule in formatSpans() (or a token like links), its
  // reverse in markupFromElement(), and a FORMATS entry for the toolbar button.

  // Bold before italic so ** isn't read as two italic markers.
  function formatSpans(html) {
    return html
      .replace(/\*\*([^\s*](?:[^\n]*?[^\s*])?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^\s*](?:[^*\n]*?[^\s*])?)\*/g, "<em>$1</em>")
      .replace(/\^([^\s^](?:[^^\n]*?[^\s^])?)\^/g, "<sup>$1</sup>")
      .replace(/~([^\s~](?:[^~\n]*?[^\s~])?)~/g, "<sub>$1</sub>");
  }

  // http(s), mailto, and site-relative links only - never javascript: etc.
  function isSafeUrl(url) {
    return /^(https?:\/\/|mailto:|\/|#|\.{1,2}\/)/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url);
  }

  // Escaped HTML with the formatting above applied.
  function renderInlineMarkup(value) {
    // \x escapes and links become placeholders first, so their contents
    // (e.g. a ~ in a URL) can't trigger other rules.
    const escapes = [];
    const links = [];
    let text = String(value ?? "")
      .replace(/\\([\\*^~[\]])/g, (m, ch) => "\u0000" + (escapes.push(ch) - 1) + "\u0001")
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
        isSafeUrl(url) ? "\u0002" + (links.push({ label, url }) - 1) + "\u0003" : m
      );

    text = formatSpans(escapeHtml(text))
      .replace(/\u0002(\d+)\u0003/g, (m, i) =>
        `<a href="${escapeHtml(links[i].url)}">${formatSpans(escapeHtml(links[i].label))}</a>`
      )
      .replace(/\u0000(\d+)\u0001/g, (m, i) => escapeHtml(escapes[i]));

    return text.replace(/\n/g, "<br>");
  }

  // Plain text that would accidentally read as formatting gets its special
  // characters backslash-escaped; anything else is returned untouched (so a
  // cell like "Assail*" doesn't become "Assail\*").
  function escapeLiteral(text) {
    const plain = escapeHtml(text).replace(/\n/g, "<br>");
    return renderInlineMarkup(text) === plain ? text : text.replace(/[\\*^~[\]]/g, "\\$&");
  }

  // Inverse of renderInlineMarkup: an element's contents as editable text.
  function markupFromElement(el) {
    let out = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        out += escapeLiteral(node.nodeValue);
        return;
      }
      if (node.nodeType !== 1) return;
      const inner = markupFromElement(node);
      switch (node.nodeName) {
        case "BR": out += "\n"; break;
        case "STRONG": case "B": out += "**" + inner + "**"; break;
        case "EM": case "I": out += "*" + inner + "*"; break;
        case "SUP": out += "^" + inner + "^"; break;
        case "SUB": out += "~" + inner + "~"; break;
        case "A": out += "[" + inner + "](" + (node.getAttribute("href") || "") + ")"; break;
        default: out += inner;
      }
    });
    return out;
  }

  // Adds or removes `marker` around the selected text of `value`. Returns the
  // new value and the selection to restore (covering the same text).
  function toggleWrap(value, start, end, marker) {
    const n = marker.length;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    // Already formatted: remove the markers. Bold and italic share "*", so
    // count the stars on each side: italic needs an odd run (*x* or ***x***),
    // bold at least two (**x** or ***x***).
    const starsBefore = (before.match(/\*+$/) || [""])[0].length;
    const starsAfter = (after.match(/^\*+/) || [""])[0].length;
    const wrapped =
      marker === "*" ? starsBefore % 2 === 1 && starsAfter % 2 === 1
      : marker === "**" ? starsBefore >= 2 && starsAfter >= 2
      : before.endsWith(marker) && after.startsWith(marker);
    if (selected && wrapped) {
      return { value: before.slice(0, -n) + selected + after.slice(n), start: start - n, end: end - n };
    }
    if (selected.length > 2 * n && selected.startsWith(marker) && selected.endsWith(marker)) {
      return { value: before + selected.slice(n, -n) + after, start, end: end - 2 * n };
    }

    // Nothing selected: drop in an empty pair with the cursor inside it.
    if (!selected.trim()) {
      return { value: before + selected + marker + marker + after, start: end + n, end: end + n };
    }

    // Wrap the selection, leaving any spaces/line breaks at its edges outside.
    const lead = selected.match(/^\s*/)[0];
    const trail = selected.match(/\s*$/)[0];
    const core = selected.slice(lead.length, selected.length - trail.length);
    const coreStart = start + lead.length + n;
    return {
      value: before + lead + marker + core + marker + trail + after,
      start: coreStart,
      end: coreStart + core.length
    };
  }

  // Turns the selection into [selection](url), asking for the address.
  function insertLink(value, start, end) {
    const url = window.prompt("Link address (e.g. https://www.example.com):", "https://");
    if (!url || !url.trim() || url.trim() === "https://") return null;
    if (!isSafeUrl(url.trim())) {
      window.alert("Only web (http/https), email (mailto:) and site links are allowed.");
      return null;
    }
    const selected = value.slice(start, end).trim() || "link text";
    const label = "[" + selected + "](" + url.trim() + ")";
    return {
      value: value.slice(0, start) + label + value.slice(end),
      start: start + 1,
      end: start + 1 + selected.length
    };
  }

  // Toolbar buttons / shortcuts. `label` is built at render time (React
  // elements can't be shared between renders); `key` matches a keydown.
  const FORMATS = [
    {
      id: "bold",
      label: () => h("strong", null, "B"),
      title: "Bold (Ctrl+B) - shows as **text** while editing",
      key: (e, k) => !e.shiftKey && k === "b",
      apply: (v, s, e) => toggleWrap(v, s, e, "**")
    },
    {
      id: "italic",
      label: () => h("em", null, "I"),
      title: "Italic (Ctrl+I) - shows as *text* while editing",
      key: (e, k) => !e.shiftKey && k === "i",
      apply: (v, s, e) => toggleWrap(v, s, e, "*")
    },
    {
      id: "superscript",
      label: () => ["x", h("sup", { key: "s" }, "2")],
      title: "Superscript (Ctrl+Shift+=), e.g. the 1 in Bees1 - shows as ^1^ while editing",
      key: (e, k) => e.shiftKey && (k === "+" || k === "="),
      apply: (v, s, e) => toggleWrap(v, s, e, "^")
    },
    {
      id: "subscript",
      label: () => ["x", h("sub", { key: "s" }, "2")],
      title: "Subscript (Ctrl+=), e.g. the 2 in H2O - shows as ~2~ while editing",
      key: (e, k) => !e.shiftKey && k === "=",
      apply: (v, s, e) => toggleWrap(v, s, e, "~")
    },
    {
      id: "link",
      label: () => "Link",
      title: "Link (Ctrl+K): select the text to link, then enter the address - shows as [text](address) while editing",
      key: (e, k) => !e.shiftKey && k === "k",
      apply: insertLink
    }
  ];

  // The format a Ctrl/Cmd keydown asks for, if any.
  function formatForKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
    const k = String(e.key || "").toLowerCase();
    return FORMATS.find((f) => f.key(e, k)) || null;
  }

  // Applies `format` to a focused <input>/<textarea>, hands the new value to
  // `setValue`, then puts the selection back once React re-renders.
  function applyFormatTo(el, format, setValue) {
    if (!el || typeof el.selectionStart !== "number") return false;
    const next = format.apply(el.value, el.selectionStart, el.selectionEnd);
    if (!next) return false;
    setValue(next.value);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    }, 0);
    return true;
  }

  // Sizes a cell's textarea to fit its text (wrapped lines and line breaks).
  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // The B / I / x² / x₂ / Link buttons. mousedown is cancelled so clicking a
  // button doesn't take focus (and the text selection) away from the field.
  function renderFormatButtons(onFormat) {
    return FORMATS.map((format) =>
      h(
        "button",
        {
          key: `fmt-${format.id}`,
          type: "button",
          style: { ...btnStyle, minWidth: "32px" },
          title: format.title,
          "aria-label": format.title,
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => onFormat(format)
        },
        format.label()
      )
    );
  }

  function makeCell(text) {
    return { text: text || "", rowSpan: 1, colSpan: 1 };
  }

  function defaultModel() {
    return {
      headerRows: 1,
      rows: [
        [makeCell("Header 1"), makeCell("Header 2")],
        [makeCell(""), makeCell("")],
        [makeCell(""), makeCell("")]
      ]
    };
  }

  // True when the table holds anything worth protecting from "Generate":
  // typed text (other than the generated "Header N" placeholders), merges or
  // sort keys.
  function hasUserContent(rows) {
    return rows.some((row) =>
      row.some(
        (cell) =>
          cell &&
          ((cell.text.trim() && !/^Header \d+$/.test(cell.text.trim())) ||
            cell.rowSpan > 1 ||
            cell.colSpan > 1 ||
            cell.sort)
      )
    );
  }

  // Deep-enough clone: new arrays, and a fresh object per origin cell (null stays null).
  function cloneRows(rows) {
    return rows.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  // ownerMap[r][c] = { r0, c0 } of the origin cell that logically occupies (r,c).
  function buildOwnerMap(rows) {
    const rowCount = rows.length;
    const colCount = rows[0] ? rows[0].length : 0;
    const map = Array.from({ length: rowCount }, () => new Array(colCount).fill(null));

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = rows[r][c];
        if (!cell) continue;
        for (let rr = r; rr < r + cell.rowSpan; rr++) {
          for (let cc = c; cc < c + cell.colSpan; cc++) {
            if (map[rr]) map[rr][cc] = { r0: r, c0: c };
          }
        }
      }
    }

    return map;
  }

  // Reads an existing <table> (from stored markdown) into the grid model,
  // honoring rowspan/colspan -- the same layout algorithm a browser uses.
  function parseTableHtml(html) {
    const trimmed = String(html || "").trim();
    if (!trimmed) return null;

    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    const table = doc.querySelector("table");
    if (!table || !table.rows.length) return null;

    const rowEls = Array.from(table.rows);
    const rowCount = rowEls.length;
    const occupied = Array.from({ length: rowCount }, () => []);
    const grid = Array.from({ length: rowCount }, () => []);
    let headerRows = 0;
    let colCount = 0;
    const colAlign = (table.getAttribute("data-col-align") || "").split(",").filter(Boolean);

    rowEls.forEach((tr, r) => {
      // Header = the leading run of rows inside <thead>. Any other rows --
      // including <tfoot> rows saved by an earlier version, before the
      // Table Footnote field replaced footer rows -- load as body rows.
      if (r === headerRows && tr.parentElement && tr.parentElement.tagName === "THEAD") headerRows++;

      let c = 0;
      Array.from(tr.cells).forEach((cellEl) => {
        while (occupied[r][c]) c++;

        const rowSpan = Math.max(1, parseInt(cellEl.getAttribute("rowspan") || "1", 10));
        const colSpan = Math.max(1, parseInt(cellEl.getAttribute("colspan") || "1", 10));
        const text = markupFromElement(cellEl);

        grid[r][c] = { text, rowSpan, colSpan };
        if (cellEl.hasAttribute("data-sort-col")) grid[r][c].sort = true;

        for (let rr = r; rr < r + rowSpan; rr++) {
          for (let cc = c; cc < c + colSpan; cc++) {
            if (rr === r && cc === c) continue;
            if (!occupied[rr]) occupied[rr] = [];
            occupied[rr][cc] = true;
            if (!grid[rr]) grid[rr] = [];
            grid[rr][cc] = null;
          }
        }

        occupied[r][c] = true;
        colCount = Math.max(colCount, c + colSpan);
        c += colSpan;
      });
    });

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        if (grid[r][c] === undefined) grid[r][c] = makeCell("");
      }
    }

    return { headerRows, colAlign, rows: grid };
  }

  // =========================================================
  // COLUMN ALIGNMENT
  // =========================================================
  //
  // colAlign[c] is "left" (default), "center" or "right". Applied as a class
  // on every cell that sits over exactly that one column (header cells
  // included); header cells spanning several columns are centered by the
  // stylesheet. Stored on the table as data-col-align for reloading.

  const ALIGNMENTS = ["left", "center", "right"];

  function normalizeColAlign(colAlign, colCount) {
    return Array.from({ length: colCount }, (_, c) =>
      ALIGNMENTS.includes(colAlign && colAlign[c]) ? colAlign[c] : "left"
    );
  }

  // Baked-in inline styles because the published page only ever gets this
  // raw HTML -- there's no editor-only CSS following it to the live site.
  function serializeTable(model) {
    const rows = model.rows || [];
    if (!rows.length) return "";

    const headerCount = effectiveHeaderRows(rows, model.headerRows);
    const sortable = canSortBody(rows, headerCount) && hasSortKeys(rows, headerCount);
    const colAlign = normalizeColAlign(model.colAlign, rows[0].length);

    function cellsForRow(rowIndex, isHeaderRow) {
      const row = rows[rowIndex];
      const tag = isHeaderRow ? "th" : "td";
      return row
        .map((cell, c) => {
          if (cell === null) return "";
          const attrs = [];
          if (cell.colSpan === 1 && colAlign[c] !== "left") attrs.push(`class="ht-${colAlign[c]}"`);
          if (cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
          if (cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);
          if (sortable && isHeaderRow && isSortKey(cell)) attrs.push(`data-sort-col="${c}"`);
          const attrStr = attrs.length ? " " + attrs.join(" ") : "";
          return `<${tag}${attrStr}>${renderInlineMarkup(cell.text)}</${tag}>`;
        })
        .join("");
    }

    const classes = [TABLE_CLASS].concat(sortable ? [SORTABLE_CLASS] : []).join(" ");
    const alignAttr = colAlign.some((a) => a !== "left") ? ` data-col-align="${colAlign.join(",")}"` : "";
    let out = `<table class="${classes}"${alignAttr}>`;

    if (headerCount) {
      out += "<thead>";
      for (let r = 0; r < headerCount; r++) out += "<tr>" + cellsForRow(r, true) + "</tr>";
      out += "</thead>";
    }

    if (headerCount < rows.length) {
      out += "<tbody>";
      for (let r = headerCount; r < rows.length; r++) out += "<tr>" + cellsForRow(r, false) + "</tr>";
      out += "</tbody>";
    }

    out += "</table>";
    return out;
  }

  // A header cell can be a sort key only when it sits over exactly one column.
  function isSortKey(cell) {
    return Boolean(cell && cell.sort && cell.colSpan === 1);
  }

  function hasSortKeys(rows, headerCount) {
    for (let r = 0; r < headerCount; r++) {
      if (rows[r].some(isSortKey)) return true;
    }
    return false;
  }

  // Rows can only be reordered when no body cell is merged across rows.
  function canSortBody(rows, headerCount) {
    for (let r = headerCount; r < rows.length; r++) {
      if (rows[r].some((cell) => cell && cell.rowSpan > 1)) return false;
    }
    return true;
  }

  // A rowspan can't cross from <thead> into <tbody> (browsers clip it at the
  // section boundary, shifting every row below). The editor refuses such
  // merges (see crossesHeaderBoundary), but tables saved before that may
  // have one, so the header grows to take in any cell merged down past it.
  function effectiveHeaderRows(rows, requested) {
    let count = Math.max(0, Math.min(rows.length, Number(requested) || 0));
    for (let r = 0; r < count; r++) {
      for (const cell of rows[r]) {
        if (cell) count = Math.min(rows.length, Math.max(count, r + cell.rowSpan));
      }
    }
    return count;
  }

  // True when a selection box has rows on both sides of the header/body line.
  function crossesHeaderBoundary(box, headerCount) {
    return headerCount > 0 && box.minR < headerCount && box.maxR >= headerCount;
  }

  function snapToOrigin(rows, pt) {
    const rowCount = rows.length;
    const colCount = rows[0].length;
    const r = Math.max(0, Math.min(rowCount - 1, pt.r));
    const c = Math.max(0, Math.min(colCount - 1, pt.c));
    const owner = buildOwnerMap(rows)[r][c];
    return owner ? { r: owner.r0, c: owner.c0 } : { r: 0, c: 0 };
  }

  // Grows a selection box until it contains no partial merges (Excel-style).
  function expandToValidRectangle(rows, ownerMap, box) {
    let { minR, maxR, minC, maxC } = box;
    let changed = true;

    while (changed) {
      changed = false;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const owner = ownerMap[r][c];
          if (!owner) continue;
          const cell = rows[owner.r0][owner.c0];
          if (owner.r0 < minR) { minR = owner.r0; changed = true; }
          if (owner.c0 < minC) { minC = owner.c0; changed = true; }
          if (owner.r0 + cell.rowSpan - 1 > maxR) { maxR = owner.r0 + cell.rowSpan - 1; changed = true; }
          if (owner.c0 + cell.colSpan - 1 > maxC) { maxC = owner.c0 + cell.colSpan - 1; changed = true; }
        }
      }
    }

    return { minR, maxR, minC, maxC };
  }

  function mergeCells(rows, box) {
    const cloned = cloneRows(rows);
    const ownerMap = buildOwnerMap(cloned);
    const { minR, maxR, minC, maxC } = expandToValidRectangle(cloned, ownerMap, box);

    const seen = new Set();
    const pieces = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const owner = ownerMap[r][c];
        if (!owner) continue;
        const key = `${owner.r0},${owner.c0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const text = cloned[owner.r0][owner.c0].text.trim();
        if (text) pieces.push(text);
      }
    }

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        cloned[r][c] = null;
      }
    }

    cloned[minR][minC] = {
      text: pieces.join(" "),
      rowSpan: maxR - minR + 1,
      colSpan: maxC - minC + 1
    };

    return cloned;
  }

  function splitCell(rows, r0, c0) {
    const cloned = cloneRows(rows);
    const cell = cloned[r0][c0];
    if (!cell) return cloned;

    for (let r = r0; r < r0 + cell.rowSpan; r++) {
      for (let c = c0; c < c0 + cell.colSpan; c++) {
        cloned[r][c] = r === r0 && c === c0 ? makeCell(cell.text) : makeCell("");
      }
    }

    return cloned;
  }

  function insertRowAt(rows, insertAt) {
    const cloned = cloneRows(rows);
    const ownerMap = buildOwnerMap(cloned);
    const colCount = cloned[0].length;
    const newRow = new Array(colCount);
    const originsToExtend = new Set();

    for (let c = 0; c < colCount; c++) {
      let extends_ = false;
      if (insertAt > 0) {
        const owner = ownerMap[insertAt - 1][c];
        if (owner) {
          const cell = cloned[owner.r0][owner.c0];
          extends_ = owner.r0 + cell.rowSpan - 1 >= insertAt;
          if (extends_) originsToExtend.add(`${owner.r0},${owner.c0}`);
        }
      }
      newRow[c] = extends_ ? null : makeCell("");
    }

    originsToExtend.forEach((key) => {
      const [r0, c0] = key.split(",").map(Number);
      cloned[r0][c0].rowSpan += 1;
    });

    cloned.splice(insertAt, 0, newRow);
    return cloned;
  }

  function deleteRowAt(rows, delIndex) {
    if (rows.length <= 1) return rows;

    const cloned = cloneRows(rows);
    const ownerMap = buildOwnerMap(cloned);
    const colCount = cloned[0].length;
    const affected = new Set();

    for (let c = 0; c < colCount; c++) {
      const owner = ownerMap[delIndex][c];
      if (owner) affected.add(`${owner.r0},${owner.c0}`);
    }

    affected.forEach((key) => {
      const [r0, c0] = key.split(",").map(Number);
      const cell = cloned[r0][c0];

      if (r0 === delIndex) {
        if (cell.rowSpan > 1) {
          cloned[delIndex + 1][c0] = { text: cell.text, rowSpan: cell.rowSpan - 1, colSpan: cell.colSpan };
        }
      } else {
        cell.rowSpan -= 1;
      }
    });

    cloned.splice(delIndex, 1);
    return cloned;
  }

  function insertColumnAt(rows, insertAt) {
    const cloned = cloneRows(rows);
    const ownerMap = buildOwnerMap(cloned);
    const rowCount = cloned.length;
    const originsToExtend = new Set();

    for (let r = 0; r < rowCount; r++) {
      let extends_ = false;
      if (insertAt > 0) {
        const owner = ownerMap[r][insertAt - 1];
        if (owner) {
          const cell = cloned[owner.r0][owner.c0];
          extends_ = owner.c0 + cell.colSpan - 1 >= insertAt;
          if (extends_) originsToExtend.add(`${owner.r0},${owner.c0}`);
        }
      }
      cloned[r].splice(insertAt, 0, extends_ ? null : makeCell(""));
    }

    originsToExtend.forEach((key) => {
      const [r0, c0] = key.split(",").map(Number);
      cloned[r0][c0].colSpan += 1;
    });

    return cloned;
  }

  function deleteColumnAt(rows, delIndex) {
    if (rows[0].length <= 1) return rows;

    const cloned = cloneRows(rows);
    const ownerMap = buildOwnerMap(cloned);
    const rowCount = cloned.length;
    const affected = new Set();

    for (let r = 0; r < rowCount; r++) {
      const owner = ownerMap[r][delIndex];
      if (owner) affected.add(`${owner.r0},${owner.c0}`);
    }

    affected.forEach((key) => {
      const [r0, c0] = key.split(",").map(Number);
      const cell = cloned[r0][c0];

      if (c0 === delIndex) {
        if (cell.colSpan > 1) {
          cloned[r0][delIndex + 1] = { text: cell.text, rowSpan: cell.rowSpan, colSpan: cell.colSpan - 1 };
        }
      } else {
        cell.colSpan -= 1;
      }
    });

    cloned.forEach((row) => row.splice(delIndex, 1));
    return cloned;
  }

  // Decap first tries this against the whole rest of the document, so the
  // block body must not be able to run past its own closing fence: NOT_FENCE
  // matches any character except the start of a "\n```" line. (With a plain
  // [\s\S]*? and a trailing "$", a page that *ends* in another fenced block
  // let the first table swallow everything up to that last fence - including
  // any pesticide-table shortcodes in between, which then never rendered.)
  const NOT_FENCE = "(?:(?!\\n```)[\\s\\S])";
  const PATTERN = new RegExp(
    "^```\\{=html\\}[ \\t]*\\n" +
      "<!--\\s*" + MARKER + "\\s*-->[ \\t]*\\n" +
      "(" + NOT_FENCE + "*?<table" + NOT_FENCE + "*?<\\/table>" + NOT_FENCE + "*?)\\n" +
      "```[ \\t]*(?=\\n|$)"
  );

  // Inline-styled for the same reason as serializeTable; matches the
  // treatment/pesticide summary table titles.
  const TITLE_CLASS = "html-table-title";
  const TITLE_STYLE = "margin:0 0 0.75rem;font-size:1.35rem;line-height:1.25;font-weight:600;";
  const TITLE_PATTERN = new RegExp('^\\s*<div class="' + TITLE_CLASS + '"[^>]*>([\\s\\S]*?)<\\/div>\\s*');

  function renderTitleHtml(title) {
    const t = String(title || "").trim();
    return t ? `<div class="${TITLE_CLASS}" style="${TITLE_STYLE}">${escapeHtml(t)}</div>` : "";
  }

  // Splits a stored block body into its optional title and the bare <table>.
  function splitTitleFromHtml(body) {
    const text = String(body || "");
    const m = text.match(TITLE_PATTERN);
    if (!m) return { title: "", html: text.trim() };

    const title = new DOMParser().parseFromString(m[1], "text/html").body.textContent || "";
    return { title: title.trim(), html: text.slice(m[0].length).trim() };
  }

  // =========================================================
  // FOOTNOTE (full-width row at the bottom of the table)
  // =========================================================
  //
  // Kept out of the grid and stored as a marked last row of <tfoot>, so it
  // sits inside the table border and never moves when the body is sorted.
  // Each line of the field is its own note, with the same inline formatting
  // as cells; a leading marker like "[1]" or "*" is bolded automatically.

  const FOOTNOTE_ATTR = "data-table-footnote";
  const FOOTNOTE_ROW_PATTERN = new RegExp("<tr " + FOOTNOTE_ATTR + ">[\\s\\S]*?<\\/tr>");
  // "[1]" but not a link "[text](url)"; "*"/"†"... only when followed by a
  // space, so a line starting with *italic* isn't mistaken for a marker.
  const FOOTNOTE_MARKER = /^(\[[^\]]+\](?!\()|[*†‡§]+(?=\s))\s*/;

  function renderFootnoteNote(line) {
    const m = line.match(FOOTNOTE_MARKER);
    const body = m ? `<strong>${escapeHtml(m[1])}</strong> ${renderInlineMarkup(line.slice(m[0].length))}` : renderInlineMarkup(line);
    return `<p>${body}</p>`;
  }

  // On reload the auto-bolded marker reads back as **[1]**; show it as typed.
  function unboldFootnoteMarker(line) {
    return line.replace(/^\*\*(\[[^\]]+\]|[*†‡§]+)\*\*(?=\s)/, (m, marker) =>
      FOOTNOTE_MARKER.test(marker + " ") ? marker : m
    );
  }

  // Adds the footnote row to serialized table HTML (single line: Decap needs
  // the whole block free of blank lines -- see SORT_SCRIPT).
  function addFootnoteToTable(tableHtml, footnote) {
    const lines = String(footnote || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const model = lines.length ? parseTableHtml(tableHtml) : null;
    if (!model) return tableHtml;

    const colCount = model.rows[0].length;
    const colspan = colCount > 1 ? ` colspan="${colCount}"` : "";
    const row = `<tr ${FOOTNOTE_ATTR}><td${colspan} class="html-table__footnote">${lines.map(renderFootnoteNote).join("")}</td></tr>`;

    return tableHtml.includes("</tfoot>")
      ? tableHtml.replace("</tfoot>", row + "</tfoot>")
      : tableHtml.replace("</table>", "<tfoot>" + row + "</tfoot></table>");
  }

  // Inverse of addFootnoteToTable: returns the footnote text and the table
  // HTML without it (what the grid widget edits).
  function splitFootnoteFromTable(tableHtml) {
    const html = String(tableHtml || "");
    const m = html.match(FOOTNOTE_ROW_PATTERN);
    if (!m) return { footnote: "", html };

    const doc = new DOMParser().parseFromString("<table>" + m[0] + "</table>", "text/html");
    const footnote = Array.from(doc.querySelectorAll("p"))
      .map((p) => unboldFootnoteMarker(markupFromElement(p).replace(/\s+/g, " ").trim()))
      .join("\n");

    return { footnote, html: html.replace(m[0], "").replace("<tfoot></tfoot>", "") };
  }

  // Splits a stored block body into title, footnote and the bare <table> the
  // grid edits (dropping the stylesheet, wrapper and sort script, which
  // toBlockText regenerates).
  function splitBlockBody(body) {
    const { title, html } = splitTitleFromHtml(body);
    const { footnote, html: tableHtml } = splitFootnoteFromTable(extractTable(html));
    return { title, footnote, html: tableHtml };
  }

  function extractTable(html) {
    const m = stripSortScript(html).match(/<table[\s\S]*<\/table>/);
    return m ? m[0] : "";
  }

  // =========================================================
  // STYLESHEET
  // =========================================================
  //
  // Matches the database-driven tables (assets/css/pesticide-summary-public.css
  // and public-treatment-builder.css): no vertical rules, bold bottom-aligned
  // header over a 2px dark line, light row dividers, white/#f1f1f1 striping,
  // 2px dark line closing the body. Shipped inside each block (collapsed to
  // one line -- see SORT_SCRIPT) because publications don't share a site
  // stylesheet, which also means the admin preview gets it for free. A style
  // change here reaches a published table the next time it is saved.

  const TABLE_CLASS = "html-table";

  const TABLE_CSS = `
    .html-table-title { margin: 0 0 0.75rem; font-size: 1.35rem; line-height: 1.25; font-weight: 600; }
    .html-table-wrap { width: 100%; overflow-x: auto; margin: 0 0 1rem; }
    .html-table { width: 100%; margin: 0; border: 0; border-collapse: collapse; border-spacing: 0; }
    .html-table th, .html-table td { padding: 5px 6px; border: 0; border-bottom: 1px solid #d7d7d7; text-align: left; vertical-align: top; overflow-wrap: break-word; }
    .html-table th { font-weight: 700; vertical-align: bottom; }
    .html-table thead th[colspan] { text-align: center; }
    .html-table thead { border-bottom: 2px solid #6f6f6f; }
    .html-table tbody { border-bottom: 2px solid #6f6f6f; }
    .html-table tbody tr:nth-child(odd) td { background: #ffffff; }
    .html-table tbody tr:nth-child(even) td { background: #f1f1f1; }
    .html-table tfoot td { background: #ffffff; }
    .html-table .ht-left { text-align: left; }
    .html-table .ht-center { text-align: center; }
    .html-table .ht-right { text-align: right; }
    .html-table th button:hover { text-decoration: underline; }
    .html-table .html-table__footnote { border-bottom: 0; font-size: 0.875em; line-height: 1.35; color: #333; }
    .html-table .html-table__footnote p { margin: 0.2em 0; }
  `;

  const TABLE_STYLE = "<style data-html-table-style>" + TABLE_CSS.replace(/\s*\n\s*/g, " ").trim() + "</style>";

  // =========================================================
  // SORTING (runs on the published page and in the admin preview)
  // =========================================================
  //
  // Publications load different (or no) site scripts, so a sortable table
  // carries its own copy of this function in a <script> right after it in
  // the raw block -- serialized with toString(), so it must stay
  // self-contained (no references to anything else in this file).
  // Clicking a sort-key header cycles ascending -> descending -> original
  // order; blank/dash cells always sort last; values starting with a number
  // ("68-76", "79+") sort numerically.

  function enhanceSortableTables(doc) {
    doc.querySelectorAll("table.html-table-sortable:not([data-sort-ready])").forEach(function (table) {
      table.setAttribute("data-sort-ready", "");
      var body = table.tBodies[0];
      if (!body) return;

      var originalRows = Array.prototype.slice.call(body.rows);
      var headers = Array.prototype.slice.call(table.querySelectorAll("th[data-sort-col]"));
      var current = null;

      function cellAt(tr, col) {
        var c = 0;
        for (var i = 0; i < tr.cells.length; i++) {
          c += tr.cells[i].colSpan;
          if (c > col) return tr.cells[i];
        }
        return null;
      }

      function sortValue(tr, col) {
        var cell = cellAt(tr, col);
        var copy = cell ? cell.cloneNode(true) : null;
        var sups = copy ? copy.querySelectorAll("sup") : [];
        for (var s = 0; s < sups.length; s++) sups[s].parentNode.removeChild(sups[s]);
        var text = copy ? copy.textContent.trim() : "";
        if (!text || /^[-–—\s]+$/.test(text)) return null;
        var m = text.match(/^[<>~≤≥]?\s*(-?\d+(?:\.\d+)?)/);
        return m ? parseFloat(m[1]) : text.toLowerCase();
      }

      function compare(a, b) {
        if (typeof a !== typeof b) return typeof a === "number" ? -1 : 1;
        return typeof a === "number" ? a - b : a.localeCompare(b, undefined, { numeric: true });
      }

      function apply() {
        var rows = originalRows.slice();
        if (current) {
          var dir = current.direction === "desc" ? -1 : 1;
          rows.sort(function (x, y) {
            var a = sortValue(x, current.col);
            var b = sortValue(y, current.col);
            if (a === null || b === null) return (a === null) - (b === null);
            return dir * compare(a, b);
          });
        }
        rows.forEach(function (tr) { body.appendChild(tr); });

        headers.forEach(function (th) {
          var active = current && current.th === th;
          var icon = th.querySelector("[data-sort-icon]");
          th.setAttribute("aria-sort", active ? (current.direction === "desc" ? "descending" : "ascending") : "none");
          icon.textContent = active ? (current.direction === "desc" ? " ▼" : " ▲") : " ↕";
          icon.style.color = active ? "inherit" : "#999";
        });
      }

      headers.forEach(function (th) {
        var button = doc.createElement("button");
        button.type = "button";
        button.style.cssText = "border:0;background:none;padding:0;font:inherit;color:inherit;text-align:inherit;cursor:pointer;";
        while (th.firstChild) button.appendChild(th.firstChild);
        var icon = doc.createElement("span");
        icon.setAttribute("data-sort-icon", "");
        icon.setAttribute("aria-hidden", "true");
        icon.style.fontSize = "0.8em";
        button.appendChild(icon);
        th.appendChild(button);

        button.addEventListener("click", function () {
          var col = parseInt(th.getAttribute("data-sort-col"), 10);
          if (!current || current.th !== th) current = { th: th, col: col, direction: "asc" };
          else if (current.direction === "asc") current.direction = "desc";
          else current = null;
          apply();
        });
      });

      apply();
    });
  }

  const SORTABLE_CLASS = "html-table-sortable";
  // Blank lines are stripped: Decap only matches an editor component against
  // the text up to the first blank line, so one inside the block makes it
  // fall back to rendering as a plain code block.
  const SORT_SCRIPT =
    "<script data-html-table-sort>(" +
    enhanceSortableTables
      .toString()
      .split("\n")
      .filter((line) => line.trim())
      .join("\n") +
    ")(document);</script>";
  const SORT_SCRIPT_PATTERN = /\s*<script data-html-table-sort>[\s\S]*?<\/script>\s*/g;

  function stripSortScript(html) {
    return String(html || "").replace(SORT_SCRIPT_PATTERN, "").trim();
  }

  // Title, stylesheet and wrapped table (with footnote), as shown on the page.
  function renderTableBody(html, title, footnote) {
    const tableHtml = addFootnoteToTable(splitFootnoteFromTable(extractTable(html)).html, footnote);
    if (!tableHtml) return "";
    const titleHtml = renderTitleHtml(title);
    return (titleHtml ? titleHtml + "\n" : "") + TABLE_STYLE + "\n" + `<div class="html-table-wrap">${tableHtml}</div>`;
  }

  function toBlockText(html, title, footnote) {
    const body = renderTableBody(html, title, footnote);
    const script = body.includes("data-sort-col=") ? "\n" + SORT_SCRIPT : "";
    return "```{=html}\n<!-- " + MARKER + " -->\n" + body + script + "\n```";
  }

  // Decap's preview renders toPreview HTML without running its scripts, so
  // the preview pane's sortable tables are wired up from here instead.
  function startPreviewSortLoop() {
    setInterval(() => {
      const iframe =
        document.querySelector("iframe[class*='PreviewPaneFrame']") ||
        document.querySelector("iframe[title*='Preview']") ||
        document.querySelector("iframe");
      const previewDoc = iframe && iframe.contentDocument;
      if (previewDoc) enhanceSortableTables(previewDoc);
    }, 1000);
  }

  // =========================================================
  // CONTROL (editor-side widget)
  // =========================================================

  const btnStyle = {
    padding: "4px 10px",
    fontSize: "13px",
    border: "1px solid #b8b8b8",
    borderRadius: "4px",
    background: "#fff",
    cursor: "pointer"
  };

  const btnStyleDisabled = { ...btnStyle, opacity: 0.45, cursor: "default" };

  const HtmlTableEditorControl = createClass({
    getInitialState() {
      const existing = parseTableHtml(this.props.value);
      const model = existing || defaultModel();
      return {
        headerRows: effectiveHeaderRows(model.rows, model.headerRows),
        colAlign: normalizeColAlign(model.colAlign, model.rows[0].length),
        rows: model.rows,
        selStart: { r: 0, c: 0 },
        selEnd: { r: 0, c: 0 },
        isSelecting: false,
        genRows: "3",
        genCols: "2",
        // Open for a brand-new table; collapsed when editing one that already exists.
        showGenerator: !existing,
        history: [],
        future: []
      };
    },

    componentDidMount() {
      if (!this.props.value) {
        this.emitChange(this.state);
      }
      window.addEventListener("mouseup", this.handleGlobalMouseUp);
    },

    componentWillUnmount() {
      window.removeEventListener("mouseup", this.handleGlobalMouseUp);
    },

    // Undo/redo, merges and column changes alter cell text or widths without
    // typing, so re-fit every cell's textarea after each update.
    componentDidUpdate() {
      if (this.rootEl) this.rootEl.querySelectorAll("td > textarea, th > textarea").forEach(autoGrow);
    },

    handleGlobalMouseUp() {
      if (this.state.isSelecting) this.setState({ isSelecting: false });
    },

    // `model` is anything with rows/headerRows/colAlign (state or a snapshot).
    emitChange(model) {
      this.props.onChange(serializeTable(model));
    },

    // The undoable part of the state.
    takeSnapshot() {
      return {
        rows: cloneRows(this.state.rows),
        headerRows: this.state.headerRows,
        colAlign: this.state.colAlign.slice()
      };
    },

    // Number of rows at the top that form the header.
    headerCount() {
      return effectiveHeaderRows(this.state.rows, this.state.headerRows);
    },

    // Snapshots the current table onto the undo stack, applies
    // `partialState` (which must include any of rows/headerRows/colAlign
    // that are changing), clears the redo stack (a fresh edit invalidates
    // it), and emits the resulting markdown.
    commit(partialState) {
      const history = [...this.state.history, this.takeSnapshot()].slice(-MAX_HISTORY);

      this.setState({ ...partialState, history, future: [] });
      this.emitChange({ ...this.state, ...partialState });
    },

    // Called when a cell gains focus, so Ctrl+Z undoes a whole typing
    // session in that cell rather than one keystroke at a time.
    beginEditSession() {
      const snapshot = this.takeSnapshot();
      this.setState((prev) => ({
        history: [...prev.history, snapshot].slice(-MAX_HISTORY),
        future: []
      }));
    },

    restoreSnapshot(snapshot, history, future) {
      this.setState({
        ...snapshot,
        history,
        future,
        selStart: snapToOrigin(snapshot.rows, this.state.selStart),
        selEnd: snapToOrigin(snapshot.rows, this.state.selEnd)
      });
      this.emitChange(snapshot);
    },

    undo() {
      if (!this.state.history.length) return;
      const history = this.state.history.slice();
      const previous = history.pop();
      const future = [this.takeSnapshot(), ...this.state.future].slice(0, MAX_HISTORY);
      this.restoreSnapshot(previous, history, future);
    },

    redo() {
      if (!this.state.future.length) return;
      const future = this.state.future.slice();
      const next = future.shift();
      const history = [...this.state.history, this.takeSnapshot()].slice(-MAX_HISTORY);
      this.restoreSnapshot(next, history, future);
    },

    // Applies a FORMATS entry (bold, italic, link...) to the selected text of
    // the cell being edited. Does nothing unless a cell has focus.
    formatActiveCell(format) {
      const active = this.activeCell;
      if (!active || document.activeElement !== active.el) return;
      applyFormatTo(active.el, format, (value) => this.updateCellText(active.r, active.c, value));
    },

    handleKeyDown(e) {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const format = formatForKey(e);
      if (format) {
        e.preventDefault();
        this.formatActiveCell(format);
      } else if (key === "z" && e.shiftKey) {
        e.preventDefault();
        this.redo();
      } else if (key === "z") {
        e.preventDefault();
        this.undo();
      } else if (key === "y") {
        e.preventDefault();
        this.redo();
      }
    },

    applyRows(rows, extraState) {
      const clampedSel = {
        selStart: snapToOrigin(rows, this.state.selStart),
        selEnd: snapToOrigin(rows, this.state.selEnd)
      };
      this.commit({ rows, ...clampedSel, ...(extraState || {}) });
    },

    handleCellMouseDown(r, c) {
      this.setState({ selStart: { r, c }, selEnd: { r, c }, isSelecting: true });
    },

    handleCellMouseEnter(r, c) {
      if (this.state.isSelecting) this.setState({ selEnd: { r, c } });
    },

    updateCellText(r, c, text) {
      const rows = cloneRows(this.state.rows);
      rows[r][c].text = text;
      this.setState({ rows, future: [] });
      this.emitChange({ ...this.state, rows });
    },

    getSelectionBox() {
      const { selStart, selEnd, rows } = this.state;
      const raw = {
        minR: Math.min(selStart.r, selEnd.r),
        maxR: Math.max(selStart.r, selEnd.r),
        minC: Math.min(selStart.c, selEnd.c),
        maxC: Math.max(selStart.c, selEnd.c)
      };
      return expandToValidRectangle(rows, buildOwnerMap(rows), raw);
    },

    isCellSelected(r, c) {
      const box = this.getSelectionBox();
      return r >= box.minR && r <= box.maxR && c >= box.minC && c <= box.maxC;
    },

    // Header and body cells can't be merged together (see crossesHeaderBoundary).
    mergeCrossesHeader() {
      return crossesHeaderBoundary(this.getSelectionBox(), this.headerCount());
    },

    canMerge() {
      if (this.mergeCrossesHeader()) return false;
      const box = this.getSelectionBox();
      const ownerMap = buildOwnerMap(this.state.rows);
      const seen = new Set();
      for (let r = box.minR; r <= box.maxR; r++) {
        for (let c = box.minC; c <= box.maxC; c++) {
          const owner = ownerMap[r][c];
          if (owner) seen.add(`${owner.r0},${owner.c0}`);
        }
      }
      return seen.size > 1;
    },

    getSplitTarget() {
      const { selStart, selEnd, rows } = this.state;
      if (selStart.r !== selEnd.r || selStart.c !== selEnd.c) return null;
      const cell = rows[selStart.r][selStart.c];
      if (cell && (cell.rowSpan > 1 || cell.colSpan > 1)) return { r0: selStart.r, c0: selStart.c };
      return null;
    },

    mergeSelected() {
      if (!this.canMerge()) return;
      const box = this.getSelectionBox();
      const rows = mergeCells(this.state.rows, box);
      this.commit({ rows, selStart: { r: box.minR, c: box.minC }, selEnd: { r: box.minR, c: box.minC } });
    },

    splitSelected() {
      const target = this.getSplitTarget();
      if (!target) return;
      const rows = splitCell(this.state.rows, target.r0, target.c0);
      this.commit({ rows, selStart: { r: target.r0, c: target.c0 }, selEnd: { r: target.r0, c: target.c0 } });
    },

    // Rows added/removed inside the header keep the header/body line in place.
    addRow(position) {
      const headerRows = this.headerCount();
      const insertAt = position === "above" ? this.state.selStart.r : this.state.selStart.r + 1;
      this.applyRows(insertRowAt(this.state.rows, insertAt), {
        headerRows: insertAt < headerRows ? headerRows + 1 : headerRows
      });
    },

    deleteRow() {
      const { rows } = this.state;
      if (rows.length <= 1) return;
      const headerRows = this.headerCount();
      const delIndex = this.state.selStart.r;
      this.applyRows(deleteRowAt(rows, delIndex), {
        headerRows: delIndex < headerRows ? headerRows - 1 : headerRows
      });
    },

    // Adds an empty header row: below the selected row when the selection
    // is in the header, otherwise at the bottom of the header.
    addHeaderRow() {
      const headerRows = this.headerCount();
      const selR = this.state.selStart.r;
      const insertAt = selR < headerRows ? selR + 1 : headerRows;
      const rows = insertRowAt(this.state.rows, insertAt);
      this.commit({
        rows,
        headerRows: headerRows + 1,
        selStart: snapToOrigin(rows, { r: insertAt, c: 0 }),
        selEnd: snapToOrigin(rows, { r: insertAt, c: 0 })
      });
    },

    // Deletes the selected header row, or the bottom header row when the
    // selection is in the body.
    deleteHeaderRow() {
      const headerRows = this.headerCount();
      if (!headerRows || this.state.rows.length <= 1) return;
      const selR = this.state.selStart.r;
      const delIndex = selR < headerRows ? selR : headerRows - 1;
      this.applyRows(deleteRowAt(this.state.rows, delIndex), { headerRows: headerRows - 1 });
    },

    addColumn(position) {
      const insertAt = position === "left" ? this.state.selStart.c : this.state.selStart.c + 1;
      const colAlign = this.state.colAlign.slice();
      colAlign.splice(insertAt, 0, "left");
      this.applyRows(insertColumnAt(this.state.rows, insertAt), { colAlign });
    },

    deleteColumn() {
      if (this.state.rows[0].length <= 1) return;
      const colAlign = this.state.colAlign.slice();
      colAlign.splice(this.state.selStart.c, 1);
      this.applyRows(deleteColumnAt(this.state.rows, this.state.selStart.c), { colAlign });
    },

    // Applies to every column the current selection touches.
    setColumnAlign(align) {
      const box = this.getSelectionBox();
      const colAlign = this.state.colAlign.slice();
      for (let c = box.minC; c <= box.maxC; c++) colAlign[c] = align;
      this.commit({ colAlign });
    },

    // The single selected cell, if it's a header cell over exactly one column.
    getSortKeyTarget() {
      const { selStart, selEnd, rows } = this.state;
      if (selStart.r !== selEnd.r || selStart.c !== selEnd.c) return null;
      if (selStart.r >= this.headerCount()) return null;
      const cell = rows[selStart.r][selStart.c];
      return cell && cell.colSpan === 1 ? { r: selStart.r, c: selStart.c, cell } : null;
    },

    // One sort key per column: turning it on clears any other header cell's
    // flag in the same column.
    toggleSortKey() {
      const target = this.getSortKeyTarget();
      if (!target) return;
      const turnOn = !target.cell.sort;
      const rows = cloneRows(this.state.rows);

      rows.forEach((row) => {
        const cell = row[target.c];
        if (cell && cell.colSpan === 1) delete cell.sort;
      });
      if (turnOn) rows[target.r][target.c].sort = true;

      this.commit({ rows });
    },

    generateNewTable() {
      const rowCount = Math.max(1, Math.min(50, parseInt(this.state.genRows, 10) || 1));
      const colCount = Math.max(1, Math.min(20, parseInt(this.state.genCols, 10) || 1));

      if (
        hasUserContent(this.state.rows) &&
        !window.confirm(
          "Replace the current table?\n\nEverything in it (text, merges, sort keys, alignment) will be replaced " +
            `by an empty ${rowCount} x ${colCount} table. You can still get it back with Undo before leaving this page.`
        )
      ) {
        return;
      }

      const rows = [];
      for (let r = 0; r < rowCount; r++) {
        const row = [];
        for (let c = 0; c < colCount; c++) row.push(makeCell(r === 0 ? `Header ${c + 1}` : ""));
        rows.push(row);
      }

      this.commit({
        rows,
        headerRows: 1,
        colAlign: normalizeColAlign([], colCount),
        selStart: { r: 0, c: 0 },
        selEnd: { r: 0, c: 0 },
        showGenerator: false
      });
    },

    // Shown open only for a brand-new table. Once a table exists it collapses
    // to a "Start over" link, so it can't wipe a filled-in table by accident.
    renderGenerator() {
      if (!this.state.showGenerator) {
        return h(
          "div",
          { key: "generator", style: { marginBottom: "10px", fontSize: "13px" } },
          h(
            "button",
            {
              type: "button",
              onClick: () => this.setState({ showGenerator: true }),
              style: { border: 0, background: "none", padding: 0, color: "#2a6fdb", textDecoration: "underline", cursor: "pointer", font: "inherit" },
              title: "Replace this table with a new, empty one"
            },
            "Start over with a new table…"
          )
        );
      }

      const canCancel = hasUserContent(this.state.rows);

      return h(
        "div",
        { key: "generator", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginBottom: "10px", fontSize: "13px" } },
        [
          canCancel ? "Replace with a new table:" : "Generate new:",
          h("input", {
            key: "gen-rows",
            type: "number",
            min: 1,
            max: 50,
            value: this.state.genRows,
            onChange: (e) => this.setState({ genRows: e.target.value }),
            style: { width: "52px", padding: "3px" }
          }),
          "rows x",
          h("input", {
            key: "gen-cols",
            type: "number",
            min: 1,
            max: 20,
            value: this.state.genCols,
            onChange: (e) => this.setState({ genCols: e.target.value }),
            style: { width: "52px", padding: "3px" }
          }),
          "cols",
          h("button", { key: "gen-btn", type: "button", style: btnStyle, onClick: this.generateNewTable }, "Generate"),
          canCancel
            ? h("button", { key: "gen-cancel", type: "button", style: btnStyle, onClick: () => this.setState({ showGenerator: false }) }, "Cancel")
            : null
        ]
      );
    },

    renderToolbar() {
      const mergeEnabled = this.canMerge();
      const splitTarget = this.getSplitTarget();
      const sortTarget = this.getSortKeyTarget();
      const headerCount = this.headerCount();
      const groupStyle = { display: "flex", alignItems: "center", gap: "4px", padding: "2px 6px", border: "1px solid #ddd", borderRadius: "4px", background: "#fafafa" };

      return h(
        "div",
        {
          key: "toolbar",
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            alignItems: "center",
            marginBottom: "10px",
            paddingBottom: "10px",
            borderBottom: "1px solid #e0e0e0"
          }
        },
        [
          h(
            "button",
            {
              key: "undo-btn",
              type: "button",
              style: this.state.history.length ? btnStyle : btnStyleDisabled,
              disabled: !this.state.history.length,
              onClick: this.undo,
              title: "Undo (Ctrl+Z)"
            },
            "Undo"
          ),
          h(
            "button",
            {
              key: "redo-btn",
              type: "button",
              style: this.state.future.length ? btnStyle : btnStyleDisabled,
              disabled: !this.state.future.length,
              onClick: this.redo,
              title: "Redo (Ctrl+Shift+Z / Ctrl+Y)"
            },
            "Redo"
          ),
          h("span", { key: "sep0", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          h("button", { key: "row-above", type: "button", style: btnStyle, onClick: () => this.addRow("above") }, "+ Row Above"),
          h("button", { key: "row-below", type: "button", style: btnStyle, onClick: () => this.addRow("below") }, "+ Row Below"),
          h("button", { key: "row-del", type: "button", style: btnStyle, onClick: this.deleteRow }, "- Row"),
          h("span", { key: "sep1", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          h("button", { key: "col-left", type: "button", style: btnStyle, onClick: () => this.addColumn("left") }, "+ Col Left"),
          h("button", { key: "col-right", type: "button", style: btnStyle, onClick: () => this.addColumn("right") }, "+ Col Right"),
          h("button", { key: "col-del", type: "button", style: btnStyle, onClick: this.deleteColumn }, "- Col"),
          h("span", { key: "sep2", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          h(
            "button",
            {
              key: "merge-btn",
              type: "button",
              style: mergeEnabled ? btnStyle : btnStyleDisabled,
              disabled: !mergeEnabled,
              onClick: this.mergeSelected,
              title: this.mergeCrossesHeader()
                ? "Header cells and body cells can't be merged together. Add header rows with + Header Row instead."
                : "Select two or more cells by clicking and dragging, then merge them"
            },
            "Merge Cells"
          ),
          h(
            "button",
            {
              key: "split-btn",
              type: "button",
              style: splitTarget ? btnStyle : btnStyleDisabled,
              disabled: !splitTarget,
              onClick: this.splitSelected,
              title: "Select a merged cell to split it back apart"
            },
            "Split Cell"
          ),
          h("span", { key: "sep3", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          // Header rows sit above the dark line in the grid.
          h(
            "div",
            {
              key: "header-group",
              role: "group",
              "aria-label": "Header rows",
              title: "Header rows sit above the dark line in the grid. Merge header cells to build multi-row headings.",
              style: groupStyle
            },
            [
              h("span", { key: "header-label", style: { fontSize: "13px", marginRight: "2px" } }, `Header (${headerCount} row${headerCount === 1 ? "" : "s"}):`),
              h(
                "button",
                {
                  key: "header-add",
                  type: "button",
                  style: btnStyle,
                  onClick: this.addHeaderRow,
                  title: "Add a header row below the selected header row (or at the bottom of the header)"
                },
                "+ Header Row"
              ),
              h(
                "button",
                {
                  key: "header-del",
                  type: "button",
                  style: headerCount ? btnStyle : btnStyleDisabled,
                  disabled: !headerCount,
                  onClick: this.deleteHeaderRow,
                  title: "Delete the selected header row (or the bottom header row)"
                },
                "- Header Row"
              )
            ]
          ),
          h("span", { key: "sep4", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          h(
            "button",
            {
              key: "sort-btn",
              type: "button",
              style: sortTarget ? btnStyle : btnStyleDisabled,
              disabled: !sortTarget,
              onClick: this.toggleSortKey,
              title: "Select a header cell that sits over a single column to let readers sort the table by that column"
            },
            sortTarget && sortTarget.cell.sort ? "Remove Sort Key" : "Make Sort Key"
          ),
          h("span", { key: "sep-fmt", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          // Text formatting for the cell being edited (click into a cell and select text first).
          h(
            "div",
            {
              key: "format-group",
              role: "group",
              "aria-label": "Text formatting",
              title: "Formats the selected text in the cell you're editing",
              style: groupStyle
            },
            [
              h("span", { key: "format-label", style: { fontSize: "13px", marginRight: "2px" } }, "Text:"),
              ...renderFormatButtons(this.formatActiveCell)
            ]
          ),
          h("span", { key: "sep5", style: { width: "1px", background: "#ddd", alignSelf: "stretch" } }),
          // Boxed and labelled so it's clear these set a whole column, not one cell.
          h(
            "div",
            {
              key: "align-group",
              role: "group",
              "aria-label": "Column alignment",
              title: "Aligns every cell in the selected column(s), header included",
              style: groupStyle
            },
            [
              h("span", { key: "align-label", style: { fontSize: "13px", marginRight: "2px" } }, "Column alignment:"),
              ...ALIGNMENTS.map((align) => {
                const active = this.state.colAlign[this.state.selStart.c] === align;
                return h(
                  "button",
                  {
                    key: `align-${align}`,
                    type: "button",
                    "aria-pressed": active,
                    style: active ? { ...btnStyle, background: "#e8f0fe", borderColor: "#2a6fdb" } : btnStyle,
                    onClick: () => this.setColumnAlign(align),
                    title: `Align the whole selected column(s) ${align}`
                  },
                  align[0].toUpperCase() + align.slice(1)
                );
              })
            ]
          )
        ]
      );
    },

    // Explains why marked sort keys won't do anything on the page.
    renderSortWarning() {
      const { rows } = this.state;
      const headerCount = this.headerCount();
      if (!hasSortKeys(rows, headerCount) || canSortBody(rows, headerCount)) return null;

      return h(
        "div",
        {
          key: "sort-warning",
          style: { fontSize: "12px", color: "#8a4b00", background: "#fff6e5", border: "1px solid #f0d49b", borderRadius: "4px", padding: "6px 8px", marginBottom: "6px" }
        },
        "Sorting is turned off: a body cell is merged across rows, and those rows can't be reordered. Split that cell to turn sorting back on (notes belong in the Table Footnote field below)."
      );
    },

    renderTable() {
      const { rows } = this.state;
      const headerCount = this.headerCount();

      return h(
        "table",
        { key: "grid", style: { borderCollapse: "collapse", width: "100%" } },
        rows.map((row, r) =>
          h(
            "tr",
            { key: `r${r}` },
            row.map((cell, c) => {
              if (cell === null) return null;

              const isHeaderCell = r < headerCount;
              // Cells reaching the last header row draw the header/body line.
              const endsHeader = isHeaderCell && r + cell.rowSpan === headerCount;
              const sortKey = isHeaderCell && isSortKey(cell);
              const selected = this.isCellSelected(r, c);

              return h(
                isHeaderCell ? "th" : "td",
                {
                  key: `c${r}-${c}`,
                  rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
                  colSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
                  onMouseDown: () => this.handleCellMouseDown(r, c),
                  onMouseEnter: () => this.handleCellMouseEnter(r, c),
                  title: sortKey ? "Sort key: readers can sort the table by this column" : undefined,
                  style: {
                    border: "1px solid #ccc",
                    borderBottom: endsHeader ? "3px solid #6f6f6f" : "1px solid #ccc",
                    padding: "0",
                    background: selected ? "#fdeaea" : isHeaderCell ? "#eef1f5" : "#fff",
                    boxShadow: sortKey ? "inset 0 -3px 0 #2a6fdb" : undefined
                  }
                },
                // A textarea that grows with its content, so Enter adds a line
                // break and long text wraps instead of scrolling sideways.
                h("textarea", {
                  value: cell.text,
                  rows: 1,
                  ref: autoGrow,
                  onFocus: (e) => {
                    this.activeCell = { el: e.target, r, c };
                    this.beginEditSession();
                  },
                  onChange: (e) => {
                    autoGrow(e.target);
                    this.updateCellText(r, c, e.target.value);
                  },
                  style: {
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    border: "none",
                    padding: "6px",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    lineHeight: "1.35",
                    fontWeight: isHeaderCell ? "600" : "normal",
                    textAlign: cell.colSpan === 1 ? this.state.colAlign[c] : isHeaderCell ? "center" : "left",
                    background: "transparent",
                    resize: "none",
                    overflow: "hidden"
                  }
                })
              );
            })
          )
        )
      );
    },

    render() {
      return h(
        "div",
        {
          className: this.props.classNameWrapper,
          ref: (el) => (this.rootEl = el),
          style: { border: "1px solid #ddd", borderRadius: "6px", padding: "10px" },
          onKeyDown: this.handleKeyDown
        },
        [
          this.renderGenerator(),
          this.renderToolbar(),
          h(
            "div",
            { key: "help", style: { fontSize: "12px", opacity: 0.7, marginBottom: "6px" } },
            "Header rows are shaded and sit above the dark line; use + Header Row / - Header Row to change how many there are. " +
              "Click and drag across cells to select a range, then Merge Cells (header and body cells can't be merged together). Click a merged cell and hit Split Cell to unmerge. " +
              "To format text, click into a cell, select the text and use the Text buttons: **bold**, *italic*, ^superscript^, ~subscript~ and [links](https://...) show with these marks here and as real formatting in the preview. Enter adds a line break. " +
              "Select a header cell over a single column and hit Make Sort Key to let readers sort by it (blue underline). Ctrl+Z / Ctrl+Shift+Z to undo/redo."
          ),
          this.renderSortWarning(),
          h("div", { key: "grid-wrap", style: { overflowX: "auto" } }, this.renderTable())
        ]
      );
    }
  });

  // =========================================================
  // PREVIEW (used when the widget is used as a plain field)
  // =========================================================

  const HtmlTableEditorPreview = createClass({
    render() {
      const html = this.props.value || "";
      return h("div", { style: { overflowX: "auto" }, dangerouslySetInnerHTML: { __html: html } });
    }
  });

  CMS.registerWidget(WIDGET_NAME, HtmlTableEditorControl, HtmlTableEditorPreview);

  // =========================================================
  // FOOTNOTE FIELD (textarea with the same Text formatting buttons)
  // =========================================================

  const FOOTNOTE_WIDGET_NAME = "html_table_footnote_input";

  const HtmlTableFootnoteControl = createClass({
    format(format) {
      if (document.activeElement !== this.textarea) return;
      applyFormatTo(this.textarea, format, (value) => this.props.onChange(value));
    },

    handleKeyDown(e) {
      const format = formatForKey(e);
      if (format) {
        e.preventDefault();
        this.format(format);
      }
    },

    render() {
      return h("div", { className: this.props.classNameWrapper }, [
        h(
          "div",
          { key: "toolbar", style: { display: "flex", gap: "4px", alignItems: "center", marginBottom: "6px" } },
          [
            h("span", { key: "format-label", style: { fontSize: "13px", marginRight: "2px" } }, "Text:"),
            ...renderFormatButtons(this.format)
          ]
        ),
        h("textarea", {
          key: "textarea",
          id: this.props.forID,
          ref: (el) => (this.textarea = el),
          value: this.props.value || "",
          onChange: (e) => this.props.onChange(e.target.value),
          onKeyDown: this.handleKeyDown,
          rows: 4,
          placeholder: "[1] Based on the data of ...\n^1^ Bees = honeybees\nSee the [NY DEC portal](https://www.dec.ny.gov) for current registrations.",
          style: {
            display: "block",
            boxSizing: "border-box",
            width: "100%",
            padding: "8px",
            border: "1px solid #b8b8b8",
            borderRadius: "4px",
            fontFamily: "inherit",
            fontSize: "14px",
            lineHeight: "1.4",
            resize: "vertical",
            background: "#fff"
          }
        })
      ]);
    }
  });

  const HtmlTableFootnotePreview = createClass({
    render() {
      return h("div", null, String(this.props.value || ""));
    }
  });

  CMS.registerWidget(FOOTNOTE_WIDGET_NAME, HtmlTableFootnoteControl, HtmlTableFootnotePreview);

  // =========================================================
  // EDITOR COMPONENT (inserted via the "+" menu in markdown bodies)
  // =========================================================

  CMS.registerEditorComponent({
    id: COMPONENT_ID,
    label: "HTML Table (Advanced)",

    fields: [
      { name: "title", label: "Table Title", widget: "string", required: false },
      { name: "html", label: "Table", widget: WIDGET_NAME, required: true },
      {
        name: "footnote",
        label: "Table Footnote",
        widget: FOOTNOTE_WIDGET_NAME,
        required: false,
        hint: "Shown as a full-width row at the bottom of the table. One note per line; a leading marker like [1] is bolded. Use the Text buttons for **bold**, *italic*, ^superscript^ (keys like ^1^), ~subscript~ and [links](https://...)."
      }
    ],

    pattern: PATTERN,

    fromBlock: (match) => splitBlockBody(match?.[1]),

    toBlock: (data) => toBlockText(data?.html, data?.title, data?.footnote),

    toPreview: (data) => {
      const body = renderTableBody(data?.html, data?.title, data?.footnote);
      if (!body) return renderTitleHtml(data?.title) + '<div class="html-table-editor-preview html-table-editor-preview--empty">No table entered.</div>';
      return body;
    }
  });

  startPreviewSortLoop();

  console.info("[HTML Table Editor] Registered widget and editor component (merge/split enabled, no TinyMCE).");
})();
