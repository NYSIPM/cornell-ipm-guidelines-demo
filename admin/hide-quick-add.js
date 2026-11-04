// admin/hide-quick-add.js
//
// Hides the "Quick add" dropdown in Decap's top header bar.
//
// Why: it creates an entry in any collection from anywhere, always starting at
// the guide's top level, which skips the "New Section" button (and the folder
// it fills in for guides with chapter folders). Editors should add sections
// from inside the guide instead.
//
// How: Decap has no config option for this and its styles use generated class
// names, so we find the button by its label and hide the outermost element
// that holds only that label. To bring it back, remove this script from
// admin/index.html.

(function () {
  "use strict";

  const LABEL = "quick add";

  const textOf = (el) => (el.textContent || "").trim().toLowerCase();

  function hideQuickAdd() {
    document.querySelectorAll('header button, header [role="button"]').forEach((btn) => {
      if (textOf(btn) !== LABEL) return;
      // Climb to the dropdown's wrapper so its spacing goes too.
      let target = btn;
      while (target.parentElement && textOf(target.parentElement) === LABEL) {
        target = target.parentElement;
      }
      target.style.display = "none";
    });
  }

  // Decap re-renders the header (e.g. after login), so keep checking.
  new MutationObserver(hideQuickAdd).observe(document.body, { childList: true, subtree: true });
  hideQuickAdd();
})();
