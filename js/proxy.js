(function() {
  const DEFAULT_WISP = "wss://wisp.mercurywork.shop";
  const WISP_SERVERS = [
    { name: "Server 1", url: "wss://wisp.mercurywork.shop" },
    { name: "Server 2", url: "wss://truffled.lol/wisp/" }
  ];

  if (!localStorage.getItem("proxServer")) {
    localStorage.setItem("proxServer", DEFAULT_WISP);
  }

  let sharedScramjet = null;

  window.proxy = {};

  window.proxy.getSharedScramjet = async function() {
    if (sharedScramjet) return sharedScramjet;
    
    const basePath = window.utils.getBasePath();
    
    if (typeof $scramjetLoadController === 'undefined') {
      await new Promise(r => {
        const check = () => {
          if (typeof $scramjetLoadController !== 'undefined') {
            r();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    const { ScramjetController } = $scramjetLoadController();
    
    try {
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
    } catch (err) {
      console.error('Scramjet init error:', err);
      throw err;
    }
  };
})();
