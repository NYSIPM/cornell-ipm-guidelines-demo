// netlify/functions/cms-git.mjs
//
// PHASE 2 broker: a role-gated proxy in front of the GitHub REST API.
//
// Decap CMS is configured with `backend: github` but `api_root` pointing here.
// Decap sends the editor's Auth0 access token; this function:
//   1. validates the Auth0 token and requires guidelines_contributor or
//      guidelines_editor
//   2. gates publishing (PR merge, or any other write that lands on the
//      published branch) on guidelines_editor (formerly guidelines_publisher),
//      so contributors can draft but not publish
//   3. answers Decap's identity call (GET /user) from Auth0 (there is no
//      GitHub user in this flow)
//   4. forwards everything else to api.github.com using a GitHub App
//      installation token, attributing commits to the editor
//
// Net effect: editors authenticate once with Auth0 and never log into GitHub.
//
// NOTE: the end-to-end Decap wiring (api_root + client token injection) is the
// next step and needs live iteration on a Deploy Preview. This function is
// independently testable now via scripts/test-cms-git.sh once the GitHub App
// env vars are set.

import {
  bearerFromEvent,
  verifyAuth0Token,
  resolveIdentity,
} from "./_shared/auth.mjs";
import { getInstallationToken } from "./_shared/github-app.mjs";
import { corsHeaders, originOf, json } from "./_shared/http.mjs";

const GITHUB_API = "https://api.github.com";
// Path prefix Decap hits (via the /cms-git/* redirect in netlify.toml). Also
// tolerates the raw function path if api_root points straight at the function.
const PREFIX = "/cms-git";
const FUNCTION_PATH = "/.netlify/functions/cms-git";

// Extract the GitHub API path + query from the incoming request.
function parseTarget(event) {
  let pathname = event.path || "";
  let search = event.rawQuery ? `?${event.rawQuery}` : "";

  // rawUrl is the most reliable source when present.
  try {
    const u = new URL(event.rawUrl);
    pathname = u.pathname;
    search = u.search;
  } catch {
    /* fall back to event.path / event.rawQuery */
  }

  let p = pathname;
  if (p.startsWith(FUNCTION_PATH)) p = p.slice(FUNCTION_PATH.length);
  else if (p.includes(PREFIX)) p = p.slice(p.indexOf(PREFIX) + PREFIX.length);
  if (!p.startsWith("/")) p = "/" + p;

  return { ghPath: p, search };
}

// The live branch (config.yml backend.branch). Writes that land here publish.
const PUBLISH_BRANCH = process.env.CMS_PUBLISH_BRANCH || "main";

function parseJsonBody(rawBody, isBase64) {
  if (!rawBody) return null;
  try {
    const raw = isBase64
      ? Buffer.from(rawBody, "base64").toString("utf8")
      : rawBody;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Publishing == anything that changes the live branch. In the editorial
// workflow that is normally merging the entry's PR, but Decap also commits
// straight to the live branch for some actions (e.g. deleting a published
// entry, media library changes), so treat those as publishing too.
function isPublishRequest(method, ghPath, event) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;

  // PUT /repos/:o/:r/pulls/:n/merge
  if (method === "PUT" && /\/pulls\/\d+\/merge$/.test(ghPath)) return true;

  // PATCH/DELETE /repos/:o/:r/git/refs/heads/<live branch>
  const ref = ghPath.match(/\/git\/refs\/heads\/(.+)$/);
  if (ref && decodeURIComponent(ref[1]) === PUBLISH_BRANCH) return true;

  const body = parseJsonBody(event.body, event.isBase64Encoded);

  // POST /repos/:o/:r/merges into the live branch
  if (method === "POST" && /\/merges$/.test(ghPath)) {
    return !body || body.base === PUBLISH_BRANCH;
  }

  // PUT/DELETE /repos/:o/:r/contents/... with no branch writes to the
  // default branch, so only allow it when another branch is named.
  if (/\/contents\//.test(ghPath)) {
    return !body?.branch || body.branch === PUBLISH_BRANCH;
  }

  return false;
}

// Attribute commit-creating requests to the editor (not the App bot).
async function attributeCommit(rawBody, isBase64, token, sub) {
  const raw = isBase64
    ? Buffer.from(rawBody, "base64").toString("utf8")
    : rawBody;

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return rawBody; // not JSON; forward untouched
  }

  const id = await resolveIdentity(token, sub);
  if (id.email) {
    const person = { name: id.name, email: id.email };
    if (!obj.author) obj.author = person;
    if (!obj.committer) obj.committer = person;
  }
  return JSON.stringify(obj);
}

