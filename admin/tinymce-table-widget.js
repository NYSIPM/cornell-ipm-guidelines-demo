(function () {
  if (!window.CMS) {
    console.error("Decap CMS not loaded yet.");
    return;
  }
  if (!window.tinymce) {
    console.error("TinyMCE not loaded. Check your script tag in admin/index.html");
    return;
  }

  const h = window.React.createElement;

  class TinyMceTableControl extends window.React.Component {
    constructor(props) {
      super(props);
      this.textareaId = `tinymce-table-${Math.random().toString(36).slice(2)}`;
      this._editor = null;
      this._settingContent = false;
    }

    componentDidMount() {
      const initial = this.props.value || "";

      window.tinymce.init({
        selector: `#${this.textareaId}`,
        height: 420,
        menubar: false,

        // IMPORTANT: table tools
        plugins: "table",
        toolbar:
          "table | " +
          "tableprops tablerowprops tablecellprops | " +
          "tableinsertrowbefore tableinsertrowafter tabledeleterow | " +
          "tableinsertcolbefore tableinsertcolafter tabledeletecol | " +
          "tablemergecells tablesplitcells",

        // Make the content feel table-focused
        forced_root_block: false,
        content_style:
          "body{font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px} table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:4px}",

        setup: (editor) => {
          this._editor = editor;

          editor.on("init", () => {
            // Load existing HTML (ideally a <table>…</table>)
            editor.setContent(initial || "");
          });

          // Push changes back to Decap
          const pushChange = () => {
            if (this._settingContent) return;
            const html = editor.getContent({ format: "html" });
            this.props.onChange(html);
          };

          editor.on("Change KeyUp SetContent Undo Redo", pushChange);
        }
      });
    }

    componentDidUpdate(prevProps) {
      // If Decap updates the value (e.g., undo, switching entries), sync TinyMCE
      if (this._editor && prevProps.value !== this.props.value) {
        const current = this._editor.getContent({ format: "html" });
        const next = this.props.value || "";
        if (current !== next) {
          this._settingContent = true;
          this._editor.setContent(next);
          this._settingContent = false;
        }
      }
    }

    componentWillUnmount() {
      if (this._editor) {
        const id = this._editor.id;
        try {
          window.tinymce.remove(this._editor);
        } catch (e) {
          // ignore
        }
        this._editor = null;
      }
    }

    render() {
      return h(
        "div",
        { style: { border: "1px solid #ddd", borderRadius: 6, padding: 8 } },
        h(
          "div",
          { style: { fontSize: 12, opacity: 0.8, marginBottom: 6 } },
          "Edit the table visually (merge/split cells, add rows/cols). This saves HTML into your :::html-table block."
        ),
        h("textarea", { id: this.textareaId })
      );
    }
  }

  // Optional: preview in Decap preview pane (shows the table)
  const TinyMceTablePreview = (props) => {
    const html = props.value || "";
    return h("div", { style: { overflowX: "auto" }, dangerouslySetInnerHTML: { __html: html } });
  };

  window.CMS.registerWidget("tinymce-table", TinyMceTableControl, TinyMceTablePreview);
})();
