// netlify/functions/auth-callback.js
// Handles Auth0 OAuth callback and exchanges code for tokens

const https = require('https');

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  const code = event.queryStringParameters.code;
  
  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No authorization code provided' })
    };
  }
  
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const redirectUri = `${process.env.URL}/.netlify/functions/auth-callback`;
  
  // Exchange code for tokens
  const tokenData = JSON.stringify({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri
  });
  
  const options = {
    hostname: auth0Domain,
    port: 443,
    path: '/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': tokenData.length
    }
  };
  
  try {
    const tokenResponse = await httpsRequest(options, tokenData);
    
    if (tokenResponse.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: tokenResponse.error_description || tokenResponse.error })
      };
    }
    
    // Get user info
    const userInfoOptions = {
      hostname: auth0Domain,
      port: 443,
      path: '/userinfo',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`
      }
    };
    
    const userInfo = await httpsRequest(userInfoOptions);
    
    // Create response with tokens
    const response = {
      token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      provider: 'auth0',
      user: userInfo
    };
    
    // Redirect back to CMS with auth success
    const redirectUrl = `${process.env.URL}/admin/#access_token=${tokenResponse.access_token}&token_type=Bearer&expires_in=${tokenResponse.expires_in}`;
    
    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};