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

## Not in Phase 1 (next steps)

- Create the GitHub App (org: NYSIPM, repo: `cornell-ipm-guidelines-demo`,
  permissions: Contents R/W, Pull requests R/W); store its private key as a
  Netlify env var.
- Broker mints installation tokens and proxies `api.github.com` (B1).
- Point Decap's `github` backend `api_root` at the broker; override token
  acquisition to use the Auth0 token; login button reuses `TreatmentAuth`.
- Enforce `guidelines_publisher` on the merge/publish endpoint.
