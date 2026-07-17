// admin/auth0-cms-bridge.js
//
// Makes Decap CMS authenticate via Auth0 instead of GitHub OAuth.
//
// Flow: the editor logs in once with Auth0 (reusing TreatmentAuth from cms.js).
// We hand Decap's github backend the Auth0 access token as its "token". Decap
// then talks to our /cms-git proxy (config.yml api_root), which validates the
// token + role and commits via a GitHub App. Net effect: no GitHub login.
//
// This must load AFTER cms.js (which defines TreatmentAuth and registers the
// widgets) and is responsible for calling CMS.init() itself, so the inline
// init in index.html is removed.
//
// NOTE: the Auth0 access token is ~24h-lived and is not auto-refreshed here; if
// the CMS starts returning 401s after a long session, reload /admin/ to
// re-mint it. Refresh-on-expiry is a follow-up polish item.

(function () {
  async function boot() {
    if (!window.CMS) {
      console.error("[auth0-cms-bridge] Decap CMS not loaded");
      return;
    }
    if (!window.TreatmentAuth) {
      console.error("[auth0-cms-bridge] TreatmentAuth (cms.js) not loaded");
      return;
    }

    // Handles the Auth0 redirect callback and restores an existing session.
    await window.TreatmentAuth.init();

    // Redirects to Auth0 if not authenticated; returns null while the browser
    // is navigating away to the login page.
    const token = await window.TreatmentAuth.getTokenOrLogin();
    if (!token) return;

    const user = window.TreatmentAuth.user || {};
    const login = String(user.email || user.sub || "editor").split("@")[0];
    const decapUser = {
      backendName: "github",
      token: token,
      login: login,
      name: user.name || user.email || login,
    };

    // Decap restores the authenticated user from localStorage on init. Set both
    // the current and legacy keys so this is robust across CMS versions.
    try {
      localStorage.setItem("decap-cms-user", JSON.stringify(decapUser));
      localStorage.setItem("netlify-cms-user", JSON.stringify(decapUser));
    } catch (err) {
      console.warn("[auth0-cms-bridge] could not persist CMS user", err);
    }

    window.CMS.init();
  }

  boot().catch((err) => {
    console.error("[auth0-cms-bridge] boot failed", err);
  });
})();
