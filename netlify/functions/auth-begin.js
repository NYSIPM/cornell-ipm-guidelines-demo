// netlify/functions/auth-begin.js
// Initiates Auth0 OAuth flow

exports.handler = async (event) => {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const redirectUri = `${process.env.URL}/.netlify/functions/auth-callback`;
  
  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(7);
  
  // Build Auth0 authorization URL
  const authUrl = new URL(`https://${auth0Domain}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  
  return {
    statusCode: 302,
    headers: {
      Location: authUrl.toString(),
      'Cache-Control': 'no-cache'
    },
    body: ''
  };
};