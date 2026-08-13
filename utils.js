(function() {
  window.utils = {};

  let toastId = 0;
  let lastToastTime = 0;

  function showToast(title, message, type, duration) {
    type = type || 'info';
    duration = duration || 3800;
    const container = document.getElementById('toast-container');
    const id = ++toastId;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.id = id;
    const iconMap = {
      info: 'fa-solid fa-circle-info',
      success: 'fa-solid fa-circle-check',
      warning: 'fa-solid fa-triangle-exclamation',
      error: 'fa-solid fa-circle-xmark'
    };
    const icon = iconMap[type] || iconMap.info;
    toast.innerHTML = `
      <span class="toast-icon ${type}"><i class="${icon}"></i></span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(toast);
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => dismissToast(toast);
    let timer = setTimeout(() => dismissToast(toast), duration);
    toast.onmouseenter = () => clearTimeout(timer);
    toast.onmouseleave = () => {
      timer = setTimeout(() => dismissToast(toast), 1200);
    };
    return id;
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  }

  window.utils.notify = function(type, title, message) {
    const now = Date.now();
    if (type === 'info' && (title === 'Light mode' || title === 'Dark mode')) {
      if (now - lastToastTime < 1000) return;
      lastToastTime = now;
    }
    showToast(title, message, type);
  };

  window.utils.getBasePath = function() {
    const path = location.pathname.replace(/[^/]*$/, '');
    return path.endsWith('/') ? path : path + '/';
  };

  window.utils.getStoredWisps = function() {
    try { return JSON.parse(localStorage.getItem('customWisps') || '[]'); } catch { return []; }
  };

  window.utils.getAllWispServers = function() {
    const defaultServers = [
      { name: "Server 1", url: "wss://wisp.mercurywork.shop" },
      { name: "Server 2", url: "wss://truffled.lol/wisp/" }
    ];
    const custom = window.utils.getStoredWisps().map((s, i) => ({ ...s, name: `Server ${i + 3}` }));
    return [...defaultServers, ...custom];
  };
})();
