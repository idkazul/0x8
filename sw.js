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
    "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux/dist/index.js"
);

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker({
    prefix: basePath + "scramjet/"
});

let wispConfig = {
    wispurl: null,
    servers: [],
    autoswitch: false
};

let bareClient = null;
let connectionReady = false;

function setClientFromPort(port) {
    if (!port) return;
    try {
        const BareClient = BareMux.BareClient;
        bareClient = new BareClient(port);
        scramjet.client = bareClient;
        connectionReady = true;
        console.log('SW: BareClient set from port');
    } catch (err) {
        console.error('SW: Failed to set BareClient:', err);
    }
}

self.addEventListener('install', (e) => {
    e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('message', ({ data, ports }) => {
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
    } else if (data.type === 'baremux-port' && ports.length > 0) {
        const port = ports[0];
        setClientFromPort(port);
    }
});

self.addEventListener("fetch", (event) => {
    event.respondWith((async () => {
        if (isAdBlocked(event.request.url)) {
            return new Response(new ArrayBuffer(0), { status: 204 });
        }

        await scramjet.loadConfig();

        if (connectionReady && scramjet.route(event)) {
            return scramjet.fetch(event);
        }

        try {
            return await fetch(event.request);
        } catch (err) {
            console.warn('Fallback fetch failed:', err);
            return new Response('Network error', { status: 502 });
        }
    })());
});

scramjet.addEventListener("request", async (e) => {
    e.response = (async () => {
        if (!wispConfig.wispurl) {
            return new Response("Wisp URL not configured", { status: 500 });
        }

        if (!connectionReady || !bareClient) {
            return new Response("BareMux client not ready", { status: 503 });
        }

        try {
            const response = await bareClient.fetch(e.url, {
                method: e.method,
                body: e.body,
                headers: e.requestHeaders,
                credentials: "include",
                mode: e.mode === "cors" ? e.mode : "same-origin",
                cache: e.cache,
                redirect: "manual",
                duplex: "half",
            });
            return response;
        } catch (err) {
            console.error("Scramjet fetch error:", err);

            if (err.message?.includes('port') || err.message?.includes('timeout')) {
                return new Response("Proxy connection lost", { status: 503 });
            }
            return new Response("Proxy error: " + err.message, { status: 502 });
        }
    })();
});
