const ADBLOCK = {
    blocked: [
        "googlevideo.com/videoplayback",
        "youtube.com/get_video_info",
        "youtube.com/api/stats/ads",
        "youtube.com/pagead",
        "youtube.com/api/stats",
        "youtube.com/get_midroll",
        "youtube.com/ptracking",
        "youtube.com/youtubei/v1/player",
        "youtube.com/s/player",
        "youtube.com/api/timedtext",
        "facebook.com/ads",
        "facebook.com/tr",
        "fbcdn.net/ads",
        "graph.facebook.com/ads",
        "graph.facebook.com/pixel",
        "ads-api.twitter.com",
        "analytics.twitter.com",
        "twitter.com/i/ads",
        "ads.yahoo.com",
        "advertising.com",
        "adtechus.com",
        "amazon-adsystem.com",
        "adnxs.com",
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "rubiconproject.com",
        "pubmatic.com",
        "criteo.com",
        "openx.net",
        "taboola.com",
        "outbrain.com",
        "moatads.com",
        "casalemedia.com",
        "unityads.unity3d.com",
        "/ads/",
        "/adserver/",
        "/banner/",
        "/promo/",
        "/tracking/",
        "/beacon/",
        "/metrics/",
        "adsafeprotected.com",
        "chartbeat.com",
        "scorecardresearch.com",
        "quantserve.com",
        "krxd.net",
        "demdex.net"
    ]
};

function isAdBlocked(url) {
    const urlStr = url.toString();

    for (const pattern of ADBLOCK.blocked) {
        let regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\./g, '\\.')
            .replace(/\?/g, '\\?');

        const regex = new RegExp('^' + regexPattern + '$', 'i');

        if (regex.test(urlStr)) {
            return true;
        }
    }

    return false;
}

const swPath = self.location.pathname;
const basePath = swPath.substring(0, swPath.lastIndexOf('/') + 1);

self.basePath = self.basePath || basePath;

importScripts(
    "https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.all.js",
    "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux@2.1.7/dist/index.js"
);

let scramjet;

try {
    const { ScramjetServiceWorker } = $scramjetLoadWorker();

    scramjet = new ScramjetServiceWorker({
        prefix: basePath + "scramjet/"
    });
} catch (err) {
    console.error("SW: Failed to initialize Scramjet:", err);
}

let wispConfig = {
    wispurl: null,
    servers: [],
    autoswitch: false
};

let bareClient = null;
let connectionReady = false;

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', ({ data, ports }) => {
    if (!data) return;

    if (data.type === "config") {
        if (data.wispurl) {
            wispConfig.wispurl = data.wispurl;
        }

        if (data.servers && data.servers.length > 0) {
            wispConfig.servers = data.servers;
        }

        if (typeof data.autoswitch !== 'undefined') {
            wispConfig.autoswitch = data.autoswitch;
        }

        return;
    }

    if (data.type === "baremux-port" && ports.length > 0) {
        const port = ports[0];

        try {
            const BareClient = BareMux.BareClient;

            bareClient = new BareClient(port);

            if (scramjet) {
                scramjet.client = bareClient;
            }

            connectionReady = true;

            console.log("SW: BareClient connected via port");
        } catch (err) {
            connectionReady = false;
            console.error("SW: Failed to set BareClient:", err);
        }
    }
});

self.addEventListener("fetch", (event) => {
    event.respondWith((async () => {
        if (isAdBlocked(event.request.url)) {
            return new Response(new ArrayBuffer(0), {
                status: 204
            });
        }

        if (!scramjet) {
            return fetch(event.request);
        }

        try {
            await scramjet.loadConfig();
        } catch (err) {
            console.warn("SW: Scramjet config load failed:", err);
        }

        if (connectionReady && scramjet.route(event)) {
            try {
                return await scramjet.fetch(event);
            } catch (err) {
                console.error("SW: Scramjet fetch failed:", err);

                return new Response(
                    "Proxy error: " + err.message,
                    {
                        status: 502,
                        headers: {
                            "Content-Type": "text/plain"
                        }
                    }
                );
            }
        }

        try {
            return await fetch(event.request);
        } catch (err) {
            console.warn("SW: Fallback fetch failed:", err);

            return new Response(
                "Network error",
                {
                    status: 502
                }
            );
        }
    })());
});

if (scramjet) {
    scramjet.addEventListener("request", async (event) => {
        event.response = (async () => {
            if (!wispConfig.wispurl) {
                return new Response(
                    "Wisp URL not configured",
                    {
                        status: 500
                    }
                );
            }

            if (!connectionReady || !bareClient) {
                return new Response(
                    "BareMux client not ready",
                    {
                        status: 503
                    }
                );
            }

            try {
                return await bareClient.fetch(event.url, {
                    method: event.method,
                    body: event.body,
                    headers: event.requestHeaders,
                    credentials: "include",
                    mode: event.mode === "cors"
                        ? event.mode
                        : "same-origin",
                    cache: event.cache,
                    redirect: "manual",
                    duplex: "half"
                });
            } catch (err) {
                console.error("SW: Scramjet request failed:", err);

                return new Response(
                    "Proxy error: " + err.message,
                    {
                        status: 502
                    }
                );
            }
        })();
    });
}
