(function() {
  let tabs = [];
  let activeTabId = null;
  let nextTabId = 1;
  let sharedScramjet = null;

  window.tabs = {};

  window.tabs.init = function(scramjet) {
    sharedScramjet = scramjet;
  };

  window.tabs.create = function(makeActive) {
    makeActive = (makeActive !== undefined) ? makeActive : true;
    const frame = sharedScramjet.createFrame();
    const tab = {
      id: nextTabId++,
      title: 'New Tab',
      url: 'NT.html',
      frame: frame,
      loading: false,
      favicon: null,
      loadStartTime: null,
      skipTimeout: null
    };

    frame.frame.src = 'NT.html';

    frame.frame.addEventListener('load', function onLoad() {
      const isLight = document.body.classList.contains('light-mode');
      try {
        this.contentWindow?.postMessage({ type: 'themeChange', isLight }, '*');
      } catch {}
      this.removeEventListener('load', onLoad);
    });

    frame.addEventListener('urlchange', function(e) {
      tab.url = e.url;
      tab.loading = true;
      tab.loadStartTime = Date.now();
      try {
        const urlObj = new URL(e.url);
        tab.title = urlObj.hostname;
        tab.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
      } catch {
        tab.title = 'Browsing';
        tab.favicon = null;
      }
      window.tabs.updateUI();
      window.tabs.updateAddressBar();
      window.tabs.updateLoadingBar(10);
      if (!e.url.includes('NT.html')) {
        document.getElementById('brandCol').classList.add('hidden');
      } else {
        document.getElementById('brandCol').classList.remove('hidden');
      }
    });

    frame.frame.addEventListener('load', function() {
      tab.loading = false;
      clearTimeout(tab.skipTimeout);
      try {
        const title = frame.frame.contentWindow.document.title;
        if (title) tab.title = title;
      } catch {}
      if (frame.frame.contentWindow.location.href.includes('NT.html')) {
        tab.title = 'New Tab';
        tab.url = 'NT.html';
        tab.favicon = null;
        document.getElementById('brandCol').classList.remove('hidden');
      }
      window.tabs.updateUI();
      window.tabs.updateAddressBar();
      window.tabs.updateLoadingBar(100);
    });

    tabs.push(tab);
    const viewport = document.getElementById('viewport');
    viewport.appendChild(frame.frame);
    if (makeActive) window.tabs.switch(tab.id);
    return tab;
  };

  window.tabs.switch = function(tabId) {
    activeTabId = tabId;
    const tab = tabs.find(t => t.id === tabId);
    tabs.forEach(t => {
      t.frame.frame.style.display = (t.id === tabId) ? 'block' : 'none';
    });
    if (tab) {
      if (tab.url && !tab.url.includes('NT.html')) {
        document.getElementById('brandCol').classList.add('hidden');
      } else {
        document.getElementById('brandCol').classList.remove('hidden');
      }
    }
    window.tabs.updateUI();
    window.tabs.updateAddressBar();
  };

  window.tabs.close = function(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const tab = tabs[idx];
    clearTimeout(tab.skipTimeout);
    if (tab.frame?.frame) {
      tab.frame.frame.src = 'about:blank';
      tab.frame.frame.remove();
    }
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      if (tabs.length > 0) window.tabs.switch(tabs[Math.max(0, idx - 1)].id);
      else window.tabs.create(true);
    } else {
      window.tabs.updateUI();
    }
  };

  window.tabs.getActive = function() {
    return tabs.find(t => t.id === activeTabId);
  };

  window.tabs.getAll = function() {
    return tabs;
  };

  window.tabs.updateUI = function() {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
      let iconHtml = '';
      if (tab.loading) {
        iconHtml = `<div class="tab-spinner"></div>`;
      } else if (tab.favicon) {
        iconHtml = `<img src="${tab.favicon}" class="tab-favicon" onerror="this.style.display='none'">`;
      }
      el.innerHTML = `${iconHtml}<span class="tab-title">${tab.title}</span><button class="tab-close">&times;</button>`;
      el.onclick = () => window.tabs.switch(tab.id);
      el.querySelector('.tab-close').onclick = (e) => { e.stopPropagation(); window.tabs.close(tab.id); };
      container.appendChild(el);
    });
    const newBtn = document.createElement('button');
    newBtn.className = 'tab-add';
    newBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    newBtn.onclick = () => window.tabs.create(true);
    container.appendChild(newBtn);
  };

  window.tabs.updateAddressBar = function() {
    const bar = document.getElementById('addressBar');
    const tab = window.tabs.getActive();
    if (bar && tab) {
      bar.value = (tab.url && !tab.url.includes('NT.html')) ? tab.url : '';
    }
  };

  window.tabs.updateLoadingBar = function(percent) {
    const bar = document.getElementById('loadingBar');
    bar.style.width = percent + '%';
    bar.style.opacity = (percent === 100) ? '0' : '1';
    if (percent === 100) setTimeout(() => { bar.style.width = '0%'; }, 200);
  };

  window.tabs.navigate = function(url) {
    const tab = window.tabs.getActive();
    if (!tab) return;
    if (!url.startsWith('http')) {
      url = url.includes('.') && !url.includes(' ') ? `https://${url}` :
        `https://search.brave.com/search?q=${encodeURIComponent(url)}`;
    }
    tab.loading = true;
    window.tabs.updateLoadingBar(10);
    tab.frame.go(url);
    document.getElementById('brandCol').classList.add('hidden');
  };

  window.navigateTo = window.tabs.navigate;
})();
