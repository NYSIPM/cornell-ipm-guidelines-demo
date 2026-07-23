// netlify/functions/_shared/auth.mjs
// Auth0 access-token validation + editor identity resolution, shared by the
// CMS auth functions.

import { createRemoteJWKSet, jwtVerify } from "jose";

export const ISSUER = process.env.AUTH0_ISSUER || "https://newa-apps.auth0.com/";
const AUDIENCE =
  process.env.AUTH0_AUDIENCE ||
  "https://webguidelines2.psep.cce.cornell.edu/api";
// Roles come from the tenant's curated "Add roles to token" action.
const ROLES_CLAIM =
  process.env.CMS_ROLES_CLAIM || "https://cornell-ipm.org/roles";

export const EDITOR_ROLE = "guidelines_editor";
export const PUBLISHER_ROLE = "guidelines_publisher";

const JWKS = createRemoteJWKSet(new URL("/.well-known/jwks.json", ISSUER));

// Decap's GitHub backend sends "Authorization: token <t>"; direct callers use
// "Bearer <t>". Accept either scheme.
export function bearerFromEvent(event) {
  const header =
    event.headers.authorization || event.headers.Authorization || "";
  const match = header.match(/^(?:Bearer|token)\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function verifyAuth0Token(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  const roles = Array.isArray(payload[ROLES_CLAIM]) ? payload[ROLES_CLAIM] : [];

  return {
    sub: payload.sub,
    roles,
    canEdit: roles.includes(EDITOR_ROLE),
    canPublish: roles.includes(PUBLISHER_ROLE),
    payload,
  };
}

// Resolve the editor's name/email for commit attribution. The access token
// already carries the Auth0 /userinfo audience and the "email" scope, so we can
// call /userinfo directly. Cached per warm invocation to avoid repeat calls.
const identityCache = new Map();

export async function resolveIdentity(token, sub) {
  if (sub && identityCache.has(sub)) return identityCache.get(sub);

  const fallback = { name: sub, email: null, login: sub, avatar_url: null };

  try {
    const res = await fetch(new URL("/userinfo", ISSUER), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return fallback;

    const info = await res.json();
    const email = info.email || null;
    const identity = {
      name: info.name || info.nickname || email || sub,
      email,
      // Synthetic GitHub-style login (email local-part) for Decap's UI.
      login: (email || sub || "editor").split("@")[0],
      avatar_url: info.picture || null,
    };
    if (sub) identityCache.set(sub, identity);
    return identity;
  } catch {
    return fallback;
  }
}
