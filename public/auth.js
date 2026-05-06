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
    window.location.href = 'login.html';
}

function getAuthHeader() {
    const token = getToken();
    if (token) {
        return { 'Authorization': 'Bearer ' + token };
    }
    return {};
}

// ── Active semester ────────────────────────────────────────────────────
// Pages that list modules append ?semester_id=<active> when fetching, so
// the Dashboard / Tasks / Gantt are scoped to whichever semester the user
// has selected. The active id lives in localStorage; if unset, we default
// to the most recently created semester returned by /api/semesters.

function getActiveSemesterId() {
    const stored = localStorage.getItem('activeSemesterId');
    return stored ? parseInt(stored, 10) : null;
}

function setActiveSemesterId(id) {
    if (id === null || id === undefined) {
        localStorage.removeItem('activeSemesterId');
    } else {
        localStorage.setItem('activeSemesterId', String(id));
    }
}

// Decorate a URL with ?semester_id=<active> if one is set. Pass-through if
// the URL already specifies a semester_id or if no active semester exists.
function withActiveSemester(url) {
    const id = getActiveSemesterId();
    if (!id) return url;
    if (url.indexOf('semester_id=') !== -1) return url;
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'semester_id=' + id;
}

// Auto-populate any element with data-current-semester on logged-in pages,
// and wire up a click-to-switch dropdown if the user has more than one.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!isLoggedIn()) return;
        if (!document.querySelector('[data-current-semester]')) return;
        renderSemesterSwitcher();
    });
}

async function renderSemesterSwitcher() {
    const targets = Array.from(document.querySelectorAll('[data-current-semester]'));
    if (targets.length === 0) return;

    let semesters = [];
    try {
        const res = await authenticatedFetch('/api/semesters');
        if (res && res.ok) semesters = await res.json();
    } catch (_e) { /* fall through to empty state */ }

    if (semesters.length === 0) {
        targets.forEach(el => { el.textContent = 'No semester yet'; });
        return;
    }

    // resolve active semester: stored id if it still exists, otherwise the
    // most recently created one (semesters returns newest-first)
    let activeId = getActiveSemesterId();
    if (!activeId || !semesters.find(s => s.id === activeId)) {
        activeId = semesters[0].id;
        setActiveSemesterId(activeId);
    }
    const active = semesters.find(s => s.id === activeId) || semesters[0];

    targets.forEach(el => attachSwitcher(el, semesters, active));
}

function attachSwitcher(el, semesters, active) {
    // make the label itself the trigger; cheap to render and works inside
    // the existing user-pill markup without needing per-page changes
    el.classList.add('semester-switcher');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('title', 'Click to switch semester');
    el.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'semester-switcher-label';
    label.textContent = active.name;
    el.appendChild(label);

    const caret = document.createElement('span');
    caret.className = 'semester-switcher-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '⌄';
    el.appendChild(caret);

    const menu = document.createElement('div');
    menu.className = 'semester-switcher-menu hidden';
    semesters.forEach(s => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'semester-switcher-item' + (s.id === active.id ? ' active' : '');
        item.innerHTML =
            '<span class="ssi-name"></span>' +
            (s.academic_year ? '<span class="ssi-year"></span>' : '');
        item.querySelector('.ssi-name').textContent = s.name;
        if (s.academic_year) item.querySelector('.ssi-year').textContent = s.academic_year;
        item.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (s.id !== active.id) {
                setActiveSemesterId(s.id);
                window.location.reload();
            } else {
                menu.classList.add('hidden');
            }
        });
        menu.appendChild(item);
    });
    el.appendChild(menu);

    const toggle = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        menu.classList.toggle('hidden');
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') toggle(ev);
    });
    document.addEventListener('click', (ev) => {
        if (!el.contains(ev.target)) menu.classList.add('hidden');
    });
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
