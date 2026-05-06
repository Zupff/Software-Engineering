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

// ── Profile + onboarding ───────────────────────────────────────────────
// On every logged-in page, take over the bottom-left user pill so it shows
// the user's chosen avatar/colour and opens a popover with edit + sign out.
// On the dashboard, if no display_name is set, open the editor modal so
// new users get an onboarding pass without clicking anything.

const AVATAR_LIBRARY = {
    cap:    '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    book:   '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    atom:   '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"/>',
    code:   '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
};

const COLOR_PRESETS = {
    navy:  '#1e3a8a',
    slate: '#475569',
    teal:  '#0d9488',
    amber: '#b45309',
    rose:  '#be185d',
    plum:  '#7c3aed',
};

let cachedProfile = null;

function avatarSvg(avatarId) {
    const id = (avatarId && AVATAR_LIBRARY[avatarId]) ? avatarId : 'cap';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' + AVATAR_LIBRARY[id] + '</svg>';
}

function avatarColor(name) {
    return COLOR_PRESETS[name] || COLOR_PRESETS.navy;
}

function profileDisplay(profile) {
    if (!profile) return { name: 'Student', sub: '', initial: 'S' };
    const name = profile.display_name || profile.username || 'Student';
    return {
        name,
        sub: profile.course || '',
        initial: name.charAt(0).toUpperCase(),
    };
}

async function loadProfile() {
    try {
        const res = await authenticatedFetch('/api/profile');
        if (!res || !res.ok) return null;
        cachedProfile = await res.json();
        return cachedProfile;
    } catch (_e) {
        return null;
    }
}

function renderUserPill() {
    const pill = document.querySelector('.user-pill');
    if (!pill) return;

    // strip the legacy logout-on-click and tooltip
    pill.removeAttribute('onclick');
    pill.removeAttribute('title');
    pill.style.cursor = 'pointer';

    const avatar = pill.querySelector('.user-avatar');
    const nameEl = pill.querySelector('.user-name');
    const d = profileDisplay(cachedProfile);

    if (cachedProfile && cachedProfile.avatar_id) {
        avatar.innerHTML = avatarSvg(cachedProfile.avatar_id);
        avatar.style.background = avatarColor(cachedProfile.avatar_color);
        avatar.classList.add('user-avatar-svg');
    } else {
        avatar.textContent = d.initial;
        avatar.style.background = avatarColor(cachedProfile && cachedProfile.avatar_color);
        avatar.classList.remove('user-avatar-svg');
    }
    nameEl.textContent = d.name;

    // attach the popover (idempotent — clears any prior listeners by cloning)
    const fresh = pill.cloneNode(true);
    pill.parentNode.replaceChild(fresh, pill);
    attachProfilePopover(fresh);
}

function attachProfilePopover(pill) {
    const menu = document.createElement('div');
    menu.className = 'profile-menu hidden';

    const d = profileDisplay(cachedProfile);
    const courseLine = d.sub ? '<div class="pm-course"></div>' : '';
    menu.innerHTML =
        '<div class="pm-head">' +
            '<div class="pm-name"></div>' +
            courseLine +
        '</div>' +
        '<button type="button" class="pm-action" data-action="edit">Edit profile</button>' +
        '<button type="button" class="pm-action pm-signout" data-action="signout">Sign out</button>';

    menu.querySelector('.pm-name').textContent = d.name;
    if (d.sub) menu.querySelector('.pm-course').textContent = d.sub;

    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        menu.classList.add('hidden');
        openProfileEditor();
    });
    menu.querySelector('[data-action="signout"]').addEventListener('click', () => logout());

    pill.appendChild(menu);
    pill.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.classList.toggle('hidden');
    });
    document.addEventListener('click', (ev) => {
        if (!pill.contains(ev.target)) menu.classList.add('hidden');
    });
}

let coursesCache = null;

async function loadCourses() {
    if (coursesCache) return coursesCache;
    try {
        const res = await fetch('/api/profile/courses');
        if (!res.ok) return [];
        coursesCache = await res.json();
        return coursesCache;
    } catch (_e) { return []; }
}

