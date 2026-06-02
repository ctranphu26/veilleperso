/* app.js — Consultation : charge feed.json, gère filtres / tri / recherche. */

(() => {
  const state = {
    items: [],
    themes: [],
    activeTheme: 'all',   // 'all' ou id de thème
    sort: 'urgency',      // urgency | relevance | date
    query: '',
  };

  const el = {
    grid: document.getElementById('grid'),
    lede: document.getElementById('lede'),
    empty: document.getElementById('empty'),
    themesFilter: document.getElementById('themes-filter'),
    sortSeg: document.getElementById('sort-seg'),
    search: document.getElementById('search'),
    count: document.getElementById('result-count'),
    footerCount: document.getElementById('footer-count'),
    editionDate: document.getElementById('edition-date'),
    generatedAt: document.getElementById('generated-at'),
  };

  async function load() {
    el.editionDate.textContent = new Date().toLocaleDateString('fr-BE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    try {
      const res = await fetch(`data/feed.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.items = data.items || [];
      state.themes = data.themes || [];
      Render.setThemes(state.themes);
      if (data.generatedAt) {
        el.generatedAt.textContent = 'Mise à jour : ' + new Date(data.generatedAt)
          .toLocaleString('fr-BE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      }
      buildThemeChips();
      render();
    } catch (e) {
      el.grid.innerHTML = '';
      el.empty.hidden = false;
      el.empty.querySelector('h3').textContent = 'Veille pas encore générée';
      el.empty.querySelector('p').innerHTML =
        "Le robot n'a pas encore produit de données. Lance le workflow « Veille RSS » dans l'onglet Actions de GitHub, ou consulte la <a href='admin.html' style='color:var(--accent)'>page de gestion</a>.";
    }
  }

  function buildThemeChips() {
    const chips = [{ id: 'all', label: 'Tout', color: 'var(--ink)' }]
      .concat([...state.themes].sort((a, b) => (a.order || 0) - (b.order || 0)));
    el.themesFilter.innerHTML = chips.map((t) => `
      <button class="chip" data-theme="${t.id}" style="--theme:${t.color || 'var(--ink)'}"
              aria-pressed="${t.id === state.activeTheme}">${t.label}</button>`).join('');
    el.themesFilter.querySelectorAll('.chip').forEach((b) => {
      b.addEventListener('click', () => {
        state.activeTheme = b.dataset.theme;
        el.themesFilter.querySelectorAll('.chip').forEach((x) =>
          x.setAttribute('aria-pressed', x === b));
        render();
      });
    });
  }

  function filtered() {
    let items = state.items.slice();
    if (state.activeTheme !== 'all') {
      items = items.filter((i) => i.themeId === state.activeTheme);
    }
    if (state.query) {
      const q = state.query.toLowerCase();
      items = items.filter((i) =>
        (i.title + ' ' + i.summary + ' ' + i.source).toLowerCase().includes(q));
    }
    const cmp = {
      urgency: (a, b) => (b.urgency - a.urgency) || (b.relevance - a.relevance),
      relevance: (a, b) => (b.relevance - a.relevance) || (b.urgency - a.urgency),
      date: (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
    }[state.sort];
    return items.sort(cmp);
  }

  function render() {
    const items = filtered();
    el.count.textContent = items.length ? `${items.length} articles` : '';
    el.footerCount.textContent = state.items.length;

    if (!items.length) {
      el.lede.hidden = true; el.grid.innerHTML = ''; el.empty.hidden = false;
      return;
    }
    el.empty.hidden = true;

    // À la une : meilleur compromis urgence + pertinence, hors recherche active.
    let rest = items;
    if (!state.query && items.length > 4) {
      const top = [...items].sort((a, b) =>
        (b.urgency + b.relevance) - (a.urgency + a.relevance))[0];
      el.lede.hidden = false;
      el.lede.innerHTML = Render.lede(top);
      rest = items.filter((i) => i.id !== top.id);
    } else {
      el.lede.hidden = true;
    }

    el.grid.innerHTML = rest
      .map((it, idx) => Render.card(it, Math.min(idx, 12) * 28))
      .join('');
  }

  el.sortSeg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      state.sort = b.dataset.sort;
      el.sortSeg.querySelectorAll('button').forEach((x) =>
        x.setAttribute('aria-pressed', x === b));
      render();
    });
  });

  let t;
  el.search.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = e.target.value.trim(); render(); }, 160);
  });

  load();
})();
