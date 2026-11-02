// admin/preview-image-fallback.js
//
// Shows newly uploaded images in Decap's preview pane before the site has been
// rebuilt.
//
// Why this is needed: image links in pages start with "/" (e.g.
// /publications/tree-fruit/images/x.jpg, or /images/x.jpg in guides built as
// their own Quarto project) so they work from every page depth and in the PDF.
// Decap treats any path starting with "/" as a finished web address and just
// asks the website for it - but a fresh upload is only in the repo until the
// next build/deploy (and an image in an unpublished draft never reaches the
// site), so the preview shows nothing.
//
// What this does: watches the preview pane for images that fail to load from
// the site, works out where the file lives in the repo, fetches it the same
// way Decap does (local decap-server when working on localhost, otherwise the
// GitHub API through our /cms-git proxy, draft branch first, then main) and
// shows it in place. Images the site already serves are left alone.
//
// Path rules (they follow the naming convention in admin/config.yml, where a
// collection's name is its folder name):
//   /images/x.jpg              -> publications/<current collection>/images/x.jpg
//   /publications/.../x.jpg    -> publications/.../x.jpg
//   /static/images/x.jpg       -> static/images/x.jpg

(function () {
  "use strict";

  // Keep in sync with admin/config.yml (backend.repo, backend.branch, api_root).
  const REPO = "NYSIPM/cornell-ipm-guidelines-demo";
  const MAIN_BRANCH = "main";
  const API_ROOT = "/cms-git";
  const LOCAL_API = "http://localhost:8081/api/v1"; // decap-server default
  const POLL_MS = 1000;

  const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  const MIME = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp"
  };

  const isLocal = () =>
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  // ---------------------------------------------------------------------------
  // Where we are in the admin: "#/collections/<name>/entries/<slug>" (or /new).
  // ---------------------------------------------------------------------------
  function currentEntry(hash) {
    const m = String(hash || window.location.hash).match(/#\/collections\/([^/]+)(?:\/entries\/([^?]+))?/);
    if (!m) return { collection: null, slug: null };
    return {
      collection: decodeURIComponent(m[1]),
      slug: m[2] ? decodeURIComponent(m[2]) : null
    };
  }

  // Image src (as written in the page) -> repo path, or null if it isn't one
  // of ours (external URLs, data:/blob: URLs, non-images).
  function repoPathFor(src, collection) {
    if (!src || !src.startsWith("/") || src.startsWith("//")) return null;
    const path = decodeURIComponent(src.split(/[?#]/)[0]);
    if (!IMAGE_EXT.test(path)) return null;
    if (path.startsWith("/images/")) {
      return collection ? `publications/${collection}${path}` : null;
    }
    return path.slice(1);
  }

  // Branches to try on GitHub: the entry's editorial-workflow draft branch
  // (Decap names it cms/<collection>/<slug>), then the live branch.
  function branchesFor(entry) {
    const branches = [];
    if (entry.collection && entry.slug) branches.push(`cms/${entry.collection}/${entry.slug}`);
    branches.push(MAIN_BRANCH);
    return branches;
  }

  // ---------------------------------------------------------------------------
  // Fetching the file (returns base64 content, or null if not found).
  // ---------------------------------------------------------------------------
  async function fetchLocal(repoPath) {
    const res = await fetch(LOCAL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getMediaFile", params: { branch: MAIN_BRANCH, path: repoPath } })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.content ? json.content : null;
  }

  // The proxy returns GitHub's body as text, so ask for JSON (base64 inside)
  // rather than raw bytes. Files over 1 MB come back from /contents without
  // content, so fetch those through the git blob API (also JSON, up to 100 MB).
  async function fetchGitHub(repoPath, entry) {
    const headers = window.TreatmentAuth ? await window.TreatmentAuth.authHeaders() : {};
    headers.Accept = "application/vnd.github+json";
    const encodedPath = repoPath.split("/").map(encodeURIComponent).join("/");

    for (const branch of branchesFor(entry)) {
      const res = await fetch(`${API_ROOT}/repos/${REPO}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, { headers });
      if (res.status === 404) continue;
      if (!res.ok) return null;
      const json = await res.json();
      if (json.content) return json.content.replace(/\s+/g, "");
      if (json.sha) {
        const blob = await fetch(`${API_ROOT}/repos/${REPO}/git/blobs/${json.sha}`, { headers });
        if (blob.ok) {
          const data = await blob.json();
          if (data.content) return data.content.replace(/\s+/g, "");
        }
      }
      return null;
    }
    return null;
  }

  function base64ToObjectUrl(base64, repoPath) {
    const ext = (repoPath.match(/\.([a-z0-9]+)$/i) || [])[1] || "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: MIME[ext.toLowerCase()] || "application/octet-stream" }));
  }

  // One request per file: repoPath -> Promise<objectURL | null>.
  const cache = new Map();

  function loadFromRepo(repoPath, entry) {
    const key = isLocal() ? repoPath : `${branchesFor(entry).join("|")}:${repoPath}`;
    if (!cache.has(key)) {
      const fetcher = isLocal() ? fetchLocal(repoPath) : fetchGitHub(repoPath, entry);
      cache.set(key, fetcher
        .then((base64) => (base64 ? base64ToObjectUrl(base64, repoPath) : null))
        .catch((err) => {
          console.warn("[preview-image-fallback] could not load", repoPath, err);
          return null;
        }));
    }
    return cache.get(key);
  }

  // ---------------------------------------------------------------------------
  // Watching the preview pane.
  // ---------------------------------------------------------------------------
  async function fixImage(img) {
    const src = img.getAttribute("src");
    const entry = currentEntry();
    const repoPath = repoPathFor(src, entry.collection);
    if (!repoPath) return;
    const url = await loadFromRepo(repoPath, entry);
    // Only swap if the preview hasn't since replaced this image's src.
    if (url && img.getAttribute("src") === src) {
      img.dataset.repoFallback = repoPath;
      img.src = url;
    }
  }

  const watched = new WeakSet();

  function watch(img) {
    if (watched.has(img)) return;
    watched.add(img);
    img.addEventListener("error", () => fixImage(img));
    // Already finished loading before we got here, and failed.
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fixImage(img);
  }

  function previewDocuments() {
    return Array.from(document.querySelectorAll("iframe"))
      .map((frame) => {
        try {
          return frame.contentDocument;
        } catch (err) {
          return null; // not same-origin; not the preview pane
        }
      })
      .filter(Boolean);
  }

  function scan() {
    for (const doc of previewDocuments()) {
      doc.querySelectorAll("img[src]").forEach(watch);
    }
  }

  setInterval(scan, POLL_MS);

  // Exposed for testing only.
  window.PreviewImageFallback = { currentEntry, repoPathFor, branchesFor, fetchLocal, fetchGitHub, fixImage, scan };
})();