export async function handler(event) {
  const cors = corsHeaders(originOf(event));

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  // --- 1. Authenticate ---
  const token = bearerFromEvent(event);
  if (!token) return json(401, { error: "missing_token" }, cors);

  let auth;
  try {
    auth = await verifyAuth0Token(token);
  } catch (err) {
    return json(
      401,
      { error: "invalid_token", detail: String(err?.message || err) },
      cors
    );
  }

  // --- 2. Authorize (baseline: contributor or editor) ---
  if (!auth.canEdit) {
    return json(
      403,
      {
        error: "forbidden",
        detail: "guidelines_contributor or guidelines_editor role required",
      },
      cors
    );
  }

  const { ghPath, search } = parseTarget(event);

  // --- 3. Identity endpoint: synthesize a user from Auth0 ---
  if (event.httpMethod === "GET" && ghPath === "/user") {
    const id = await resolveIdentity(token, auth.sub);
    return json(
      200,
      {
        login: id.login,
        name: id.name,
        email: id.email,
        avatar_url: id.avatar_url,
      },
      cors
    );
  }

  // --- 4. Gate publish on the editor role (contributors can't publish) ---
  if (isPublishRequest(event.httpMethod, ghPath, event) && !auth.canPublish) {
    return json(
      403,
      {
        error: "forbidden",
        message: "Only guidelines editors can publish. Set the entry to Ready and an editor will publish it.",
        detail: "guidelines_editor role required to publish",
      },
      cors
    );
  }

  // --- 5. Forward to GitHub with the App installation token ---
  let installationToken;
  try {
    installationToken = await getInstallationToken();
  } catch (err) {
    return json(
      502,
      { error: "github_app_error", detail: String(err?.message || err) },
      cors
    );
  }

  const isWrite = !["GET", "HEAD"].includes(event.httpMethod);
  let body = event.body;
  if (
    isWrite &&
    body &&
    /(\/git\/commits|\/contents\/)/.test(ghPath) &&
    ["POST", "PUT", "PATCH"].includes(event.httpMethod)
  ) {
    body = await attributeCommit(body, event.isBase64Encoded, token, auth.sub);
  }

  const ghRes = await fetch(GITHUB_API + ghPath + search, {
    method: event.httpMethod,
    headers: {
      Authorization: `token ${installationToken}`,
      Accept: event.headers.accept || "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "nysipm-guidelines-cms",
    },
    body: isWrite ? body : undefined,
  });

  let text = await ghRes.text();

  // Decap expects a JSON response, even when GitHub successfully returns
  // 204 No Content after deleting the editorial-workflow branch.
  if (
    event.httpMethod === "DELETE" &&
    ghRes.status === 204 &&
    !text.trim()
  ) {
    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        deleted: true,
      }),
    };
  }
  //--- TEMP FOR DEBUGGING ---
  // --- TEMP FOR DEBUGGING ---
  console.log("=== GitHub Response ===");
  console.log("Request:", event.httpMethod, ghPath + search);
  console.log("Status:", ghRes.status);
  console.log("Headers:", Object.fromEntries(ghRes.headers.entries()));
  console.log("Body:", text);
  console.log("=======================");

  // Decap checks write access via GET /repos/:owner/:repo and reads
  // repo.permissions.push. A GitHub App installation token doesn't populate the
  // user-style permissions object, so synthesize write access here. This is
  // safe: access is already gated by role above, and publishing writes are
  // blocked for contributors in step 4.
  if (
    event.httpMethod === "GET" &&
    ghRes.ok &&
    /^\/repos\/[^/]+\/[^/]+$/.test(ghPath)
  ) {
    try {
      const repo = JSON.parse(text);
      repo.permissions = { ...(repo.permissions || {}), pull: true, push: true };
      text = JSON.stringify(repo);
    } catch {
      /* not JSON; leave as-is */
    }
  }

  return {
    statusCode: ghRes.status,
    headers: {
      ...cors,
      "Content-Type":
        ghRes.headers.get("content-type") || "application/json",
    },
    body: text,
  };
}
