// netlify/functions/auth-provider.js
// Returns Auth0 provider configuration for Decap CMS

exports.handler = async (event) => {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  
  const config = {
    auth0: {
      domain: auth0Domain,
      clientId: clientId,
      redirectUri: `${process.env.URL}/.netlify/functions/auth-callback`,
      scope: 'openid profile email'
    }
  };
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(config)
  };
};