/**
 * darkmode.js — Dark mode for Study Planner
 *
 * How it works:
 *  1. On load, checks localStorage for a saved preference ('dark' | 'light').
 *     Falls back to the OS prefers-color-scheme media query.
 *  2. Applies or removes the `data-theme="dark"` attribute on <html>.
 *     All dark-mode CSS variables are scoped to [data-theme="dark"] in theme.css.
 *  3. Exposes window.darkMode.toggle() so the profile-menu button can call it.
 *  4. Injects a "Dark mode" toggle into the profile popover each time it's built
 *     (hooks into the existing attachProfilePopover flow in auth.js).
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'theme';
    const html = document.documentElement;

    // ── Helpers ──────────────────────────────────────────────────────────

    function prefersDark() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function isDark() {
        return html.getAttribute('data-theme') === 'dark';
    }

    function applyTheme(dark) {
        if (dark) {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        // Update every toggle button that may already be in the DOM
        document.querySelectorAll('[data-darkmode-btn]').forEach(updateBtn);
    }

    function updateBtn(btn) {
        const dark = isDark();
        btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        // Swap icon + label
        btn.querySelector('.dm-label').textContent = dark ? 'Light mode' : 'Dark mode';
        btn.querySelector('.dm-icon').innerHTML = dark ? SUN_SVG : MOON_SVG;
    }

    // ── Bootstrap ────────────────────────────────────────────────────────

    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        // saved === null → follow OS; saved === 'dark'|'light' → honour it
        const dark = saved === null ? prefersDark() : saved === 'dark';
        applyTheme(dark);

        // React to OS-level changes only when the user hasn't pinned a preference
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(STORAGE_KEY)) applyTheme(e.matches);
            });
        }
    }

    // Run as early as possible to avoid a flash of wrong theme
    init();

    // ── Public API ───────────────────────────────────────────────────────

    window.darkMode = {
        toggle() {
            const next = !isDark();
            localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
            applyTheme(next);
        },
        isDark,
    };

    // ── SVG icons ────────────────────────────────────────────────────────

    const MOON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
    const SUN_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

    // ── Profile-menu integration ─────────────────────────────────────────
    // auth.js calls attachProfilePopover() every time the pill is rendered.
    // We patch it after DOMContentLoaded so auth.js is already parsed.

    function injectToggleIntoMenu(menu) {
        if (!menu || menu.querySelector('[data-darkmode-btn]')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pm-action dm-toggle';
        btn.setAttribute('data-darkmode-btn', '');
        btn.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
        btn.innerHTML =
            '<span class="dm-icon">' + (isDark() ? SUN_SVG : MOON_SVG) + '</span>' +
            '<span class="dm-label">' + (isDark() ? 'Light mode' : 'Dark mode') + '</span>';

        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();   // don't close the popover
            window.darkMode.toggle();
        });

        // Insert before the Sign out button
        const signout = menu.querySelector('.pm-signout');
        if (signout) {
            menu.insertBefore(btn, signout);
        } else {
            menu.appendChild(btn);
        }
    }

    // MutationObserver watches for profile-menu elements being added to the DOM
    // (auth.js creates them dynamically) and injects the toggle button.
    document.addEventListener('DOMContentLoaded', () => {
        // Handle any menu already present
        document.querySelectorAll('.profile-menu').forEach(injectToggleIntoMenu);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains('profile-menu')) {
                        injectToggleIntoMenu(node);
                    }
                    node.querySelectorAll && node.querySelectorAll('.profile-menu').forEach(injectToggleIntoMenu);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
})();