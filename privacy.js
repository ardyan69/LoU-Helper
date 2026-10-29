// privacy.html: English / Bahasa Indonesia switch (?lang=id, else the browser language)
(() => {
  const set = (l) => { document.body.className = l; document.documentElement.lang = l; };
  const q = new URLSearchParams(location.search).get('lang');
  set(q === 'id' || q === 'en' ? q : /^id\b/i.test(navigator.language || '') ? 'id' : 'en');
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-set]'); if (b) set(b.dataset.set); });
})();
