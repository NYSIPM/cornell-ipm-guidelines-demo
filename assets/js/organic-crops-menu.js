// Fly-out submenu for "Organic Vegetable Crops" in the top menu's Publications
// dropdown, listing each crop so readers can jump straight to it.
//
// Quarto navbar menus can't nest, so this adds the submenu after the page loads.
// It's included by every site's _quarto.yml (root, berry-crops, grapes,
// organic-vegetable-crops) so the menu is the same everywhere.
//
// Desktop: hover (or keyboard-focus) the Organic item to open the list to the
// right. Phones / collapsed menu: tap the arrow button next to it.
//
// To add a crop: add a line below. `folder` is its folder in
// publications/organic-vegetable-crops/ (the link goes to <folder>/index.html).
(function () {
  const CROPS = [
    { name: "Asparagus", folder: "asparagus" },
    { name: "Beans", folder: "beans" },
    { name: "Beets", folder: "beets" },
    { name: "Heading and Leafy Brassicas", folder: "brassicas" },
    { name: "Carrot", folder: "carrot" },
    { name: "Cucurbits", folder: "cucurbits" },
    { name: "Eggplant", folder: "eggplant" },
    { name: "Lettuce", folder: "lettuce" },
    { name: "Onion, Shallot, and Leek", folder: "onion" },
    { name: "Peas", folder: "peas" },
    { name: "Pepper", folder: "pepper" },
    { name: "Potato", folder: "potato" },
    { name: "Spinach", folder: "spinach" },
    { name: "Sweet Corn", folder: "sweet-corn" },
    { name: "Field Tomato", folder: "tomato" },
    { name: "Turnip, Rutabaga, Radish, and Kohlrabi", folder: "turnip" },
  ];

  const CSS = `
    .ovc-item { position: relative; display: flex; align-items: center; }
    .ovc-item > .dropdown-item { flex: 1 1 auto; }
    .ovc-toggle {
      background: none; border: 0; color: inherit; padding: .25rem .75rem;
      line-height: 1; cursor: pointer; transition: transform .15s;
    }
    .ovc-toggle::after { content: "\\203A"; font-size: 1.25rem; }
    .ovc-submenu {
      display: none; list-style: none; margin: 0; padding: .5rem 0;
      background: var(--bs-dropdown-bg, #fff);
      border: var(--bs-dropdown-border-width, 1px) solid var(--bs-dropdown-border-color, rgba(0,0,0,.15));
      border-radius: var(--bs-dropdown-border-radius, .375rem);
    }
    .ovc-item.ovc-open > .ovc-submenu { display: block; }
    /* Desktop (navbar expanded): fly out to the right on hover/focus. */
    @media (min-width: 992px) {
      .ovc-submenu {
        position: absolute; top: calc(-.5rem - 1px); left: 100%;
        min-width: 16rem; max-height: 80vh; overflow-y: auto; z-index: 1001;
        box-shadow: var(--bs-dropdown-box-shadow, 0 .5rem 1rem rgba(0,0,0,.15));
      }
      .ovc-item:hover > .ovc-submenu,
      .ovc-item:focus-within > .ovc-submenu { display: block; }
    }
    /* Collapsed (phone) menu: list opens inline, indented under the item. */
    @media (max-width: 991.98px) {
      .ovc-item { flex-wrap: wrap; }
      .ovc-submenu { flex-basis: 100%; border: 0; background: transparent; padding: 0 0 .25rem 1rem; }
      .ovc-item.ovc-open > .ovc-toggle { transform: rotate(90deg); }
    }
  `;

  function init() {
    const link = Array.from(document.querySelectorAll(".navbar .dropdown-menu a.dropdown-item"))
      .find((a) => /organic-vegetable-crops\/(index\.html)?$/.test(a.getAttribute("href") || ""));
    if (!link || link.parentElement.classList.contains("ovc-item")) return;

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    // The guide's folder URL, worked out from the existing link so it's right
    // from any page on any of the sites.
    const base = new URL(".", link.href).href;
    const li = link.parentElement;
    li.classList.add("ovc-item");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ovc-toggle";
    toggle.setAttribute("aria-label", "Show organic vegetable crops");
    toggle.setAttribute("aria-expanded", "false");

    const sub = document.createElement("ul");
    sub.className = "ovc-submenu";
    sub.id = "ovc-submenu";
    toggle.setAttribute("aria-controls", sub.id);
    for (const crop of CROPS) {
      const item = document.createElement("li");
      const a = document.createElement("a");
      a.className = "dropdown-item";
      a.href = base + crop.folder + "/index.html";
      a.textContent = crop.name;
      item.appendChild(a);
      sub.appendChild(item);
    }

    toggle.addEventListener("click", (e) => {
      // Keep Bootstrap from closing the Publications dropdown.
      e.preventDefault();
      e.stopPropagation();
      const open = li.classList.toggle("ovc-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    li.appendChild(toggle);
    li.appendChild(sub);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
