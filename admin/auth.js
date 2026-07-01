// auth.js
window.TreatmentAuth = {
    async authHeaders() {
        const token = await auth0Client.getTokenSilently({
            authorizationParams: {
                audience: AUTH0_AUDIENCE
            }
        });
        return {
            Authorization: `Bearer ${token}`
        };
    },
    async fetch(url, options = {}) {
        const authHeaders = await this.authHeaders();
        return fetch(url, {
            ...options,
            headers: {
                ...authHeaders,
                ...(options.headers || {})
            }
        });
    }
};