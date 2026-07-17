// netlify/functions/_shared/github-app.mjs
// Mint short-lived GitHub App installation tokens. This is the credential that
// commits on every editor's behalf, so editors never need GitHub accounts.
//
// Signing uses node:crypto (not jose) because GitHub App private keys are
// PKCS#1 ("BEGIN RSA PRIVATE KEY"), which node:crypto accepts as-is. No key
// conversion required.

import crypto from "node:crypto";

const APP_ID = process.env.GITHUB_APP_ID;
const INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID;
const PRIVATE_KEY_B64 = process.env.GITHUB_APP_PRIVATE_KEY_B64;

// Installation tokens last ~1h; cache and reuse until shortly before expiry.
let cached = null; // { token, expiresAtMs }

function privateKeyPem() {
  if (!PRIVATE_KEY_B64) {
    throw new Error("GITHUB_APP_PRIVATE_KEY_B64 is not set");
  }
  return Buffer.from(PRIVATE_KEY_B64, "base64").toString("utf8");
}

// Build a signed App JWT (max 10 min lifetime per GitHub) used to request an
// installation token.
function appJwt() {
  if (!APP_ID) throw new Error("GITHUB_APP_ID is not set");

  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: nowSec - 60, // backdate for clock skew
    exp: nowSec + 9 * 60, // 9 min, under GitHub's 10 min cap
    iss: String(APP_ID),
  };

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), privateKeyPem())
    .toString("base64url");

  return `${signingInput}.${signature}`;
}

export async function getInstallationToken() {
  if (!INSTALLATION_ID) {
    throw new Error("GITHUB_APP_INSTALLATION_ID is not set");
  }

  const now = Date.now();
  if (cached && cached.expiresAtMs - 60_000 > now) {
    return cached.token;
  }

  const res = await fetch(
    `https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "nysipm-guidelines-cms",
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `installation token request failed: HTTP ${res.status} ${await res.text()}`
    );
  }

  const data = await res.json();
  cached = { token: data.token, expiresAtMs: Date.parse(data.expires_at) };
  return data.token;
}
