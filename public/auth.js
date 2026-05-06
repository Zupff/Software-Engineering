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

// Auto-populate any element with data-current-semester on logged-in pages.
// Defined as a listener so individual page scripts don't all need to call it.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!isLoggedIn()) return;
        if (!document.querySelector('[data-current-semester]')) return;
        loadCurrentSemester();
    });
}

// Look up the user's most recent semester and write its name into any
// element with data-current-semester. Called after page init on every
// logged-in page so the sidebar isn't stuck on a hardcoded label.
function loadCurrentSemester() {
    return authenticatedFetch('/api/semesters/current').then(res => {
        if (!res || !res.ok) return null;
        return res.json();
    }).then(sem => {
        const targets = document.querySelectorAll('[data-current-semester]');
        if (!sem) {
            targets.forEach(el => { el.textContent = 'No semester yet'; });
            return null;
        }
        targets.forEach(el => { el.textContent = sem.name; });
        return sem;
    }).catch(() => null);
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
