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

  function makeCell(text) {
    return { text: text || "", rowSpan: 1, colSpan: 1 };
  }

  function defaultModel() {
    return {
      hasHeader: true,
      rows: [
        [makeCell("Header 1"), makeCell("Header 2")],
        [makeCell(""), makeCell("")],
        [makeCell(""), makeCell("")]
      ]
    };
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
    let hasHeader = false;
    let colCount = 0;

    rowEls.forEach((tr, r) => {
      if (r === 0 && tr.parentElement && tr.parentElement.tagName === "THEAD") {
        hasHeader = true;
      }

      let c = 0;
      Array.from(tr.cells).forEach((cellEl) => {
        while (occupied[r][c]) c++;

        const rowSpan = Math.max(1, parseInt(cellEl.getAttribute("rowspan") || "1", 10));
        const colSpan = Math.max(1, parseInt(cellEl.getAttribute("colspan") || "1", 10));
        const text = cellEl.textContent || "";

        grid[r][c] = { text, rowSpan, colSpan };

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

    return { hasHeader, rows: grid };
  }

  // Baked-in inline styles because the published page only ever gets this
  // raw HTML -- there's no editor-only CSS following it to the live site.
  function serializeTable(model) {
    const rows = model.rows || [];
    if (!rows.length) return "";

    function cellsForRow(rowIndex, isHeaderRow) {
      const row = rows[rowIndex];
      const tag = isHeaderRow ? "th" : "td";
      return row
        .filter((cell) => cell !== null)
        .map((cell) => {
          const attrs = [];
          if (cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
          if (cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);
          const attrStr = attrs.length ? " " + attrs.join(" ") : "";
          return `<${tag}${attrStr}>${escapeHtml(cell.text)}</${tag}>`;
        })
        .join("");
    }

    let out = '<table border="1" style="border-collapse:collapse;width:100%;">';

    if (model.hasHeader) {
      out += "<thead><tr>" + cellsForRow(0, true) + "</tr></thead><tbody>";
      for (let r = 1; r < rows.length; r++) out += "<tr>" + cellsForRow(r, false) + "</tr>";
      out += "</tbody>";
    } else {
      out += "<tbody>";
      for (let r = 0; r < rows.length; r++) out += "<tr>" + cellsForRow(r, false) + "</tr>";
      out += "</tbody>";
    }

    out += "</table>";
    return out;
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

  const PATTERN = new RegExp(
    "^```\\{=html\\}\\s*\\n" +
      "<!--\\s*" + MARKER + "\\s*-->\\s*\\n" +
      "([\\s\\S]*?<table[\\s\\S]*?<\\/table>[\\s\\S]*?)\\n" +
      "```\\s*$"
  );

  function toBlockText(html) {
    const trimmed = String(html || "").trim();
    return "```{=html}\n<!-- " + MARKER + " -->\n" + trimmed + "\n```";
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
      const model = parseTableHtml(this.props.value) || defaultModel();
      return {
        hasHeader: model.hasHeader,
        rows: model.rows,
        selStart: { r: 0, c: 0 },
        selEnd: { r: 0, c: 0 },
        isSelecting: false,
        genRows: "3",
        genCols: "2",
        history: [],
        future: []
      };
    },

    componentDidMount() {
      if (!this.props.value) {
        this.emitChange(this.state.rows, this.state.hasHeader);
      }
      window.addEventListener("mouseup", this.handleGlobalMouseUp);
    },

    componentWillUnmount() {
      window.removeEventListener("mouseup", this.handleGlobalMouseUp);
    },

    handleGlobalMouseUp() {
      if (this.state.isSelecting) this.setState({ isSelecting: false });
    },

    emitChange(rows, hasHeader) {
      this.props.onChange(serializeTable({ rows, hasHeader }));
    },

    // Snapshots the current rows/hasHeader onto the undo stack, applies
    // `partialState` (which must include any of rows/hasHeader that are
    // changing), clears the redo stack (a fresh edit invalidates it), and
    // emits the resulting markdown.
    commit(partialState) {
      const snapshot = { rows: cloneRows(this.state.rows), hasHeader: this.state.hasHeader };
      const history = [...this.state.history, snapshot].slice(-MAX_HISTORY);

      this.setState({ ...partialState, history, future: [] });

      this.emitChange(
        "rows" in partialState ? partialState.rows : this.state.rows,
        "hasHeader" in partialState ? partialState.hasHeader : this.state.hasHeader
      );
    },

    // Called when a cell gains focus, so Ctrl+Z undoes a whole typing
    // session in that cell rather than one keystroke at a time.
    beginEditSession() {
      const snapshot = { rows: cloneRows(this.state.rows), hasHeader: this.state.hasHeader };
      this.setState((prev) => ({
        history: [...prev.history, snapshot].slice(-MAX_HISTORY),
        future: []
      }));
    },

    undo() {
      if (!this.state.history.length) return;
      const history = this.state.history.slice();
      const previous = history.pop();
      const currentSnapshot = { rows: cloneRows(this.state.rows), hasHeader: this.state.hasHeader };
      const future = [currentSnapshot, ...this.state.future].slice(0, MAX_HISTORY);

      this.setState({
        rows: previous.rows,
        hasHeader: previous.hasHeader,
        history,
        future,
        selStart: snapToOrigin(previous.rows, this.state.selStart),
        selEnd: snapToOrigin(previous.rows, this.state.selEnd)
      });
      this.emitChange(previous.rows, previous.hasHeader);
    },

    redo() {
      if (!this.state.future.length) return;
      const future = this.state.future.slice();
      const next = future.shift();
      const currentSnapshot = { rows: cloneRows(this.state.rows), hasHeader: this.state.hasHeader };
      const history = [...this.state.history, currentSnapshot].slice(-MAX_HISTORY);

      this.setState({
        rows: next.rows,
        hasHeader: next.hasHeader,
        history,
        future,
        selStart: snapToOrigin(next.rows, this.state.selStart),
        selEnd: snapToOrigin(next.rows, this.state.selEnd)
      });
      this.emitChange(next.rows, next.hasHeader);
    },

    handleKeyDown(e) {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (key === "z" && e.shiftKey) {
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
      this.emitChange(rows, this.state.hasHeader);
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

    canMerge() {
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

    addRow(position) {
      const insertAt = position === "above" ? this.state.selStart.r : this.state.selStart.r + 1;
      this.applyRows(insertRowAt(this.state.rows, insertAt));
    },

    deleteRow() {
      this.applyRows(deleteRowAt(this.state.rows, this.state.selStart.r));
    },

    addColumn(position) {
      const insertAt = position === "left" ? this.state.selStart.c : this.state.selStart.c + 1;
      this.applyRows(insertColumnAt(this.state.rows, insertAt));
    },

    deleteColumn() {
      this.applyRows(deleteColumnAt(this.state.rows, this.state.selStart.c));
    },

    toggleHeader() {
      this.commit({ hasHeader: !this.state.hasHeader });
    },

    generateNewTable() {
      const rowCount = Math.max(1, Math.min(50, parseInt(this.state.genRows, 10) || 1));
      const colCount = Math.max(1, Math.min(20, parseInt(this.state.genCols, 10) || 1));

      const rows = [];
      for (let r = 0; r < rowCount; r++) {
        const row = [];
        for (let c = 0; c < colCount; c++) row.push(makeCell(r === 0 ? `Header ${c + 1}` : ""));
        rows.push(row);
      }

      this.commit({ rows, hasHeader: true, selStart: { r: 0, c: 0 }, selEnd: { r: 0, c: 0 } });
    },

    renderGenerator() {
      return h(
        "div",
        { key: "generator", style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", fontSize: "13px" } },
        [
          "Generate new:",
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
          h("button", { key: "gen-btn", type: "button", style: btnStyle, onClick: this.generateNewTable }, "Generate")
        ]
      );
    },

    renderToolbar() {
      const mergeEnabled = this.canMerge();
      const splitTarget = this.getSplitTarget();

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
              title: "Select two or more cells by clicking and dragging, then merge them"
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
          h(
            "label",
            { key: "header-toggle", style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" } },
            [
              h("input", { key: "header-checkbox", type: "checkbox", checked: this.state.hasHeader, onChange: this.toggleHeader }),
              "Header row"
            ]
          )
        ]
      );
    },

    renderTable() {
      const { rows, hasHeader } = this.state;

      return h(
        "table",
        { key: "grid", style: { borderCollapse: "collapse", width: "100%" } },
        rows.map((row, r) =>
          h(
            "tr",
            { key: `r${r}` },
            row.map((cell, c) => {
              if (cell === null) return null;

              const isHeaderCell = hasHeader && r === 0;
              const selected = this.isCellSelected(r, c);

              return h(
                isHeaderCell ? "th" : "td",
                {
                  key: `c${r}-${c}`,
                  rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
                  colSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
                  onMouseDown: () => this.handleCellMouseDown(r, c),
                  onMouseEnter: () => this.handleCellMouseEnter(r, c),
                  style: {
                    border: "1px solid #ccc",
                    padding: "0",
                    background: selected ? "#fdeaea" : isHeaderCell ? "#f7f7f7" : "#fff"
                  }
                },
                h("input", {
                  type: "text",
                  value: cell.text,
                  onFocus: this.beginEditSession,
                  onChange: (e) => this.updateCellText(r, c, e.target.value),
                  style: {
                    width: "100%",
                    boxSizing: "border-box",
                    border: "none",
                    padding: "6px",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    fontWeight: isHeaderCell ? "600" : "normal",
                    background: "transparent"
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
          style: { border: "1px solid #ddd", borderRadius: "6px", padding: "10px" },
          onKeyDown: this.handleKeyDown
        },
        [
          this.renderGenerator(),
          this.renderToolbar(),
          h(
            "div",
            { key: "help", style: { fontSize: "12px", opacity: 0.7, marginBottom: "6px" } },
            "Click and drag across cells to select a range, then Merge Cells. Click a merged cell and hit Split Cell to unmerge. Ctrl+Z / Ctrl+Shift+Z to undo/redo."
          ),
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
  // EDITOR COMPONENT (inserted via the "+" menu in markdown bodies)
  // =========================================================

  CMS.registerEditorComponent({
    id: COMPONENT_ID,
    label: "HTML Table (Advanced)",

    fields: [{ name: "html", label: "Table", widget: WIDGET_NAME, required: true }],

    pattern: PATTERN,

    fromBlock: (match) => ({ html: (match?.[1] || "").trim() }),

    toBlock: (data) => toBlockText(data?.html),

    toPreview: (data) => {
      const html = String(data?.html || "").trim();
      if (!html) return '<div class="html-table-editor-preview html-table-editor-preview--empty">No table entered.</div>';
      return html;
    }
  });

  console.info("[HTML Table Editor] Registered widget and editor component (merge/split enabled, no TinyMCE).");
})();
