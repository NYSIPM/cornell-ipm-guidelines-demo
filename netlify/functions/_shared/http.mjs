// netlify/functions/_shared/http.mjs
// Small HTTP helpers shared by the CMS auth functions.

// Reflect the caller's origin if it's allowed, so the browser can call these
// endpoints. Allows explicitly configured origins plus any Netlify deploy
// preview for this site (branch/PR previews end in .netlify.app).
export function corsHeaders(origin) {
  const allowlist = (process.env.CMS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowed =
    origin && (allowlist.includes(origin) || origin.endsWith(".netlify.app"));

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

export function originOf(event) {
  return event.headers.origin || event.headers.Origin || "";
}

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}
