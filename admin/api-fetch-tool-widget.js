(function () {
  // Make sure Decap loaded
  if (!window.CMS) {
    console.error("apiFetchTool: window.CMS not found (did decap-cms load?)");
    return;
  }

  // Decap ships with React internally; it is usually available as window.React.
  // If this is undefined, your widget code must be bundled (but let's check first).
  const React = window.React;
  if (!React) {
    console.error("apiFetchTool: window.React not found. Remove external React scripts (you did), then reload.");
    return;
  }

  function ApiFetchToolControl() {
    return React.createElement(
      "div",
      { style: { padding: "10px", border: "1px solid #ddd", borderRadius: "6px" } },
      "✅ apiFetchTool widget loaded and registered"
    );
  }

  window.CMS.registerWidget("apiFetchTool", ApiFetchToolControl);
  console.log("apiFetchTool: registered OK");
})();
