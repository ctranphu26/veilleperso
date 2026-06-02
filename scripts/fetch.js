/**
 * fetch.js — Le « robot » de veille.
 *
 * Exécuté automatiquement par GitHub Actions (voir .github/workflows/veille.yml).
 * 1. lit config/sources.json + config/themes.json
 * 2. récupère chaque flux RSS/Atom activé
 * 3. extrait titre, lien, date, résumé, image
 * 4. calcule pertinence + urgence (scripts/scoring.js)
 * 5. déduplique, trie, et écrit docs/data/feed.json
 *
 * Robuste par conception : une source en panne n'interrompt jamais le reste.
 */

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const {
  classify, relevanceScore, urgencyScore, toLevel,
} = require('./scoring');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_PATH = path.join(ROOT, 'config', 'sources.json');
const THEMES_PATH = path.join(ROOT, 'config', 'themes.json');
const OUT_PATH = path.join(ROOT, 'docs', 'data', 'feed.json');

const MAX_ITEMS_PER_SOURCE = 25; // évite qu'une source bavarde noie les autres
const MAX_TOTAL_ITEMS = 400;     // garde feed.json léger pour un chargement rapide
const SUMMARY_MAX = 320;         // longueur du chapô affiché

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'VeilleBot/1.0 (+github-actions)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
      ['enclosure', 'enclosure'],
    ],
  },
});

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/** Retire les balises HTML et compresse les espaces. */
function stripHtml(html) {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tente d'extraire une image depuis les multiples conventions RSS/Atom. */
function extractImage(item) {
  if (item.enclosure && /image/i.test(item.enclosure.type || '') && item.enclosure.url) {
    return item.enclosure.url;
  }
  if (Array.isArray(item.mediaContent)) {
    for (const m of item.mediaContent) {
      const url = m && m.$ && m.$.url;
      if (url && /\.(jpe?g|png|webp|gif)/i.test(url)) return url;
    }
  }
  if (Array.isArray(item.mediaThumbnail) && item.mediaThumbnail[0] && item.mediaThumbnail[0].$) {
    return item.mediaThumbnail[0].$.url;
  }
  // Dernier recours : première <img> trouvée dans le contenu HTML.
  const html = item.contentEncoded || item['content:encoded'] || item.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  return null;
}

function makeId(link, title) {
  const base = (link || title || '').slice(0, 200);
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return 'a' + Math.abs(h).toString(36);
}

async function fetchSource(source, themes) {
  const items = [];
  try {
    const feed = await parser.parseURL(source.url);
    const entries = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE);
    for (const item of entries) {
      const title = (item.title || '').trim();
      if (!title) continue;

      const rawSummary = item.contentSnippet || item.summary || item.content
        || item.contentEncoded || '';
      const summary = stripHtml(rawSummary).slice(0, SUMMARY_MAX);
      const link = item.link || item.guid || '';
      const publishedAt = item.isoDate || item.pubDate || null;
      const image = extractImage(item);

      const cls = classify({ title, summary }, themes, source.defaultTheme);
      const relevance = relevanceScore({
        keywordScore: cls.keywordScore,
        sourceWeight: source.weight,
        hasImage: !!image,
        summaryLength: summary.length,
      });
      const urgency = urgencyScore({ publishedAt, title, summary });

      items.push({
        id: makeId(link, title),
        title,
        summary,
        link,
        image,
        publishedAt,
        source: source.name,
        sourceId: source.id,
        themeId: cls.themeId,
        keywords: cls.matched.slice(0, 6),
        relevance,
        relevanceLevel: toLevel(relevance),
        urgency,
        urgencyLevel: toLevel(urgency),
      });
    }
    console.log(`✓ ${source.name} : ${items.length} articles`);
  } catch (err) {
    console.warn(`✗ ${source.name} : ${err.message}`);
  }
  return items;
}

async function main() {
  const { sources } = readJson(SOURCES_PATH);
  const { themes } = readJson(THEMES_PATH);
  const active = sources.filter((s) => s.enabled !== false);

  console.log(`Démarrage de la veille — ${active.length} sources actives`);

  const results = await Promise.all(active.map((s) => fetchSource(s, themes)));
  let all = results.flat();

  // Déduplication par id (même lien/titre).
  const seen = new Set();
  all = all.filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));

  // Tri par défaut : urgence puis pertinence (l'UI peut re-trier ensuite).
  all.sort((a, b) => (b.urgency - a.urgency) || (b.relevance - a.relevance));
  all = all.slice(0, MAX_TOTAL_ITEMS);

  const payload = {
    generatedAt: new Date().toISOString(),
    themes,
    sources: sources.map((s) => ({
      id: s.id, name: s.name, weight: s.weight, enabled: s.enabled !== false,
    })),
    count: all.length,
    items: all,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\nÉcrit ${all.length} articles → ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
