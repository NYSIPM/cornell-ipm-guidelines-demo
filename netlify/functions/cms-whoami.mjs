// netlify/functions/cms-whoami.mjs
//
// PHASE 1 broker endpoint: prove that an Auth0 login carries the right role
// all the way to a server we control (Netlify Functions, in this repo).
//
// It does NOT touch GitHub yet. It only:
//   1. validates the Auth0 access token (signature via JWKS, issuer, audience)
//   2. reads the namespaced roles claim added by the Auth0 post-login Action
//   3. echoes back who you are and what you're allowed to do
//
// The token-validation + role logic below is deliberately written as a
// portable core (validateAndDescribe) so that moving this to AWS Lambda later
// is just a new handler wrapper around the same function.

import { createRemoteJWKSet, jwtVerify } from "jose";

// --- Config (env vars override the defaults; defaults match this repo today) ---
const ISSUER = process.env.AUTH0_ISSUER || "https://newa-apps.auth0.com/";
// Phase 1 reuses the audience the SPA already requests in cms.js, so no client
// changes are needed to test. Phase 2 may introduce a dedicated CMS audience.
const AUDIENCE =
  process.env.AUTH0_AUDIENCE ||
  "https://webguidelines2.psep.cce.cornell.edu/api";
// Namespace for custom claims. Auth0 requires custom claims to be namespaced
// URIs; this does not need to resolve to a real site.
// Roles are read from the tenant's existing curated claim (added by the
// "Add roles to token" Post Login action). No CMS-specific Auth0 action needed.
const ROLES_CLAIM =
  process.env.CMS_ROLES_CLAIM || "https://cornell-ipm.org/roles";
// Access tokens don't carry email by default and the curated action doesn't add
// it. Phase 2 resolves the editor's name/email from Auth0 /userinfo (the token
// already has that audience + the "email" scope). Until then this stays null.
const EMAIL_CLAIM =
  process.env.CMS_EMAIL_CLAIM || "https://cornell-ipm.org/email";

const EDITOR_ROLE = "guidelines_editor";
const PUBLISHER_ROLE = "guidelines_publisher";

// JWKS is fetched once and cached by jose across warm invocations.
const JWKS = createRemoteJWKSet(new URL("/.well-known/jwks.json", ISSUER));

// --- Portable core: validate a bearer token and describe the caller ---
async function validateAndDescribe(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  const roles = Array.isArray(payload[ROLES_CLAIM]) ? payload[ROLES_CLAIM] : [];

  return {
    ok: true,
    sub: payload.sub,
    // Access tokens don't include email by default; the Action adds it as a
    // namespaced claim. Fall back to the standard claim if present.
    email: payload[EMAIL_CLAIM] || payload.email || null,
    roles,
    canEdit: roles.includes(EDITOR_ROLE),
    canPublish: roles.includes(PUBLISHER_ROLE),
  };
}

// --- CORS: allow the site's own origins to call this from the browser ---
function corsHeaders(origin) {
  const allowlist = (process.env.CMS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Allow explicitly configured origins plus any Netlify deploy preview for
  // this site (branch previews end in .netlify.app).
  const allowed =
    origin && (allowlist.includes(origin) || origin.endsWith(".netlify.app"));

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

// --- Netlify handler wrapper (the only Netlify-specific part) ---
export async function handler(event) {
  const origin = event.headers.origin || event.headers.Origin || "";
  const headers = {
    ...corsHeaders(origin),
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "method_not_allowed" }),
    };
  }

  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "missing_bearer_token" }),
    };
  }

  try {
    const result = await validateAndDescribe(match[1]);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    // Invalid signature, wrong audience/issuer, or expired token all land here.
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: "invalid_token",
        detail: String(err?.message || err),
      }),
    };
  }
}
