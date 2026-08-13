(function() {
  const DEFAULT_WISP = "wss://truffled.lol/wisp/";
  const WISP_SERVERS = [
    { name: "Server 1", url: "wss://truffled.lol/wisp/" },
    { name: "Server 2", url: "wss://wisp.mercurywork.shop" }
  ];

  window.settings = {};

  let pendingDeleteUrl = null;

  window.settings.openWispModal = function() {
    document.getElementById('wispModal').classList.add('open');
    window.settings.renderServerList();
  };

  window.settings.closeWispModal = function() {
    document.getElementById('wispModal').classList.remove('open');
  };

  window.settings.renderServerList = function() {
    const list = document.getElementById('serverList');
    list.innerHTML = '';
    const currentUrl = localStorage.getItem('proxServer') || DEFAULT_WISP;
    const allWisps = window.utils.getAllWispServers();

    allWisps.forEach((server, index) => {
      const isActive = server.url === currentUrl;
      const isCustom = index >= WISP_SERVERS.length;
      const item = document.createElement('div');
      item.className = `wisp-option ${isActive ? 'active' : ''}`;
      const deleteBtn = isCustom ?
        `<button class="delete-wisp-btn" onclick="event.stopPropagation(); window.settings.promptDelete('${server.url}')"><i class="fa-solid fa-trash"></i></button>` :
        '';
      item.innerHTML = `
        <div class="wisp-option-header">
          <div class="wisp-option-name">${server.name} ${isActive ? '<i class="fa-solid fa-check" style="margin-left:8px;font-size:0.7em;color:var(--accent);"></i>' : ''}</div>
          <div class="server-status">
            <span class="ping-text">...</span>
            <div class="status-indicator"></div>
            ${deleteBtn}
          </div>
        </div>
      `;
      item.onclick = () => window.settings.setWisp(server.url);
      list.appendChild(item);
      window.settings.checkServerHealth(server.url, item);
    });

    const isAutoswitch = localStorage.getItem('wispAutoswitch') !== 'false';
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'wisp-option';
    toggleContainer.style.cssText = 'margin-top:10px;cursor:default;';
    toggleContainer.innerHTML = `
      <div class="wisp-option-header" style="justify-content:space-between;">
        <div class="wisp-option-name"><i class="fa-solid fa-rotate" style="margin-right:8px"></i> Auto-switch</div>
        <div class="toggle-switch ${isAutoswitch ? 'active' : ''}" id="autoswitchToggle">
          <div class="toggle-knob"></div>
        </div>
      </div>
    `;
    toggleContainer.onclick = () => {
      const newState = !isAutoswitch;
      localStorage.setItem('wispAutoswitch', newState);
      document.getElementById('autoswitchToggle').classList.toggle('active', newState);
      navigator.serviceWorker.controller?.postMessage({ type: 'config', autoswitch: newState });
      window.utils.notify('success', 'Settings Saved', `Auto-switch ${newState ? 'Enabled' : 'Disabled'}`);
      location.reload();
    };
    list.appendChild(toggleContainer);
  };

  window.settings.checkServerHealth = async function(url, element) {
    const dot = element.querySelector('.status-indicator');
    const text = element.querySelector('.ping-text');
    const start = Date.now();
    const markOffline = () => { dot.classList.add('status-error'); text.textContent = 'Offline'; };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      await fetch(url.replace('wss://', 'https://').replace('/wisp/', '/health'), { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeout);
      dot.classList.add('status-success');
      text.textContent = `${Date.now() - start}ms`;
    } catch {
      try {
        const ws = new WebSocket(url);
        ws.onopen = () => { dot.classList.add('status-success'); text.textContent = `${Date.now() - start}ms`; ws.close(); };
        ws.onerror = markOffline;
        setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) { ws.close(); markOffline(); } }, 1000);
      } catch { markOffline(); }
    }
  };

  window.settings.setWisp = function(url) {
    const oldUrl = localStorage.getItem('proxServer');
    localStorage.setItem('proxServer', url);
    if (oldUrl !== url) {
      const name = window.utils.getAllWispServers().find(s => s.url === url)?.name || 'Custom Server';
      window.utils.notify('success', 'Proxy Changed', `Switching to ${name}...`);
    }
    navigator.serviceWorker.controller?.postMessage({ type: 'config', wispurl: url });
    setTimeout(() => location.reload(), 600);
  };

  window.settings.saveCustomWisp = function() {
    const input = document.getElementById('customWispInput');
    const url = input.value.trim();
    if (!url) return;
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      window.utils.notify('error', 'Invalid URL', 'Must start with wss:// or ws://');
      return;
    }
    const customWisps = window.utils.getStoredWisps();
    if (customWisps.some(w => w.url === url) || WISP_SERVERS.some(w => w.url === url)) {
      window.utils.notify('warning', 'Already Exists', 'Server already in list.');
      return;
    }
    const newServer = { name: `Server ${customWisps.length + 3}`, url };
    customWisps.push(newServer);
    localStorage.setItem('customWisps', JSON.stringify(customWisps));
    window.settings.setWisp(url);
    input.value = '';
  };

  window.settings.promptDelete = function(url) {
    pendingDeleteUrl = url;
    document.getElementById('confirmModal').classList.add('open');
  };

  window.settings.confirmDelete = function() {
    if (!pendingDeleteUrl) return;
    let customWisps = window.utils.getStoredWisps().filter(w => w.url !== pendingDeleteUrl);
    localStorage.setItem('customWisps', JSON.stringify(customWisps));
    if (localStorage.getItem('proxServer') === pendingDeleteUrl) {
      window.settings.setWisp(DEFAULT_WISP);
    } else {
      window.settings.renderServerList();
    }
    pendingDeleteUrl = null;
    document.getElementById('confirmModal').classList.remove('open');
  };

  window.settings.cancelDelete = function() {
    pendingDeleteUrl = null;
    document.getElementById('confirmModal').classList.remove('open');
  };

  window.settings.openShortcutModal = function() {
    document.getElementById('shortcutModal').classList.add('open');
    document.getElementById('shortcutName').value = '';
    document.getElementById('shortcutUrl').value = '';
    document.getElementById('shortcutName').focus();
  };

  window.settings.closeShortcutModal = function() {
    document.getElementById('shortcutModal').classList.remove('open');
  };

  window.settings.addShortcutFromModal = function(name, url) {
    if (!name || !url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    const shortcuts = JSON.parse(localStorage.getItem('shortcuts') || '[]');
    shortcuts.push({ name, url });
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    window.settings.closeShortcutModal();
    window.utils.notify('success', 'Shortcut Added', `Added "${name}"`);

    window.tabs.getAll().forEach(tab => {
      try {
        tab.frame.frame.contentWindow?.postMessage({ type: 'shortcutAdded' }, '*');
      } catch {}
    });
  };

  window.deleteCustomWisp = window.settings.deleteCustomWisp;
  window.setWisp = window.settings.setWisp;
  window.openWispModal = window.settings.openWispModal;
  window.closeWispModal = window.settings.closeWispModal;
  window.renderServerList = window.settings.renderServerList;
  window.saveCustomWisp = window.settings.saveCustomWisp;

  document.getElementById('confirmDeleteYes').addEventListener('click', window.settings.confirmDelete);
  document.getElementById('confirmDeleteNo').addEventListener('click', window.settings.cancelDelete);
  document.getElementById('closeConfirmModal').addEventListener('click', window.settings.cancelDelete);
})();
