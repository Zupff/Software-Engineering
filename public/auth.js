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
    window.location.href = 'Login.html';
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
        if (!document.querySelector('[data-current-semester]') &&
            !document.querySelector('[data-current-semester-name]')) return;
        renderSemesterSwitcher();
    });
}

async function renderSemesterSwitcher() {
    const switcherTargets = Array.from(document.querySelectorAll('[data-current-semester]'));
    const nameTargets     = Array.from(document.querySelectorAll('[data-current-semester-name]'));
    if (switcherTargets.length === 0 && nameTargets.length === 0) return;

    let semesters = [];
    try {
        const res = await authenticatedFetch('/api/semesters');
        if (res && res.ok) semesters = await res.json();
    } catch (_e) { /* fall through to empty state */ }

    if (semesters.length === 0) {
        switcherTargets.forEach(el => { el.textContent = 'No semester yet'; });
        nameTargets.forEach(el => { el.textContent = 'no semester yet'; });
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

    switcherTargets.forEach(el => attachSwitcher(el, semesters, active));
    // plain text-only badges (used in page headers and pane heads)
    nameTargets.forEach(el => { el.textContent = active.name; });
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
        const item = document.createElement('div');
        item.className = 'semester-switcher-item' + (s.id === active.id ? ' active' : '');

        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'ssi-switch';
        switchBtn.innerHTML =
            '<span class="ssi-name"></span>' +
            (s.academic_year ? '<span class="ssi-year"></span>' : '');
        switchBtn.querySelector('.ssi-name').textContent = s.name;
        if (s.academic_year) switchBtn.querySelector('.ssi-year').textContent = s.academic_year;
        switchBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (s.id !== active.id) {
                setActiveSemesterId(s.id);
                window.location.reload();
            } else {
                menu.classList.add('hidden');
            }
        });
        item.appendChild(switchBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ssi-delete';
        delBtn.setAttribute('title', 'Delete semester');
        delBtn.setAttribute('aria-label', 'Delete semester');
        delBtn.innerHTML = '×';
        delBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const ok = await uiConfirm({
                title: 'Delete this semester?',
                body: 'Removes "' + s.name + '" and all its modules, tasks and study sessions. This cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                danger: true,
            });
            if (!ok) return;
            try {
                const res = await authenticatedFetch('/api/semesters/' + s.id, { method: 'DELETE' });
                if (!res || (!res.ok && res.status !== 204)) {
                    const err = res ? await res.json().catch(() => ({})) : {};
                    throw new Error(err.message || 'Could not delete semester');
                }
                if (s.id === active.id) localStorage.removeItem('activeSemesterId');
                window.location.reload();
            } catch (err) {
                await uiAlert({ title: 'Could not delete semester', body: err.message || 'Please try again in a moment.' });
            }
        });
        item.appendChild(delBtn);

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
        '<button type="button" class="pm-action" data-action="settings">Settings</button>' +
        '<button type="button" class="pm-action pm-signout" data-action="signout">Sign out</button>';

    menu.querySelector('.pm-name').textContent = d.name;
    if (d.sub) menu.querySelector('.pm-course').textContent = d.sub;

    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        menu.classList.add('hidden');
        openProfileEditor('profile');
    });
    menu.querySelector('[data-action="settings"]').addEventListener('click', () => {
        menu.classList.add('hidden');
        openProfileEditor('settings');
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

async function openProfileEditor(initialTab) {
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

    setEditorTab(modal, initialTab === 'settings' ? 'settings' : 'profile');
    // refresh the semester list every open so additions/deletions stay current
    refreshSettingsSemesterList(modal);

    modal.classList.remove('hidden');
    if (initialTab !== 'settings') {
        setTimeout(() => modal.querySelector('#peName').focus(), 30);
    }
}

function setEditorTab(modal, name) {
    modal.dataset.activeTab = name;
    modal.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    // toggle the OUTER pane wrappers — these own the actions row at the bottom,
    // so hiding only the inner body would leave the Cancel/Save buttons stuck
    // on the Settings tab and create an empty flex slot above the content.
    modal.querySelector('#peForm').classList.toggle('hidden', name !== 'profile');
    modal.querySelector('#pePaneSettings').classList.toggle('hidden', name !== 'settings');
}

// fmt a 'YYYY-MM-DD...'-style timestamp into a friendly date string
function formatCreatedDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function refreshSettingsSemesterList(modal) {
    const list = modal.querySelector('#peSemesterList');
    const empty = modal.querySelector('#peSemesterEmpty');
    list.innerHTML = '';
    list.classList.add('loading');

    let semesters = [];
    try {
        const res = await authenticatedFetch('/api/semesters');
        if (res && res.ok) semesters = await res.json();
    } catch (_e) { /* leave empty */ }
    list.classList.remove('loading');

    if (semesters.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    // already returned newest-first by the server; render as-is
    semesters.forEach(s => {
        const row = document.createElement('div');
        row.className = 'pe-sem-row';
        row.innerHTML =
            '<div class="pe-sem-info">' +
                '<div class="pe-sem-name"></div>' +
                '<div class="pe-sem-meta"></div>' +
            '</div>' +
            '<button type="button" class="pe-btn pe-btn-ghost pe-sem-delete" aria-label="Delete semester">Delete</button>';
        row.querySelector('.pe-sem-name').textContent = s.name;
        const metaBits = [];
        if (s.academic_year) metaBits.push(s.academic_year);
        if (s.created_at) metaBits.push('Created ' + formatCreatedDate(s.created_at));
        row.querySelector('.pe-sem-meta').textContent = metaBits.join(' · ');
        row.querySelector('.pe-sem-delete').addEventListener('click', async () => {
            const ok = await uiConfirm({
                title: 'Delete this semester?',
                body: 'Removes "' + s.name + '" and all its modules, tasks and study sessions. This cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                danger: true,
            });
            if (!ok) return;
            try {
                const res = await authenticatedFetch('/api/semesters/' + s.id, { method: 'DELETE' });
                if (!res || (!res.ok && res.status !== 204)) {
                    const err = res ? await res.json().catch(() => ({})) : {};
                    throw new Error(err.message || 'Could not delete semester');
                }
                if (getActiveSemesterId() === s.id) localStorage.removeItem('activeSemesterId');
                refreshSettingsSemesterList(modal);
            } catch (err) {
                await uiAlert({ title: 'Could not delete semester', body: err.message || 'Please try again in a moment.' });
            }
        });
        list.appendChild(row);
    });
}

// ── Custom dialogs (replace native confirm/alert so the UI matches the
//    rest of the site). Promise-based: `await uiConfirm({...})`.
function uiDialog({ title, body, confirmText, cancelText, danger }) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'ui-dialog-backdrop';
        backdrop.innerHTML =
            '<div class="ui-dialog" role="dialog" aria-modal="true">' +
                '<div class="ui-dialog-head">' +
                    '<h3></h3>' +
                '</div>' +
                '<div class="ui-dialog-body"></div>' +
                '<div class="ui-dialog-actions">' +
                    (cancelText !== null
                        ? '<button type="button" class="pe-btn pe-btn-ghost" data-act="cancel"></button>'
                        : '') +
                    '<button type="button" class="pe-btn ' +
                        (danger ? 'pe-btn-danger' : 'pe-btn-primary') +
                        '" data-act="confirm"></button>' +
                '</div>' +
            '</div>';
        backdrop.querySelector('h3').textContent = title;
        backdrop.querySelector('.ui-dialog-body').textContent = body;
        if (cancelText !== null) {
            backdrop.querySelector('[data-act="cancel"]').textContent = cancelText || 'Cancel';
        }
        backdrop.querySelector('[data-act="confirm"]').textContent = confirmText || 'OK';

        function close(value) {
            backdrop.remove();
            document.removeEventListener('keydown', onKey);
            resolve(value);
        }
        function onKey(ev) {
            if (ev.key === 'Escape') close(false);
            if (ev.key === 'Enter')  close(true);
        }
        backdrop.addEventListener('click', ev => {
            if (ev.target === backdrop) close(false);
        });
        const cancelBtn = backdrop.querySelector('[data-act="cancel"]');
        if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
        backdrop.querySelector('[data-act="confirm"]').addEventListener('click', () => close(true));
        document.addEventListener('keydown', onKey);

        document.body.appendChild(backdrop);
        // focus the primary button so Enter confirms by default
        setTimeout(() => backdrop.querySelector('[data-act="confirm"]').focus(), 30);
    });
}
function uiConfirm(opts)  { return uiDialog(opts); }
function uiAlert(opts)    { return uiDialog({ ...opts, cancelText: null, confirmText: opts.confirmText || 'Close' }); }

