/**
 * Auth0 Post-Login Action: "Add guidelines roles claim"
 *
 * Paste this into Auth0 Dashboard > Actions > Library > Build Custom
 * (trigger: Login / Post Login), then add it to the Login flow.
 *
 * What it does: copies the user's assigned Auth0 roles into a namespaced
 * custom claim on BOTH the access token and the ID token, plus the email.
 * The broker (netlify/functions/cms-whoami.mjs) reads the access-token claim.
 *
 * Requires: the two roles created under Auth0 > User Management > Roles and
 * assigned to the relevant users:
 *   - guidelines_editor
 *   - guidelines_publisher
 *
 * event.authorization.roles is populated when the user has roles assigned via
 * Auth0's RBAC (Authorization Core), which is what we use here.
 */
exports.onExecutePostLogin = async (event, api) => {
  // Must match CMS_ROLES_CLAIM / CMS_EMAIL_CLAIM in the broker's env.
  const NAMESPACE = "https://guidelines.cornell-ipm.org";

  const roles = event.authorization?.roles || [];

  // Add to the access token (what the broker validates on API calls).
  api.accessToken.setCustomClaim(`${NAMESPACE}/roles`, roles);
  api.accessToken.setCustomClaim(`${NAMESPACE}/email`, event.user.email);

  // Also add to the ID token so the CMS UI can show name/role client-side.
  api.idToken.setCustomClaim(`${NAMESPACE}/roles`, roles);
};
