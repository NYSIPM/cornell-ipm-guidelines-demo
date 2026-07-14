const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

function getLocalDevUser() {
  return {
    email: "wbp5@cornell.edu",
    name: "Local Dev User"
  };
}

const AUTH0_CONFIG = {
    domain: 'newa-apps.auth0.com',
    clientId: "de7WU6GhM1OR5eDJ7YY4eb7q6LdK01SV",
    authorizationParams: {
        audience: 'https://webguidelines2.psep.cce.cornell.edu/api',
        redirect_uri: window.location.origin + '/callback/'
    },
    cacheLocation: 'localstorage',
    useRefreshTokens: false
};

let auth0Client = null;

// Initialize Auth0 client
async function initAuth0() {
  if (!auth0Client) {
    auth0Client =
      await auth0.createAuth0Client(AUTH0_CONFIG);

    const hasAuthCode =
      window.location.search.includes("code=") &&
      window.location.search.includes("state=");

    if (hasAuthCode) {
      const callbackResult =
        await auth0Client.handleRedirectCallback();

      const returnTo =
        callbackResult?.appState?.returnTo ||
        window.location.origin;

      window.location.replace(returnTo);

      return auth0Client;
    }
  }

  return auth0Client;
}

// Login function
async function login() {
  try {
    const client = await initAuth0();

    await client.loginWithRedirect({
      appState: {
        returnTo: window.location.href
      },
      authorizationParams: {
        audience:
          "https://webguidelines2.psep.cce.cornell.edu/api",
        redirect_uri:
          window.location.origin + "/callback/"
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed: " + error.message);
  }
}

// Logout function
async function logout() {
    //Development Ignore
    /*
    if (isLocalDev) {
        console.log("Local development mode: skipping Auth0 logout.");
        return;
    }
    */
    try {
        const client = await initAuth0();
        client.logout({
            logoutParams: {
                returnTo: window.location.origin
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Check if user is authenticated
async function checkAuth() {
    //Development Ignore
    /*
    if (isLocalDev) {
        return {
        authenticated: true,
        user: getLocalDevUser()
        };
    }
    */
    try {
        const client = await initAuth0();
        const isAuthenticated = await client.isAuthenticated();
        
        if (isAuthenticated) {
            const user = await client.getUser();
            return { authenticated: true, user };
        }
        
        return { authenticated: false };
    } catch (error) {
        console.error('Auth check error:', error);
        return { authenticated: false };
    }
}

async function getTreatmentAccessToken() {
  const client = await initAuth0();

  const isAuthenticated =
    await client.isAuthenticated();

  if (!isAuthenticated) {
    await login();
    return null;
  }

  try {
    return await client.getTokenSilently({
      authorizationParams: {
        audience:
          "https://webguidelines2.psep.cce.cornell.edu/api"
      }
    });
  } catch (error) {
    console.error("Silent token error:", error);

    if (
      error.error === "consent_required" ||
      error.error === "login_required"
    ) {
      await client.loginWithRedirect({
        appState: {
          returnTo: window.location.href
        },
        authorizationParams: {
          audience:
            "https://webguidelines2.psep.cce.cornell.edu/api",
          redirect_uri:
            window.location.origin + "/callback/",
        }
      });

      return null;
    }

    throw error;
  }
}

window.getTreatmentAccessToken = getTreatmentAccessToken;