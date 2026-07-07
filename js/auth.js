const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

function getLocalDevUser() {
  return {
    email: "wbp5@cornell.edu",
    name: "Local Dev User"
  };
}

// Auth0 Configuration
const AUTH0_CONFIG = {
    domain: 'newa-apps.auth0.com',
    clientId: '0GNl2PlxcghopmChVFQDaZbu35gCxx8O',
    authorizationParams: {
        redirect_uri: window.location.origin + '/callback.html'
    },
    cacheLocation: 'localstorage',  // Try 'memory' if this doesn't work
    useRefreshTokens: false  // Disable for now to simplify
};

let auth0Client = null;

// Initialize Auth0 client
async function initAuth0() {
    if (!auth0Client) {
        auth0Client = await auth0.createAuth0Client(AUTH0_CONFIG);
    }
    return auth0Client;
}

// Login function
async function login() {
    //Development Ignore
    if (isLocalDev) {
        console.log("Local development mode: skipping Auth0 login.");
        return;
    }
    try {
        const client = await initAuth0();
        await client.loginWithRedirect();  // Simplified - no extra params
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
    }
}

// Logout function
async function logout() {
    //Development Ignore
    if (isLocalDev) {
        console.log("Local development mode: skipping Auth0 logout.");
        return;
    }
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
    if (isLocalDev) {
        return {
        authenticated: true,
        user: getLocalDevUser()
        };
    }
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