async function openProfileEditor() {
    let modal = document.getElementById('profileEditorModal');
    if (!modal) modal = buildProfileEditorModal();

    const courses = await loadCourses();
    const courseSel = modal.querySelector('#peCourse');
    courseSel.innerHTML = '<option value="">Select your course…</option>' +
        courses.map(c => '<option value="' + c.replace(/"/g, '&quot;') + '">' + c + '</option>').join('');

    const p = cachedProfile || {};
    modal.querySelector('#peName').value     = p.display_name || '';
    courseSel.value = p.course || '';
    setSelectedAvatar(modal, p.avatar_id || 'cap');
    setSelectedColor(modal,  p.avatar_color || 'navy');

    modal.classList.remove('hidden');
    setTimeout(() => modal.querySelector('#peName').focus(), 30);
}

function buildProfileEditorModal() {
    const modal = document.createElement('div');
    modal.id = 'profileEditorModal';
    modal.className = 'profile-modal-backdrop hidden';

    const avatarBtns = Object.keys(AVATAR_LIBRARY).map(id =>
        '<button type="button" class="pe-avatar" data-avatar="' + id + '">' + avatarSvg(id) + '</button>'
    ).join('');

    const colorBtns = Object.keys(COLOR_PRESETS).map(name =>
        '<button type="button" class="pe-color" data-color="' + name + '" style="background:' + COLOR_PRESETS[name] + '"></button>'
    ).join('');

    modal.innerHTML =
        '<div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="peTitle">' +
            '<div class="pe-head">' +
                '<h2 id="peTitle">Set up your profile</h2>' +
                '<p>This is just for you — you can change it any time.</p>' +
            '</div>' +
            '<form id="peForm" class="pe-form">' +
                '<div class="pe-field">' +
                    '<label for="peName">Display name</label>' +
                    '<input type="text" id="peName" required maxlength="60" placeholder="What should we call you?">' +
                '</div>' +
                '<div class="pe-field">' +
                    '<label for="peCourse">Course</label>' +
                    '<select id="peCourse"></select>' +
                '</div>' +
                '<div class="pe-field">' +
                    '<label>Avatar</label>' +
                    '<div class="pe-grid pe-grid-avatars">' + avatarBtns + '</div>' +
                '</div>' +
                '<div class="pe-field">' +
                    '<label>Colour</label>' +
                    '<div class="pe-grid pe-grid-colors">' + colorBtns + '</div>' +
                '</div>' +
                '<div class="pe-preview">' +
                    '<div class="pe-preview-avatar" id="pePreviewAvatar"></div>' +
                    '<div>' +
                        '<div class="pe-preview-name" id="pePreviewName">Display name</div>' +
                        '<div class="pe-preview-course" id="pePreviewCourse">Course</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pe-actions">' +
                    '<button type="button" class="btn-ghost" id="peCancel">Cancel</button>' +
                    '<button type="submit" class="btn-primary">Save profile</button>' +
                '</div>' +
            '</form>' +
        '</div>';

    document.body.appendChild(modal);

    // wire selection toggles + live preview
    modal.querySelectorAll('.pe-avatar').forEach(b => {
        b.addEventListener('click', () => { setSelectedAvatar(modal, b.dataset.avatar); updatePreview(modal); });
    });
    modal.querySelectorAll('.pe-color').forEach(b => {
        b.addEventListener('click', () => { setSelectedColor(modal, b.dataset.color); updatePreview(modal); });
    });
    modal.querySelector('#peName').addEventListener('input',  () => updatePreview(modal));
    modal.querySelector('#peCourse').addEventListener('change', () => updatePreview(modal));

    modal.querySelector('#peCancel').addEventListener('click', () => closeProfileEditor());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeProfileEditor(); });

    modal.querySelector('#peForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await saveProfileFromModal(modal);
    });

    return modal;
}

function setSelectedAvatar(modal, id) {
    modal.querySelectorAll('.pe-avatar').forEach(b => b.classList.toggle('selected', b.dataset.avatar === id));
    modal.dataset.selectedAvatar = id;
}

function setSelectedColor(modal, name) {
    modal.querySelectorAll('.pe-color').forEach(b => b.classList.toggle('selected', b.dataset.color === name));
    modal.dataset.selectedColor = name;
}

function updatePreview(modal) {
    const name   = modal.querySelector('#peName').value.trim() || 'Display name';
    const course = modal.querySelector('#peCourse').value || 'Course';
    const av     = modal.dataset.selectedAvatar || 'cap';
    const color  = modal.dataset.selectedColor || 'navy';

    const avatarBox = modal.querySelector('#pePreviewAvatar');
    avatarBox.innerHTML = avatarSvg(av);
    avatarBox.style.background = avatarColor(color);

    modal.querySelector('#pePreviewName').textContent   = name;
    modal.querySelector('#pePreviewCourse').textContent = course;
}

async function saveProfileFromModal(modal) {
    const payload = {
        display_name: modal.querySelector('#peName').value.trim(),
        course:       modal.querySelector('#peCourse').value || null,
        avatar_id:    modal.dataset.selectedAvatar || 'cap',
        avatar_color: modal.dataset.selectedColor || 'navy',
    };

    try {
        const res = await authenticatedFetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res || !res.ok) {
            const err = res ? await res.json().catch(() => ({})) : {};
            throw new Error(err.message || 'Could not save profile');
        }
        cachedProfile = await res.json();
        // also keep the legacy username key so existing pages picking it up
        // for the avatar initial keep working until they migrate
        if (cachedProfile.display_name) localStorage.setItem('username', cachedProfile.display_name);
        closeProfileEditor();
        renderUserPill();
    } catch (err) {
        alert(err.message);
    }
}

function closeProfileEditor() {
    const modal = document.getElementById('profileEditorModal');
    if (modal) modal.classList.add('hidden');
}

// Bootstrap on every logged-in page: pull the profile, paint the pill,
// fire the onboarding modal on the dashboard if the user hasn't completed
// it yet.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        if (!isLoggedIn()) return;
        if (!document.querySelector('.user-pill')) return;
        await loadProfile();
        renderUserPill();
        // onboarding — fire only on the dashboard so a half-completed
        // profile doesn't keep popping up on every page navigation
        const onDashboard = /(^|\/)Dashboard\.html(\?|$)/i.test(window.location.pathname);
        if (onDashboard && cachedProfile && !cachedProfile.display_name) {
            openProfileEditor();
        }
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
