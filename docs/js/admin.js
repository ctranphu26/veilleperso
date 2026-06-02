/* admin.js — Interface de gestion. CRUD sources & thèmes, persistés sur GitHub. */

(() => {
  const SOURCES_PATH = 'config/sources.json';
  const THEMES_PATH = 'config/themes.json';
  // Relais CORS public pour TESTER un flux depuis le navigateur (indicatif).
  const PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

  const store = {
    sources: null, sourcesSha: null, sourcesMeta: null,
    themes: null, themesSha: null, themesMeta: null,
  };

  const $ = (id) => document.getElementById(id);
  const show = (id, on = true) => { $(id).hidden = !on; };

  /* ---------- Onglets ---------- */
  function activateTab(tab) {
    document.querySelectorAll('#tabs a').forEach((a) =>
      a.classList.toggle('active', a.dataset.tab === tab));
    ['connexion', 'sources', 'themes', 'trouver'].forEach((t) =>
      show('panel-' + t, t === tab));
  }
  document.querySelectorAll('#tabs a').forEach((a) =>
    a.addEventListener('click', (e) => { e.preventDefault(); activateTab(a.dataset.tab); }));

  /* ---------- Connexion ---------- */
  function fillConnForm() {
    const c = GitHubStore.getConfig();
    $('gh-owner').value = c.owner || '';
    $('gh-repo').value = c.repo || '';
    $('gh-branch').value = c.branch || 'main';
    $('gh-token').value = c.token || '';
  }
  function setStatus(id, msg, kind = 'muted') {
    const e = $(id); e.className = 'status ' + kind; e.innerHTML = msg; e.hidden = false;
  }

  async function connect() {
    GitHubStore.setConfig({
      owner: $('gh-owner').value.trim(),
      repo: $('gh-repo').value.trim(),
      branch: $('gh-branch').value.trim() || 'main',
      token: $('gh-token').value.trim(),
    });
    if (!GitHubStore.isConnected()) {
      setStatus('conn-status', 'Renseigne owner, repo et jeton.', 'err'); return;
    }
    setStatus('conn-status', 'Vérification…', 'muted');
    try {
      const info = await GitHubStore.verify();
      setStatus('conn-status',
        `Connecté à <strong>${info.fullName}</strong> (branche ${info.branch})${info.private ? ' · dépôt privé' : ''}.`,
        'ok');
      await loadAll();
      activateTab('sources');
    } catch (e) {
      setStatus('conn-status', e.message, 'err');
    }
  }
  $('btn-connect').addEventListener('click', connect);
  $('btn-disconnect').addEventListener('click', () => {
    GitHubStore.clear(); fillConnForm();
    setStatus('conn-status', 'Déconnecté.', 'muted');
    store.sources = store.themes = null;
    activateTab('connexion');
  });

  /* ---------- Chargement config ---------- */
  async function loadAll() {
    try {
      const s = await GitHubStore.getJson(SOURCES_PATH);
      store.sources = (s.json && s.json.sources) || [];
      store.sourcesSha = s.sha;
      store.sourcesMeta = s.json || { sources: [] };
      const t = await GitHubStore.getJson(THEMES_PATH);
      store.themes = (t.json && t.json.themes) || [];
      store.themesSha = t.sha;
      store.themesMeta = t.json || { themes: [] };
      renderSources(); renderThemes();
    } catch (e) {
      setStatus('sources-status', e.message, 'err');
    }
  }

  /* ---------- SOURCES ---------- */
  function renderSources() {
    if (!store.sources) return;
    setStatus('sources-status',
      `${store.sources.length} source(s). Les modifications sont enregistrées dans <strong>${SOURCES_PATH}</strong>.`,
      'muted');
    const themeName = (id) => {
      const t = (store.themes || []).find((x) => x.id === id);
      return t ? t.label : '—';
    };
    $('sources-list').innerHTML = store.sources.map((s, i) => `
      <div class="list-item ${s.enabled === false ? 'tag-off' : ''}">
        <div class="li-main">
          <div class="li-title">${escapeHtml(s.name)}
            <span class="pill ${s.enabled === false ? 'off' : 'on'}">${s.enabled === false ? 'inactive' : 'active'}</span>
          </div>
          <div class="li-sub">${escapeHtml(s.url)} · poids ${s.weight} · ${escapeHtml(themeName(s.defaultTheme))}</div>
        </div>
        <div class="li-actions">
          <button class="btn ghost sm" data-edit-source="${i}">Modifier</button>
          <button class="btn danger sm" data-del-source="${i}">Suppr.</button>
        </div>
      </div>`).join('') || '<p style="color:var(--ink-faint)">Aucune source.</p>';

    $('sources-list').querySelectorAll('[data-edit-source]').forEach((b) =>
      b.addEventListener('click', () => openSource(+b.dataset.editSource)));
    $('sources-list').querySelectorAll('[data-del-source]').forEach((b) =>
      b.addEventListener('click', () => delSource(+b.dataset.delSource)));
  }

  function fillThemeSelect(sel, selectedId) {
    sel.innerHTML = (store.themes || []).map((t) =>
      `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('');
  }

  function openSource(index) {
    const isNew = index == null;
    const s = isNew ? { name: '', url: '', weight: 1, defaultTheme: (store.themes[0] || {}).id, enabled: true }
      : store.sources[index];
    $('modal-source-title').textContent = isNew ? 'Nouvelle source' : 'Modifier la source';
    $('src-id').value = isNew ? '' : index;
    $('src-name').value = s.name; $('src-url').value = s.url;
    $('src-weight').value = s.weight; $('src-weight-val').textContent = (+s.weight).toFixed(1);
    $('src-enabled').value = String(s.enabled !== false);
    fillThemeSelect($('src-theme'), s.defaultTheme);
    $('test-feed-result').textContent = '';
    openModal('modal-source');
  }
  $('src-weight').addEventListener('input', (e) =>
    $('src-weight-val').textContent = (+e.target.value).toFixed(1));
  $('btn-add-source').addEventListener('click', () => openSource(null));

  async function saveSource() {
    const idx = $('src-id').value;
    const name = $('src-name').value.trim();
    const url = $('src-url').value.trim();
    if (!name || !url) { alert('Nom et URL obligatoires.'); return; }
    const obj = {
      id: idx === '' ? slug(name) + '-' + Math.random().toString(36).slice(2, 6)
        : store.sources[+idx].id,
      name, url,
      weight: parseFloat($('src-weight').value),
      defaultTheme: $('src-theme').value,
      enabled: $('src-enabled').value === 'true',
    };
    if (idx === '') store.sources.push(obj); else store.sources[+idx] = obj;
    await persistSources('Veille: maj source « ' + name + ' »');
    closeModal('modal-source'); renderSources();
  }
  $('btn-save-source').addEventListener('click', saveSource);

  async function delSource(index) {
    const s = store.sources[index];
    if (!confirm(`Supprimer « ${s.name} » ?`)) return;
    store.sources.splice(index, 1);
    await persistSources('Veille: suppression source « ' + s.name + ' »');
    renderSources();
  }

  async function persistSources(message) {
    store.sourcesMeta.sources = store.sources;
    try {
      store.sourcesSha = await GitHubStore.putJson(SOURCES_PATH, store.sourcesMeta, store.sourcesSha, message);
      setStatus('sources-status', '✓ Enregistré sur GitHub. Effet au prochain passage du robot (ou lance-le manuellement dans Actions).', 'ok');
    } catch (e) { setStatus('sources-status', e.message, 'err'); }
  }

  /* ---------- Test de flux ---------- */
  $('btn-test-feed').addEventListener('click', async () => {
    const url = $('src-url').value.trim();
    const out = $('test-feed-result');
    if (!url) { out.textContent = 'Renseigne une URL.'; return; }
    out.innerHTML = '<span style="color:var(--ink-faint)">Test en cours…</span>';
    try {
      const r = await fetch(PROXY(url));
      const text = await r.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const items = xml.querySelectorAll('item, entry');
      if (items.length) {
        const first = items[0].querySelector('title');
        out.innerHTML = `<span style="color:#1f5128">✓ ${items.length} entrées — ex. « ${escapeHtml((first && first.textContent || '').slice(0, 60))} »</span>`;
      } else {
        out.innerHTML = '<span style="color:var(--accent-deep)">Aucune entrée détectée (flux invalide ou bloqué). Le robot reste seul juge au final.</span>';
      }
    } catch (e) {
      out.innerHTML = '<span style="color:var(--accent-deep)">Test impossible depuis le navigateur (CORS/relais). Vérifie au prochain passage du robot.</span>';
    }
  });

  /* ---------- THEMES ---------- */
  function renderThemes() {
    if (!store.themes) return;
    setStatus('themes-status',
      `${store.themes.length} thématique(s). Enregistrées dans <strong>${THEMES_PATH}</strong>.`, 'muted');
    const sorted = [...store.themes].sort((a, b) => (a.order || 0) - (b.order || 0));
    $('themes-list').innerHTML = sorted.map((t) => {
      const i = store.themes.indexOf(t);
      return `<div class="list-item">
        <span class="swatch" style="background:${t.color || '#000'}"></span>
        <div class="li-main">
          <div class="li-title">${escapeHtml(t.label)}</div>
          <div class="li-sub">${(t.keywords || []).length} mots-clés · ${escapeHtml(t.kicker || '')}</div>
        </div>
        <div class="li-actions">
          <button class="btn ghost sm" data-edit-theme="${i}">Modifier</button>
          <button class="btn danger sm" data-del-theme="${i}">Suppr.</button>
        </div>
      </div>`;
    }).join('') || '<p style="color:var(--ink-faint)">Aucune thématique.</p>';

    $('themes-list').querySelectorAll('[data-edit-theme]').forEach((b) =>
      b.addEventListener('click', () => openTheme(+b.dataset.editTheme)));
    $('themes-list').querySelectorAll('[data-del-theme]').forEach((b) =>
      b.addEventListener('click', () => delTheme(+b.dataset.delTheme)));
  }

  function openTheme(index) {
    const isNew = index == null;
    const t = isNew ? { label: '', kicker: '', color: '#C8472E', order: (store.themes.length + 1), keywords: [] }
      : store.themes[index];
    $('modal-theme-title').textContent = isNew ? 'Nouvelle thématique' : 'Modifier la thématique';
    $('th-id').value = isNew ? '' : index;
    $('th-label').value = t.label; $('th-kicker').value = t.kicker || '';
    $('th-color').value = t.color || '#C8472E'; $('th-order').value = t.order || 1;
    $('th-keywords').value = (t.keywords || []).join('\n');
    openModal('modal-theme');
  }
  $('btn-add-theme').addEventListener('click', () => openTheme(null));

  async function saveTheme() {
    const idx = $('th-id').value;
    const label = $('th-label').value.trim();
    if (!label) { alert('Le libellé est obligatoire.'); return; }
    const keywords = $('th-keywords').value
      .split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
    const obj = {
      id: idx === '' ? slug(label) : store.themes[+idx].id,
      label, kicker: $('th-kicker').value.trim(),
      color: $('th-color').value, order: parseInt($('th-order').value, 10) || 1,
      keywords,
    };
    if (idx === '') store.themes.push(obj); else store.themes[+idx] = obj;
    await persistThemes('Veille: maj thème « ' + label + ' »');
    closeModal('modal-theme'); renderThemes(); renderSources();
  }
  $('btn-save-theme').addEventListener('click', saveTheme);

  async function delTheme(index) {
    const t = store.themes[index];
    if (!confirm(`Supprimer la thématique « ${t.label} » ?`)) return;
    store.themes.splice(index, 1);
    await persistThemes('Veille: suppression thème « ' + t.label + ' »');
    renderThemes();
  }

  async function persistThemes(message) {
    store.themesMeta.themes = store.themes;
    try {
      store.themesSha = await GitHubStore.putJson(THEMES_PATH, store.themesMeta, store.themesSha, message);
      setStatus('themes-status', '✓ Enregistré sur GitHub. Effet au prochain passage du robot.', 'ok');
    } catch (e) { setStatus('themes-status', e.message, 'err'); }
  }

  /* ---------- Trouver des sources ---------- */
  $('btn-discover').addEventListener('click', async () => {
    let base = $('discover-url').value.trim();
    if (!base) return;
    if (!/^https?:\/\//.test(base)) base = 'https://' + base;
    base = base.replace(/\/+$/, '');
    const candidates = ['/feed', '/feed/', '/rss', '/rss.xml', '/atom.xml',
      '/feed.xml', '/index.xml', '/?feed=rss2', '/blog/feed'];
    setStatus('discover-status', 'Recherche…', 'muted');
    $('discover-list').innerHTML = '';
    const found = [];
    for (const path of candidates) {
      const url = base + path;
      try {
        const r = await fetch(PROXY(url));
        if (!r.ok) continue;
        const text = await r.text();
        const xml = new DOMParser().parseFromString(text, 'text/xml');
        const items = xml.querySelectorAll('item, entry');
        if (items.length) {
          const titleEl = xml.querySelector('channel > title, feed > title');
          found.push({ url, count: items.length, title: titleEl ? titleEl.textContent.trim() : url });
        }
      } catch (e) { /* on ignore, relais ou CORS */ }
    }
    if (!found.length) {
      setStatus('discover-status', 'Aucun flux trouvé automatiquement. Cherche « RSS » sur le site, ou ajoute l\'URL manuellement dans Sources.', 'warn');
      return;
    }
    setStatus('discover-status', `${found.length} flux candidat(s) trouvé(s) :`, 'ok');
    $('discover-list').innerHTML = found.map((f) => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${escapeHtml(f.title)}</div>
          <div class="li-sub">${escapeHtml(f.url)} · ${f.count} entrées</div>
        </div>
        <div class="li-actions">
          <button class="btn sm" data-add-found="${escapeHtml(f.url)}" data-title="${escapeHtml(f.title)}">Ajouter</button>
        </div>
      </div>`).join('');
    $('discover-list').querySelectorAll('[data-add-found]').forEach((b) =>
      b.addEventListener('click', () => {
        activateTab('sources'); openSource(null);
        $('src-url').value = b.dataset.addFound;
        $('src-name').value = b.dataset.title;
      }));
  });

  /* ---------- Modales ---------- */
  function openModal(id) { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => b.closest('.modal-backdrop').classList.remove('open')));
  document.querySelectorAll('.modal-backdrop').forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }));

  /* ---------- Utilitaires ---------- */
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function slug(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  }

  /* ---------- Démarrage ---------- */
  fillConnForm();
  if (GitHubStore.isConnected()) {
    setStatus('conn-status', 'Reconnexion automatique…', 'muted');
    GitHubStore.verify()
      .then((info) => {
        setStatus('conn-status', `Connecté à <strong>${info.fullName}</strong> (branche ${info.branch}).`, 'ok');
        return loadAll();
      })
      .then(() => activateTab('sources'))
      .catch((e) => setStatus('conn-status', 'Reconnexion échouée : ' + e.message, 'err'));
  }
})();
