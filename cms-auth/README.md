# CMS auth: Auth0-only login for the Decap admin

Goal: an editor logs into `/admin/` **once, via Auth0**, and never has to log in
to GitHub. Access is gated by Auth0 roles. Commits to the repo are performed by
a **server-side GitHub App**, not by the editor's own GitHub account.

## Why a broker is needed (read this first)

In Decap CMS, the login backend is also the thing that **writes to git**. The
current `github` backend logs you in via GitHub OAuth *and* uses that token to
commit. Auth0 alone can authenticate a person but cannot write to the GitHub
repo. So replacing the GitHub login requires two parts:

- **Authorization** — an Auth0 role decides *who is allowed* to edit/publish.
- **Git writes** — a **GitHub App** credential (held server-side) does the
  actual commits/PRs on the editor's behalf.

The **broker** is the small server that ties them together: it validates the
Auth0 token, checks the role, and then acts via the GitHub App.

## Where the broker lives

**Netlify Functions, in this repo** (`netlify/functions/`). The demo deploys on
Netlify, so a function deploys with the site, shares the `/admin/` origin (no
CORS), and reads secrets (later: the GitHub App private key) from Netlify env
vars. If Cornell IPM policy requires AWS instead, the token/role logic is
written as a portable core (`validateAndDescribe` in `cms-whoami.mjs`) and only
the handler wrapper needs to change for Lambda + API Gateway.

## Target architecture (full picture)

```
Editor -> /admin/ -> Auth0 login (the ONLY login)
        -> Decap sends Auth0 access token to the broker
Broker  -> validate Auth0 JWT + role claim
        -> mint short-lived GitHub App installation token
        -> forward to api.github.com (commit/PR), author = editor's name/email
GitHub  -> commit / open PR / merge -> Netlify rebuild
```

Roles map onto Decap's editorial workflow:

| Auth0 role             | Can do                                   |
| ---------------------- | ---------------------------------------- |
| `guidelines_editor`    | create/edit entries -> PRs; Draft <-> In Review |
| `guidelines_publisher` | the above **+ merge to `main`** (publish) |

Recommended build: **B1**, a GitHub-API proxy. Keep Decap's built-in `github`
backend but point `api_root` at the broker and override token acquisition to use
the Auth0 token. This reuses all of Decap's editorial-workflow logic; the broker
just checks the role and swaps the Auth0 token for the GitHub App token.

---

## Phase 1 (this branch): prove the role reaches a server we control

Phase 1 is additive and does **not** change the working CMS backend. It stands
up the broker's identity half so you can confirm, end to end, that an Auth0
login carries the correct role to the server.

Pieces added on this branch:

- `netlify/functions/cms-whoami.mjs` — validates the Auth0 access token and
  echoes `{ sub, email, roles, canEdit, canPublish }`.
- `scripts/test-cms-whoami.sh` — CLI check against the deployed endpoint.
- `netlify.toml` — registers `netlify/functions/`.
- `package.json` — adds `jose` (JWT/JWKS validation).

**Roles claim:** the broker reads the tenant's existing curated claim
`https://cornell-ipm.org/roles` (added by the "Add roles to token" Post Login
action, which the IPM team manages). No CMS-specific Auth0 action is required.

### Setup steps

1. **Auth0 roles.** In Auth0 > User Management > Roles, create
   `guidelines_editor` and `guidelines_publisher`. Assign `guidelines_editor`
   (and optionally `guidelines_publisher`) to your own user for testing. They
   flow into the token via the existing "Add roles to token" action.

2. **Deploy the function.** Push this branch; open its Netlify deploy preview.
   The endpoint is:
   `https://<branch-preview>--dancing-sundae-a531d3.netlify.app/.netlify/functions/cms-whoami`
   Optionally set Netlify env vars (defaults already match this repo):
   `AUTH0_ISSUER`, `AUTH0_AUDIENCE`, `CMS_ROLES_CLAIM`, `CMS_EMAIL_CLAIM`,
   `CMS_ALLOWED_ORIGINS`.

3. **Get a token + test.** On the preview's `/admin/`, log in with Auth0, then in
   the devtools console run `await window.TreatmentAuth.getTokenOrLogin()` and
   copy the token. Then:

   ```sh
   ./scripts/test-cms-whoami.sh \
     https://<branch-preview>--dancing-sundae-a531d3.netlify.app/.netlify/functions/cms-whoami \
     <ACCESS_TOKEN>
   ```

### Phase 1 is done when

The response shows your `sub`, your `roles` including `guidelines_editor`, and
`"canEdit": true` — confirming the Auth0 login carried the role to the server
with no GitHub login involved.

---

## Phase 2 (this branch): the role-gated GitHub proxy

The server half of Auth0-only login. Editors authenticate with Auth0; a
server-side GitHub App does the commits.

Pieces added:

- `netlify/functions/cms-git.mjs` — proxy: validates the Auth0 token + role,
  answers Decap's `GET /user` from Auth0, gates PR-merge on
  `guidelines_publisher`, and forwards everything else to `api.github.com` with
  the App token, attributing commits to the editor.
- `netlify/functions/_shared/` — `auth.mjs` (token validation + `/userinfo`
  identity), `github-app.mjs` (installation-token minting via `node:crypto`),
  `http.mjs` (CORS/JSON helpers). `cms-whoami.mjs` now reuses these.
- `netlify.toml` — `/cms-git/*` redirect to the function.
- `scripts/test-cms-git.sh` — reads a repo file *through the proxy* to verify
  the whole server chain independently of Decap.

### GitHub App setup (one time, you)

Create it in the **NYSIPM** org (Settings > Developer settings > GitHub Apps >
New). Webhook: **inactive**. Repository permissions:

- **Contents:** Read and write
- **Pull requests:** Read and write
- **Issues:** Read and write  ← editorial-workflow status is stored as PR
  labels, which live under the Issues permission for a GitHub App

Install it on **only** `cornell-ipm-guidelines-demo`. Then set these Netlify env
vars (all deploy contexts; mark secret):

- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_REPO` = `NYSIPM/cornell-ipm-guidelines-demo`
- `GITHUB_APP_PRIVATE_KEY_B64` = the downloaded `.pem`, base64-encoded:
  `base64 -w0 <key>.pem`  (the `.pem` is used as-is; no format conversion)

### Verify the server chain

Once the env vars are set and the preview redeploys, with an access token:

```sh
./scripts/test-cms-git.sh \
  https://<preview>--dancing-sundae-a531d3.netlify.app/cms-git \
  <ACCESS_TOKEN>
```

HTTP 200 with `index.qmd` metadata = Auth0 token -> role check -> App token ->
GitHub read all working.

### Still to do (next step, needs live iteration)

Wire Decap itself: in `admin/config.yml` keep `backend.name: github` but set
`api_root` to `<site>/cms-git`, and inject the Auth0 access token as Decap's
token (login button reuses `TreatmentAuth`) so `/admin/` stops asking for
GitHub. This is the fiddly client-side piece and will be built + tested against
the Deploy Preview.
