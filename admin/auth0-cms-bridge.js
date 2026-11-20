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
  // Who people without access should contact. Shown on the access-denied
  // screen; leave empty to show a generic "site administrator" message.
  const ACCESS_CONTACT = "";

  const STORAGE_KEYS = ["decap-cms-user", "netlify-cms-user"];

  function clearDecapUser() {
    STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {
        /* storage unavailable; nothing to clear */
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // Full-page message shown instead of Decap. Decap is never initialised in
  // this case, so its "Login with GitHub" screen (which can't work here) never
  // appears. `actions` is a list of { label, onClick, primary }.
  function showScreen({ title, message, detail, actions }) {
    clearDecapUser();

    const root = document.createElement("div");
    root.id = "cms-auth-screen";
    root.setAttribute("role", "alert");
    root.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;" +
      "background:#eff0f4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
      "z-index:99999;padding:24px;";

    root.innerHTML = `
      <div style="max-width:460px;width:100%;background:#fff;border-radius:8px;
                  box-shadow:0 2px 12px rgba(0,0,0,.12);padding:32px;color:#313d3e;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#b31b1b;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 12px;line-height:1.5;">${message}</p>
        ${detail ? `<p style="margin:0 0 20px;font-size:13px;color:#798291;">${escapeHtml(detail)}</p>` : ""}
        <div class="cms-auth-actions" style="display:flex;gap:10px;flex-wrap:wrap;"></div>
      </div>`;

    const bar = root.querySelector(".cms-auth-actions");
    (actions || []).forEach(({ label, onClick, primary }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.style.cssText =
        "padding:9px 16px;border-radius:5px;font-size:14px;cursor:pointer;" +
        (primary
          ? "background:#b31b1b;color:#fff;border:1px solid #b31b1b;"
          : "background:#fff;color:#313d3e;border:1px solid #c4c8d0;");
      btn.addEventListener("click", () => {
        btn.disabled = true;
        Promise.resolve(onClick()).catch((err) => {
          console.error("[auth0-cms-bridge] action failed", err);
          btn.disabled = false;
        });
      });
      bar.appendChild(btn);
    });

    document.body.appendChild(root);
  }

  const logoutAction = {
    label: "Log out",
    onClick: () => window.TreatmentAuth.logout(),
  };
  const switchAccountAction = {
    label: "Log in with a different account",
    primary: true,
    onClick: () => window.TreatmentAuth.logout(),
  };
  const retryAction = {
    label: "Try again",
    primary: true,
    onClick: () => window.location.reload(),
  };

  function showAccessDenied(who) {
    const contact = ACCESS_CONTACT
      ? `please contact ${escapeHtml(ACCESS_CONTACT)}`
      : "please contact the site administrator";
    const account = who.email || who.name || who.sub || "this account";

    showScreen({
      title: "You don't have access to the content manager",
      message:
        `You're signed in as <strong>${escapeHtml(account)}</strong>, but this ` +
        `account hasn't been given editing access to the IPM Guidelines. ` +
        `If you need access, ${contact}.`,
      detail:
        "If you have another account that does have access, log out and sign in with that one.",
      actions: [switchAccountAction],
    });
  }

  // Ask the server what this token is allowed to do. Returns the whoami body
  // on success, or { status, error } on failure.
  async function checkAccess(token) {
    const res = await fetch("/.netlify/functions/cms-whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      /* non-JSON response */
    }
    if (!res.ok) return { status: res.status, error: body };
    return body;
  }

  // Decap's default local_backend address (config.yml uses `local_backend: true`).
  const LOCAL_PROXY_URL = "http://localhost:8081/api/v1";

  async function localProxyRunning() {
    try {
      const res = await fetch(LOCAL_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "info" }),
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  async function boot() {
    if (!window.CMS) {
      console.error("[auth0-cms-bridge] Decap CMS not loaded");
      return;
    }
    //TESTING Code
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocal) {
      console.info(
        "[auth0-cms-bridge] Local mode detected; skipping Auth0 bridge."
      );

      // Local content comes from `local_backend: true` in config.yml (Decap
      // only honours it on localhost/127.0.0.1, so it's safe to commit).
      // That needs the Decap proxy (`npx decap-server`, port 8081). If it isn't
      // running, Decap silently falls back to the GitHub backend and shows
      // "Login with GitHub", so check first and explain instead.
      if (!(await localProxyRunning())) {
        showScreen({
          title: "Local CMS proxy isn't running",
          message:
            "Editing on localhost needs the Decap proxy server. In a terminal at " +
            "the project root, run <code>npx decap-server</code>, leave it " +
            "running, then try again.",
          detail: `Expected it at ${LOCAL_PROXY_URL}`,
          actions: [retryAction],
        });
        return;
      }
      await initCms();
      return;
    }
    //Start of Orginal
    if (!window.TreatmentAuth) {
      console.error("[auth0-cms-bridge] TreatmentAuth (cms.js) not loaded");
      return;
    }

    // Handles the Auth0 redirect callback and restores an existing session.
    await window.TreatmentAuth.init();

    // Redirects to Auth0 if not authenticated; returns null while the browser
    // is navigating away to the login page.
    let token;
    try {
      token = await window.TreatmentAuth.getTokenOrLogin();
    } catch (err) {
      // Usually an expired/ended Auth0 session ("login_required"). Send them
      // back through Auth0 rather than letting Decap fall back to GitHub.
      const code = err?.error || "";
      if (code === "login_required" || code === "missing_refresh_token") {
        await window.TreatmentAuth.login();
        return;
      }
      console.error("[auth0-cms-bridge] could not get Auth0 token", err);
      showScreen({
        title: "Sign-in problem",
        message: "We couldn't complete your sign-in to the content manager.",
        detail: String(err?.message || err),
        actions: [retryAction, logoutAction],
      });
      return;
    }
    if (!token) return;

    // Check the role server-side BEFORE starting Decap. Without this, a user
    // with no CMS role gets a 403 from /cms-git/user and Decap falls back to
    // its own "Login with GitHub" screen, which can't work in this setup.
    let access;
    try {
      access = await checkAccess(token);
    } catch (err) {
      console.error("[auth0-cms-bridge] access check failed", err);
      showScreen({
        title: "Can't reach the content manager",
        message: "We couldn't check your access. Check your connection and try again.",
        detail: String(err?.message || err),
        actions: [retryAction, logoutAction],
      });
      return;
    }

    if (access?.status === 401) {
      // Token rejected (expired, or issued for the wrong API). Start over.
      showScreen({
        title: "Your session has expired",
        message: "Please sign in again to continue.",
        actions: [
          {
            label: "Sign in again",
            primary: true,
            onClick: () => window.TreatmentAuth.logout(),
          },
        ],
      });
      return;
    }
    if (access?.status) {
      showScreen({
        title: "Can't reach the content manager",
        message: "The server returned an error while checking your access.",
        detail: `HTTP ${access.status}${access.error?.error ? ` (${access.error.error})` : ""}`,
        actions: [retryAction, logoutAction],
      });
      return;
    }
    if (!access?.canEdit) {
      showAccessDenied({
        email: access?.email || window.TreatmentAuth.user?.email,
        name: access?.name || window.TreatmentAuth.user?.name,
        sub: access?.sub,
      });
      return;
    }

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

    installLogoutHandler();
    watchForGithubLogin();
    await initCms();
  }

  // Point Decap's site link (top-right header, next to the avatar) and its
  // "View Live" links at whatever host the CMS is running on: the production
  // domain, a deploy preview, or localhost. config.yml's site_url/display_url
  // are only a fallback.
  //
  // Decap merges a config passed to CMS.init() over config.yml, BUT if
  // config.yml isn't served with a YAML Content-Type it silently drops the
  // whole file when a manual config is present. So only pass the override when
  // the server reports YAML (Netlify does; some local dev servers don't).
  async function initCms() {
    const origin = window.location.origin;
    let configIsYaml = false;
    try {
      const res = await fetch("config.yml", {
        method: "HEAD",
        credentials: "same-origin",
        cache: "no-store",
      });
      configIsYaml =
        res.ok && (res.headers.get("Content-Type") || "").includes("yaml");
    } catch (_) {
      /* fall through: init without the override */
    }

    if (configIsYaml) {
      window.CMS.init({ config: { site_url: origin, display_url: origin } });
    } else {
      console.info(
        "[auth0-cms-bridge] config.yml not served as YAML; using its site_url as-is."
      );
      window.CMS.init();
    }
  }

  const textOf = (el) => (el?.textContent || "").trim().toLowerCase();

  // Decap's own "Log Out" (top-right avatar menu) only clears its saved user
  // and then shows its "Login with GitHub" page. Intercept it and end the Auth0
  // session instead, which returns the user to /admin/ and the Auth0 login.
  // Decap has no logout hook, so we match the menu item by its label. Capture
  // phase on window runs before React's handlers on the app root.
  function installLogoutHandler() {
    const LABELS = ["log out", "logout", "log off", "sign out"];

    function findLogoutItem(target) {
      let el = target instanceof Element ? target : target?.parentElement;
      // Climb a few levels: the click may land on an inner span/icon.
      for (let i = 0; el && i < 5; i++, el = el.parentElement) {
        if (LABELS.includes(textOf(el))) return el;
      }
      return null;
    }

    function handle(event) {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (!findLogoutItem(event.target)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      clearDecapUser();
      window.TreatmentAuth.logout().catch((err) => {
        console.error("[auth0-cms-bridge] Auth0 logout failed", err);
        window.location.reload();
      });
    }

    window.addEventListener("click", handle, true);
    window.addEventListener("keydown", handle, true);
  }

  // Safety net: if Decap ever drops back to its own login page anyway (e.g.
  // the Auth0 token expires mid-session and GitHub calls start returning 401),
  // replace its unusable "Login with GitHub" button with our own screen.
  function watchForGithubLogin() {
    let shown = false;
    let pending = false;

    function check() {
      pending = false;
      if (shown) return;
      const buttons = document.querySelectorAll("button, a");
      const githubLogin = Array.from(buttons).some((b) =>
        /^log ?in with github$/.test(textOf(b))
      );
      if (!githubLogin) return;

      shown = true;
      observer.disconnect();
      showScreen({
        title: "Your session has ended",
        message:
          "You've been signed out of the content manager. Continue to sign back in, " +
          "or log out completely.",
        actions: [
          {
            label: "Continue",
            primary: true,
            onClick: () => window.location.assign("/admin/"),
          },
          logoutAction,
        ],
      });
    }

    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(check);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  boot().catch((err) => {
    console.error("[auth0-cms-bridge] boot failed", err);
  });
})();
