/**
 * scoring.js — Calcul de la PERTINENCE et de l'URGENCE d'un article.
 *
 * Deux axes indépendants, comme demandé :
 *   - pertinence : qualité/adéquation de l'info au thème (0 à 100)
 *   - urgence    : priorité de lecture, surtout liée à la fraîcheur (0 à 100)
 *
 * Aucune IA, aucun service payant : tout est calculé localement par règles.
 * C'est volontairement simple et lisible pour rester maintenable et gratuit.
 */

// Mots qui signalent une actualité « chaude » → augmentent l'urgence.
const URGENCY_KEYWORDS = [
  'urgent', 'alerte', 'breaking', 'décret', 'loi', 'vote', 'grève',
  'manifestation', 'rentrée', 'réforme', 'décision', 'tribunal', 'jugement',
  'aujourd', 'ce matin', 'annonce', 'communiqué', 'pétition', 'date limite',
  'inscription', 'échéance', 'deadline'
];

/** Normalise un texte : minuscules + suppression des accents pour matcher large. */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Compte les occurrences (souples) d'un mot-clé dans un texte normalisé. */
function countMatches(haystack, keyword) {
  const k = normalize(keyword);
  if (!k) return 0;
  let count = 0;
  let idx = haystack.indexOf(k);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(k, idx + k.length);
  }
  return count;
}

/**
 * Détermine le meilleur thème pour un article et son score de correspondance.
 * Le titre pèse davantage que le résumé.
 * @returns {{ themeId: string|null, keywordScore: number, matched: string[] }}
 */
function classify(article, themes, defaultTheme) {
  const title = normalize(article.title);
  const body = normalize(article.summary);

  let best = { themeId: defaultTheme || null, keywordScore: 0, matched: [] };

  for (const theme of themes) {
    let score = 0;
    const matched = [];
    for (const kw of theme.keywords) {
      const inTitle = countMatches(title, kw);
      const inBody = countMatches(body, kw);
      if (inTitle || inBody) matched.push(kw);
      score += inTitle * 3 + inBody * 1; // le titre compte triple
    }
    if (score > best.keywordScore) {
      best = { themeId: theme.id, keywordScore: score, matched };
    }
  }

  // Si rien ne matche mais qu'une source a un thème par défaut, on le garde
  // avec un petit score plancher pour ne pas écarter l'article.
  if (best.keywordScore === 0 && defaultTheme) {
    best = { themeId: defaultTheme, keywordScore: 0.5, matched: [] };
  }
  return best;
}

/**
 * Score de PERTINENCE (0-100).
 * Combine : correspondance aux mots-clés du thème + poids de la source
 *           + petit bonus si l'article a un visuel + bonus longueur de résumé.
 */
function relevanceScore({ keywordScore, sourceWeight, hasImage, summaryLength }) {
  // Saturation douce des mots-clés : log pour éviter qu'un article bourré de
  // mots-clés écrase tout le reste.
  const kw = Math.min(1, Math.log10(1 + keywordScore) / Math.log10(13)); // ~0..1
  const weight = Math.min(1, Math.max(0.1, sourceWeight) / 2);            // 0.05..1
  const imageBonus = hasImage ? 0.08 : 0;
  const lengthBonus = Math.min(0.07, (summaryLength || 0) / 4000);

  let score = (kw * 0.62 + weight * 0.38 + imageBonus + lengthBonus) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Score d'URGENCE (0-100).
 * Surtout piloté par la fraîcheur (décroissance exponentielle sur ~5 jours),
 * relevé par la présence de mots signalant une échéance/actualité chaude.
 */
function urgencyScore({ publishedAt, title, summary }) {
  const now = Date.now();
  const ts = publishedAt ? new Date(publishedAt).getTime() : now;
  const ageHours = Math.max(0, (now - ts) / 36e5);

  // Fraîcheur : 100 à H+0, ~50 à H+48, proche de 0 après ~5 jours.
  const freshness = 100 * Math.exp(-ageHours / 70);

  const text = normalize(`${title} ${summary}`);
  let hits = 0;
  for (const kw of URGENCY_KEYWORDS) if (countMatches(text, kw)) hits++;
  const urgencyBoost = Math.min(30, hits * 10);

  return Math.round(Math.max(0, Math.min(100, freshness * 0.8 + urgencyBoost)));
}

/** Convertit un score numérique en niveau lisible pour l'affichage. */
function toLevel(score) {
  if (score >= 70) return 'haute';
  if (score >= 40) return 'moyenne';
  return 'basse';
}

module.exports = {
  classify,
  relevanceScore,
  urgencyScore,
  toLevel,
  normalize,
};
