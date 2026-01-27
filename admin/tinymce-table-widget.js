// admin/tinymce-table-widget.js
console.log("✅ tinymce-table-widget.js loaded");

(function () {
  if (!window.CMS) {
    console.error("Decap CMS not loaded yet.");
    return;
  }
  if (!window.tinymce) {
    console.error("TinyMCE not loaded.");
    return;
  }

  // Decap commonly exposes these helpers for custom widgets
  const createClass = window.createClass;
  const h = window.h;

  if (!createClass || !h) {
    console.error("Decap helpers createClass/h not found. (This usually means the script ran before Decap loaded.)");
    return;
  }

  const TinyMceTableControl = createClass({
    componentDidMount() {
      const initial = this.props.value || "";
      const textareaId = this.props.forID;

      window.tinymce.init({
        selector: `#${textareaId}`,
        height: 420,
        menubar: false,
        plugins: "table",
        toolbar:
          "table | " +
          "tableprops tablerowprops tablecellprops | " +
          "tableinsertrowbefore tableinsertrowafter tabledeleterow | " +
          "tableinsertcolbefore tableinsertcolafter tabledeletecol | " +
          "tablemergecells tablesplitcells",
        forced_root_block: false,
        content_style:
          "body{font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px}" +
          "table{border-collapse:collapse}" +
          "td,th{border:1px solid #ccc;padding:4px}",

        setup: (editor) => {
          this._editor = editor;

          editor.on("init", () => editor.setContent(initial || ""));

          const pushChange = () => {
            const html = editor.getContent({ format: "html" });
            this.props.onChange(html);
          };

          editor.on("Change KeyUp SetContent Undo Redo", pushChange);
        }
      });
    },

    componentWillUnmount() {
      if (this._editor) {
        try {
          window.tinymce.remove(this._editor);
        } catch (e) {}
        this._editor = null;
      }
    },

    render() {
      return h(
        "div",
        { style: { border: "1px solid #ddd", borderRadius: "6px", padding: "8px" } },
        h(
          "div",
          { style: { fontSize: "12px", opacity: 0.8, marginBottom: "6px" } },
          "Edit the table visually (merge/split cells, add rows/cols)."
        ),
        h("textarea", { id: this.props.forID })
      );
    }
  });

  const TinyMceTablePreview = createClass({
    render() {
      const html = this.props.value || "";
      return h("div", {
        style: { overflowX: "auto" },
        dangerouslySetInnerHTML: { __html: html }
      });
    }
  });

  window.CMS.registerWidget("tinymce-table", TinyMceTableControl, TinyMceTablePreview);
  console.log("✅ Registered widget: tinymce-table");
})();
