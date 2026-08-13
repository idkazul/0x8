(function() {
    let loaded = false;

    async function init() {
        if (loaded) return;
        loaded = true;

        // Service Worker registration
        if ('serviceWorker' in navigator) {
            try {
                const basePath = window.utils.getBasePath();
                const reg = await navigator.serviceWorker.register(basePath + 'sw.js', { scope: basePath });
                await navigator.serviceWorker.ready;

                const DEFAULT_WISP = "wss://wisp.mercurywork.shop";
                const wispUrl = localStorage.getItem("proxServer") || DEFAULT_WISP;
                const allServers = window.utils.getAllWispServers();
                const autoswitch = localStorage.getItem('wispAutoswitch') !== 'false';

                const swConfig = {
                    type: "config",
                    wispurl: wispUrl,
                    servers: allServers,
                    autoswitch: autoswitch
                };

                const sendConfig = () => {
                    const sw = reg.active || navigator.serviceWorker.controller;
                    if (sw) sw.postMessage(swConfig);
                };
                sendConfig();
                setTimeout(sendConfig, 500);
                setTimeout(sendConfig, 1500);

                reg.update();
            } catch (err) {
                console.warn('SW registration:', err);
            }
        }

        // Initialize Scramjet (page-side controller)
        try {
            const scramjet = await window.proxy.getSharedScramjet();
            window.tabs.init(scramjet);
        } catch (err) {
            console.warn('Scramjet init error:', err);
            window.utils.notify('error', 'Scramjet Error', 'Failed to initialize. Refreshing may help.');
        }

        // Create the first tab
        window.tabs.create(true);

        // UI bindings
        document.getElementById('backBtn').onclick = () => {
            const tab = window.tabs.getActive();
            if (tab) tab.frame.back();
        };
        document.getElementById('fwdBtn').onclick = () => {
            const tab = window.tabs.getActive();
            if (tab) tab.frame.forward();
        };
        document.getElementById('reloadBtn').onclick = () => {
            const tab = window.tabs.getActive();
            if (tab) tab.frame.reload();
        };
        document.getElementById('addressBar').onkeyup = (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value.trim();
                if (url) window.tabs.navigate(url);
            }
        };
        document.getElementById('addressBar').onfocus = function() { this.select(); };

        document.getElementById('settingsBtn').onclick = window.settings.openWispModal;
        document.getElementById('closeWispModal').onclick = window.settings.closeWispModal;
        document.getElementById('wispModal').onclick = (e) => { if (e.target === e.currentTarget) window.settings.closeWispModal(); };
        document.getElementById('saveCustomWisp').onclick = window.settings.saveCustomWisp;

        document.getElementById('closeShortcutModal').onclick = window.settings.closeShortcutModal;
        document.getElementById('shortcutModal').onclick = (e) => { if (e.target === e.currentTarget) window.settings.closeShortcutModal(); };
        document.getElementById('shortcutForm').onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('shortcutName').value.trim();
            const url = document.getElementById('shortcutUrl').value.trim();
            window.settings.addShortcutFromModal(name, url);
        };

        document.getElementById('themeToggle').onclick = () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            const icon = document.getElementById('themeToggle').querySelector('i');
            if (isLight) {
                icon.className = 'fa-solid fa-sun';
                window.utils.notify('info', 'Light mode', 'Switched to light theme.');
            } else {
                icon.className = 'fa-solid fa-moon';
                window.utils.notify('info', 'Dark mode', 'Switched to dark theme.');
            }
            window.tabs.getAll().forEach(tab => {
                try {
                    tab.frame.frame.contentWindow?.postMessage({ type: 'themeChange', isLight }, '*');
                } catch {}
            });
        };

        document.getElementById('headerLogo').onclick = () => {
            document.getElementById('addressBar').focus();
        };

        window.addEventListener('message', (e) => {
            if (e.data?.type === 'getTheme') {
                const isLight = document.body.classList.contains('light-mode');
                e.source.postMessage({ type: 'themeChange', isLight }, '*');
            }
            if (e.data?.type === 'navigate') {
                window.tabs.navigate(e.data.url);
            }
            if (e.data?.type === 'openShortcutModal') {
                window.settings.openShortcutModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                window.tabs.create(true);
            }
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                const active = window.tabs.getActive();
                if (active) window.tabs.close(active.id);
            }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                const bar = document.getElementById('addressBar');
                if (document.activeElement !== bar) {
                    bar.focus();
                    bar.setSelectionRange(bar.value.length, bar.value.length);
                }
            }
        });

        // Hide loading screen
        const ls = document.getElementById('loading-screen');
        ls.classList.add('hidden');
        const app = document.getElementById('app');
        app.style.display = 'flex';
        void app.offsetWidth;
        app.classList.add('visible');
        window.utils.notify('success', 'Welcome to 0x8', 'Loaded!');
    }

    window.addEventListener('unhandledrejection', (e) => {
        console.warn('Unhandled rejection:', e.reason);
        e.preventDefault();
    });

    document.addEventListener('DOMContentLoaded', async function() {
        try {
            await init();
        } catch (err) {
            console.error('Fatal init error:', err);
            const ls = document.getElementById('loading-screen');
            ls.classList.add('hidden');
            const app = document.getElementById('app');
            app.style.display = 'flex';
            void app.offsetWidth;
            app.classList.add('visible');
            window.utils.notify('error', 'Init Error', err.message);
        }
    });
})();
