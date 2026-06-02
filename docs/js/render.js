/* render.js — Fabrique le HTML des articles. Aucune dépendance. */

const Render = (() => {
  const themeMap = {};

  function setThemes(themes) {
    (themes || []).forEach((t) => { themeMap[t.id] = t; });
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function relTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `il y a ${Math.max(1, Math.round(diff / 60))} min`;
    if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`;
    if (diff < 604800) return `il y a ${Math.round(diff / 86400)} j`;
    return d.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' });
  }

  function themeLabel(id) {
    const t = themeMap[id];
    return t ? t.label : 'Divers';
  }
  function themeKicker(id) {
    const t = themeMap[id];
    return t ? (t.kicker || t.label) : 'Divers';
  }
  function themeColor(id) {
    const t = themeMap[id];
    return t ? t.color : 'var(--ink)';
  }

  function scoreBadge(kind, level, value) {
    const label = kind === 'rel' ? 'Pert.' : 'Urg.';
    return `<span class="score ${level}" title="${kind === 'rel' ? 'Pertinence' : 'Urgence'} : ${value}/100">
      <span class="pip"></span><span class="lbl">${label}</span></span>`;
  }

  function mediaBlock(item, big) {
    if (item.image) {
      return `<div class="${big ? 'lede-media' : 'card-media'}">
        <img src="${escapeHtml(item.image)}" alt="" loading="lazy"
             onerror="this.parentNode.classList.add('empty');this.remove();this.parentNode.innerHTML='<span>¶</span>'"></div>`;
    }
    return `<div class="${big ? 'lede-media' : 'card-media'} empty"><span>¶</span></div>`;
  }

  function card(item, delay = 0) {
    const color = themeColor(item.themeId);
    const flag = item.urgencyLevel === 'haute'
      ? '<span class="urgency-flag">À lire en priorité</span>' : '';
    return `<article class="card" style="--theme:${color};animation-delay:${delay}ms">
      ${flag}
      ${mediaBlock(item, false)}
      <div class="card-body">
        <span class="kicker" style="--theme:${color}">${escapeHtml(themeKicker(item.themeId))}</span>
        <h3 class="card-title"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
        <p class="card-summary">${escapeHtml(item.summary)}</p>
        <div class="card-meta">
          <span class="source" title="${escapeHtml(item.source)} · ${relTime(item.publishedAt)}">${escapeHtml(item.source)} · ${relTime(item.publishedAt)}</span>
          <span class="scores">
            ${scoreBadge('rel', item.relevanceLevel, item.relevance)}
            ${scoreBadge('urg', item.urgencyLevel, item.urgency)}
          </span>
        </div>
      </div>
    </article>`;
  }

  function lede(item) {
    const color = themeColor(item.themeId);
    return `<a class="lede-card" href="${escapeHtml(item.link)}" target="_blank" rel="noopener"
              style="--theme:${color};text-decoration:none;color:inherit">
      ${mediaBlock(item, true)}
      <div class="lede-body">
        <span class="kicker" style="--theme:${color}">À la une — ${escapeHtml(themeLabel(item.themeId))}</span>
        <h2 class="lede-title">${escapeHtml(item.title)}</h2>
        <p class="lede-summary">${escapeHtml(item.summary)}</p>
        <div class="card-meta" style="border:0;padding:0">
          <span class="source">${escapeHtml(item.source)} · ${relTime(item.publishedAt)}</span>
          <span class="scores">
            ${scoreBadge('rel', item.relevanceLevel, item.relevance)}
            ${scoreBadge('urg', item.urgencyLevel, item.urgency)}
          </span>
        </div>
      </div>
    </a>`;
  }

  return { setThemes, card, lede, relTime, themeColor, themeLabel };
})();
