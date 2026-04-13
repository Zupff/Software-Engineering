/**
 * Authentication utility functions
 * Manages tokens, session state, and authenticated requests
 */

function saveToken(token) {
    localStorage.setItem('authToken', token);
}

function getToken() {
    return localStorage.getItem('authToken');
}

function isLoggedIn() {
    return getToken() !== null;
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}

function getAuthHeader() {
    const token = getToken();
    if (token) {
        return { 'Authorization': 'Bearer ' + token };
    }
    return {};
}

function authenticatedFetch(url, options = {}) {
    const authHeader = getAuthHeader();
    const headers = {
        ...authHeader,
        ...(options.headers || {})
    };
    
    const mergedOptions = {
        ...options,
        headers: headers
    };
    
    return fetch(url, mergedOptions).then(response => {
        if (response.status === 401) {
            logout();
            return;
        }
        return response;
    });
}
