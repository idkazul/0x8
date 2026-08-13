(function() {
    let loaded = false;
    let bareConnection = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    let heartbeatInterval = null;
    let isReconnecting = false;

    async function ensureScramjetDB() {
        try {
            const req = indexedDB.open('$scramjet');

            await new Promise((resolve, reject) => {
                req.onsuccess = () => {
                    try {
                        req.result.close();
                    } catch {}

                    resolve();
                };

                req.onerror = () => reject(req.error);
            });

            return true;
        } catch (err) {
            console.warn('Scramjet DB check failed:', err);

            for (const name of ['$scramjet', 'scramjet-data', 'scrambase', 'ScramjetData']) {
                try {
                    indexedDB.deleteDatabase(name);
                } catch {}
            }

            return false;
        }
    }

    function timeoutPromise(promise, ms, message) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(message)), ms);
            })
        ]);
    }

    async function createBareMuxConnection(basePath, wispUrl) {
        console.log('Creating BareMux connection...');

        if (typeof BareMux === 'undefined' || !BareMux.BareMuxConnection) {
            throw new Error('BareMux is not loaded.');
        }

        const workerUrl = basePath + 'bareworker.js?v=2.1.7';

        const connection = new BareMux.BareMuxConnection(workerUrl);

        await timeoutPromise(
            connection.setTransport(
                "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@2.1.28/dist/index.mjs",
                [{ wisp: wispUrl }]
            ),
            10000,
            'BareMux transport initialization timed out.'
        );

        console.log('BareMux transport set.');

        const port = await timeoutPromise(
            connection.getInnerPort(),
            5000,
            'BareMux SharedWorker did not provide a MessagePort.'
        );

        console.log('Port obtained.');

        return { connection, port };
    }

    async function sendPortToSW(port) {
        const reg = await navigator.serviceWorker.ready;
        const sw = reg.active || navigator.serviceWorker.controller;

        if (!sw) {
            throw new Error('Service worker controller is unavailable.');
        }

        sw.postMessage(
            {
                type: 'baremux-port',
                port: port
            },
            [port]
        );

        console.log('Port sent to SW');
    }

    async function reconnectBareMux(basePath, wispUrl) {
        if (isReconnecting) return;

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Max reconnect attempts reached.');
            isReconnecting = false;
            return;
        }

        isReconnecting = true;
        reconnectAttempts++;

        console.log(`Reconnecting BareMux (attempt ${reconnectAttempts})...`);

        try {
            const { connection, port } = await createBareMuxConnection(basePath, wispUrl);

            bareConnection = connection;

            await sendPortToSW(port);

            window._barePort = port;

            reconnectAttempts = 0;
            isReconnecting = false;

            console.log('BareMux reconnected.');
        } catch (err) {
            console.error('Reconnection failed:', err);
            isReconnecting = false;

            setTimeout(() => {
                reconnectBareMux(basePath, wispUrl);
            }, 3000);
        }
    }

    function startHeartbeat(basePath, wispUrl) {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(async () => {
            if (!bareConnection) {
                reconnectBareMux(basePath, wispUrl);
                return;
            }

            try {
                await bareConnection.worker.sendMessage({ type: 'ping' });
                reconnectAttempts = 0;
            } catch (err) {
                console.warn('BareMux heartbeat failed:', err);
                reconnectBareMux(basePath, wispUrl);
            }
        }, 15000);
    }

    function showApp() {
        const ls = document.getElementById('loading-screen');
        const app = document.getElementById('app');

        if (ls) {
            ls.classList.add('hidden');
        }

        if (app) {
            app.style.display = 'flex';
            void app.offsetWidth;
            app.classList.add('visible');
        }
    }

    async function init() {
        if (loaded) return;
        loaded = true;

        await ensureScramjetDB();

        const basePath = window.utils.getBasePath();
        const wispUrl = localStorage.getItem("proxServer") || "wss://wisp.mercurywork.shop";

        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.register(
                    basePath + 'sw.js?v=2.1.7',
                    {
                        scope: basePath,
                        updateViaCache: 'none'
                    }
                );

                await navigator.serviceWorker.ready;

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

                    if (sw) {
                        sw.postMessage(swConfig);
                    }
                };

                sendConfig();
                setTimeout(sendConfig, 500);
                setTimeout(sendConfig, 1500);

                try {
                    const result = await createBareMuxConnection(basePath, wispUrl);

                    bareConnection = result.connection;
                    window._barePort = result.port;

                    await sendPortToSW(result.port);

                    startHeartbeat(basePath, wispUrl);
                } catch (err) {
                    console.error('BareMux startup failed:', err);
                    console.warn('The UI will continue without BareMux until reconnection succeeds.');

                    setTimeout(() => {
                        reconnectBareMux(basePath, wispUrl);
                    }, 3000);
                }

                try {
                    await reg.update();
                } catch {}
            } catch (err) {
                console.error('Service worker initialization failed:', err);
            }
        }

        try {
            const scramjet = await window.proxy.getSharedScramjet();

            window.tabs.init(scramjet);

            if (!window.tabs.getActive()) {
                window.tabs.create(true);
            }
        } catch (err) {
            console.error('Scramjet init error:', err);

            if (window.tabs && window.tabs.init) {
                try {
                    window.tabs.create(true);
                } catch {}
            }
        }

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

                if (url) {
                    window.tabs.navigate(url);
                }
            }
        };

        document.getElementById('addressBar').onfocus = function() {
            this.select();
        };

        document.getElementById('settingsBtn').onclick = window.settings.openWispModal;
        document.getElementById('closeWispModal').onclick = window.settings.closeWispModal;

        document.getElementById('wispModal').onclick = (e) => {
            if (e.target === e.currentTarget) {
                window.settings.closeWispModal();
            }
        };

        document.getElementById('saveCustomWisp').onclick = window.settings.saveCustomWisp;

        document.getElementById('closeShortcutModal').onclick = window.settings.closeShortcutModal;

        document.getElementById('shortcutModal').onclick = (e) => {
            if (e.target === e.currentTarget) {
                window.settings.closeShortcutModal();
            }
        };

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
            } else {
                icon.className = 'fa-solid fa-moon';
            }

            window.tabs.getAll().forEach(tab => {
                try {
                    tab.frame.frame.contentWindow?.postMessage(
                        {
                            type: 'themeChange',
                            isLight
                        },
                        '*'
                    );
                } catch {}
            });
        };

        document.getElementById('headerLogo').onclick = () => {
            document.getElementById('addressBar').focus();
        };

        window.addEventListener('message', (e) => {
            if (e.data?.type === 'getTheme') {
                const isLight = document.body.classList.contains('light-mode');

                try {
                    e.source.postMessage(
                        {
                            type: 'themeChange',
                            isLight
                        },
                        '*'
                    );
                } catch {}
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

                if (active) {
                    window.tabs.close(active.id);
                }
            }

            if (
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA'
            ) {
                return;
            }

            if (e.metaKey || e.ctrlKey || e.altKey) {
                return;
            }

            if (e.key.length === 1) {
                const bar = document.getElementById('addressBar');

                if (document.activeElement !== bar) {
                    bar.focus();
                    bar.setSelectionRange(
                        bar.value.length,
                        bar.value.length
                    );
                }
            }
        });

        showApp();
    }

    window.addEventListener('unhandledrejection', (e) => {
        console.warn('Unhandled rejection:', e.reason);
    });

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await init();
        } catch (err) {
            console.error('Fatal init error:', err);
            showApp();
        }
    });
})();
