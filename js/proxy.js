(function() {
  const DEFAULT_WISP = "wss://wisp.mercurywork.shop";
  const WISP_SERVERS = [
    { name: "Server 1", url: "wss://wisp.mercurywork.shop" },
    { name: "Server 2", url: "wss://truffled.lol/wisp/" }
  ];

  if (!localStorage.getItem("proxServer")) {
    localStorage.setItem("proxServer", DEFAULT_WISP);
  }

  window.utils = window.utils || {};
  window.proxy = window.proxy || {};

  let sharedScramjet = null;

  window.proxy.getSharedScramjet = async function() {
    if (sharedScramjet) return sharedScramjet;

    const basePath = window.utils.getBasePath();

    if (typeof $scramjetLoadController === "undefined") {
      await new Promise((resolve, reject) => {
        const started = Date.now();

        const check = () => {
          if (typeof $scramjetLoadController !== "undefined") {
            resolve();
            return;
          }

          if (Date.now() - started > 15000) {
            reject(new Error("Scramjet controller failed to load."));
            return;
          }

          setTimeout(check, 50);
        };

        check();
      });
    }

    const { ScramjetController } = $scramjetLoadController();

    const controller = new ScramjetController({
      prefix: basePath + "scramjet/",
      files: {
        wasm: "https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.wasm.wasm",
        all: "https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.all.js",
        sync: "https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.sync.js"
      }
    });

    await controller.init();

    sharedScramjet = controller;
    return controller;
  };

  window.proxy.getDefaultWisp = function() {
    return DEFAULT_WISP;
  };

  window.proxy.getWispServers = function() {
    return WISP_SERVERS;
  };
})();
