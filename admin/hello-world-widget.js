// admin/hello-world-widget.js
(function () {
  if (!window.CMS) return;
  const h = window.h || window.React.createElement;

  const HelloWorldControl = createClass({
    render() {
      return h("div", { className: this.props.classNameWrapper }, "Hello World!");
    }
  });

  const HelloWorldPreview = createClass({
    render() {
      return h("div", null, "Hello World!");
    }
  });

  CMS.registerWidget("hello_world", HelloWorldControl, HelloWorldPreview);

  // Editor component: makes it insertable via the "+" menu in markdown bodies
  CMS.registerEditorComponent({
    id: "hello-world",
    label: "Hello World Test",
    fields: [],
    pattern: /^\{\{hello-world\}\}$/,
    fromBlock: () => ({}),
    toBlock: () => "{{hello-world}}",
    toPreview: () => "<div>Hello World!</div>",
  });
})();