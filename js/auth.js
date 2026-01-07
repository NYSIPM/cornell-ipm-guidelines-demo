// Auth0 configuration
const AUTH0_CONFIG = {
    domain: 'newa-apps.auth0.com',
    clientId: 'Y0GNl2PlxcghopmChVFQDaZbu35gCxx8O',
    authorizationParams: {
        redirect_uri: window.location.origin + '/callback.html',
        response_mode: 'query'  // Add this
    },
    useRefreshTokens: true,
    cacheLocation: 'localstorage'
};

let auth0Client;

// Initialize Auth0 client
async function initAuth0() {
    auth0Client = await auth0.createAuth0Client(AUTH0_CONFIG);
}

// Login function
async function login() {
    await initAuth0();
    await auth0Client.loginWithRedirect({
        appState: { returnTo: window.location.pathname }
    });
}

// Logout function
async function logout() {
    await initAuth0();
    await auth0Client.logout({
        logoutParams: {
            returnTo: window.location.origin
        }
    });
}

// Check if user is authenticated
async function checkAuth() {
    await initAuth0();
    
    try {
        const isAuthenticated = await auth0Client.isAuthenticated();
        
        if (isAuthenticated) {
            const user = await auth0Client.getUser();
            return { authenticated: true, user };
        }
        
        // Try silent authentication (SSO check)
        try {
            await auth0Client.getTokenSilently();
            const user = await auth0Client.getUser();
            return { authenticated: true, user };
        } catch (error) {
            return { authenticated: false };
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        return { authenticated: false };
    }
}

// Get user info
async function getUser() {
    await initAuth0();
    return await auth0Client.getUser();
}

// Get access token
async function getToken() {
    await initAuth0();
    return await auth0Client.getTokenSilently();
}