async function clearAllSemesters(modal) {
    const ok = await uiConfirm({
        title: 'Clear all semesters?',
        body: 'This removes every semester and all of its modules, tasks, and study sessions. This cannot be undone.',
        confirmText: 'Clear all',
        cancelText: 'Cancel',
        danger: true,
    });
    if (!ok) return;
    try {
        const res = await authenticatedFetch('/api/semesters', { method: 'DELETE' });
        if (!res || !res.ok) {
            const err = res ? await res.json().catch(() => ({})) : {};
            throw new Error(err.message || 'Could not clear semesters');
        }
        localStorage.removeItem('activeSemesterId');
        refreshSettingsSemesterList(modal);
    } catch (err) {
        await uiAlert({ title: 'Could not clear semesters', body: err.message || 'Please try again in a moment.' });
    }
}

async function deleteAccount() {
    const ok1 = await uiConfirm({
        title: 'Delete your account?',
        body: 'This wipes your profile and every semester, module, task, milestone and study session you own. This cannot be undone.',
        confirmText: 'Continue',
        cancelText: 'Cancel',
        danger: true,
    });
    if (!ok1) return;
    const ok2 = await uiConfirm({
        title: 'Last chance',
        body: 'Are you absolutely sure? Click delete to permanently remove your account.',
        confirmText: 'Delete account',
        cancelText: 'Keep account',
        danger: true,
    });
    if (!ok2) return;
    try {
        const res = await authenticatedFetch('/api/account', { method: 'DELETE' });
        if (!res || (!res.ok && res.status !== 204)) {
            const err = res ? await res.json().catch(() => ({})) : {};
            throw new Error(err.message || 'Could not delete account');
        }
        // user is gone — clear local state and bounce to login
        localStorage.clear();
        window.location.href = 'Login.html';
    } catch (err) {
        await uiAlert({ title: 'Could not delete account', body: err.message || 'Please try again in a moment.' });
    }
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
                '<div class="pe-tabs" role="tablist">' +
                    '<button type="button" class="pe-tab active" data-tab="profile" role="tab">Profile</button>' +
                    '<button type="button" class="pe-tab"        data-tab="settings" role="tab">Settings</button>' +
                '</div>' +
            '</div>' +

            // ── Profile pane ──────────────────────────────────────────
            '<form id="peForm" class="pe-form" data-pane="profile">' +
                '<div id="pePaneProfile" class="pe-pane-body">' +
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
                '</div>' +
                '<div class="pe-actions">' +
                    '<button type="button" class="pe-btn pe-btn-ghost" id="peCancel">Cancel</button>' +
                    '<button type="submit" class="pe-btn pe-btn-primary">Save profile</button>' +
                '</div>' +
            '</form>' +

            // ── Settings pane ─────────────────────────────────────────
            '<div id="pePaneSettings" class="pe-form hidden">' +
                '<div class="pe-pane-body">' +
                    '<div class="pe-section">' +
                        '<div class="pe-section-head">' +
                            '<h3>Your semesters</h3>' +
                        '</div>' +
                        '<div id="peSemesterList" class="pe-sem-list"></div>' +
                        '<div id="peSemesterEmpty" class="pe-sem-empty hidden">No semesters yet — import a CSV to create one.</div>' +
                    '</div>' +
                    '<div class="pe-section pe-danger">' +
                        '<div class="pe-danger-row">' +
                            '<div class="pe-danger-info">' +
                                '<div class="pe-danger-title">Clear all semesters</div>' +
                                '<div class="pe-danger-sub">Removes every semester and all its modules, tasks, and sessions.</div>' +
                            '</div>' +
                            '<button type="button" class="pe-btn pe-btn-danger" id="peClearSemesters">Clear all</button>' +
                        '</div>' +
                        '<div class="pe-danger-row">' +
                            '<div class="pe-danger-info">' +
                                '<div class="pe-danger-title">Delete account</div>' +
                                '<div class="pe-danger-sub">Wipes your profile and everything you own. You\'ll be signed out.</div>' +
                            '</div>' +
                            '<button type="button" class="pe-btn pe-btn-danger" id="peDeleteAccount">Delete</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pe-actions">' +
                    '<button type="button" class="pe-btn pe-btn-ghost" id="peSettingsClose">Close</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    // tab toggles
    modal.querySelectorAll('.pe-tab').forEach(t => {
        t.addEventListener('click', () => setEditorTab(modal, t.dataset.tab));
    });

    // wire selection toggles + live preview
    modal.querySelectorAll('.pe-avatar').forEach(b => {
        b.addEventListener('click', () => setSelectedAvatar(modal, b.dataset.avatar));
    });
    modal.querySelectorAll('.pe-color').forEach(b => {
        b.addEventListener('click', () => setSelectedColor(modal, b.dataset.color));
    });

    modal.querySelector('#peCancel').addEventListener('click', () => closeProfileEditor());
    modal.querySelector('#peSettingsClose').addEventListener('click', () => closeProfileEditor());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeProfileEditor(); });

    modal.querySelector('#peForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await saveProfileFromModal(modal);
    });

    modal.querySelector('#peClearSemesters').addEventListener('click', () => clearAllSemesters(modal));
    modal.querySelector('#peDeleteAccount').addEventListener('click', () => deleteAccount());

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
        await uiAlert({ title: 'Could not save profile', body: err.message || 'Please try again in a moment.' });
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
