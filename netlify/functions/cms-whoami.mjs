// netlify/functions/cms-whoami.mjs
//
// PHASE 1 broker endpoint: prove that an Auth0 login carries the right role all
// the way to a server we control. It validates the Auth0 access token, reads
// the roles claim, and echoes who you are and what you're allowed to do.
//
// It does NOT touch GitHub. The GitHub proxy is cms-git.mjs.

import {
  bearerFromEvent,
  verifyAuth0Token,
  resolveIdentity,
} from "./_shared/auth.mjs";
import { corsHeaders, originOf, json } from "./_shared/http.mjs";

export async function handler(event) {
  const cors = corsHeaders(originOf(event));

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return json(405, { error: "method_not_allowed" }, cors);
  }

  const token = bearerFromEvent(event);
  if (!token) {
    return json(401, { error: "missing_bearer_token" }, cors);
  }

  try {
    const auth = await verifyAuth0Token(token);
    const id = await resolveIdentity(token, auth.sub);
    return json(
      200,
      {
        ok: true,
        sub: auth.sub,
        name: id.name,
        email: id.email,
        roles: auth.roles,
        canEdit: auth.canEdit,
        canPublish: auth.canPublish,
      },
      cors
    );
  } catch (err) {
    return json(
      401,
      { error: "invalid_token", detail: String(err?.message || err) },
      cors
    );
  }
}
