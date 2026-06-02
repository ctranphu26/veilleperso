/* github.js — Persiste la config dans le dépôt via l'API GitHub.
 *
 * Aucun serveur : un jeton personnel (PAT) stocké UNIQUEMENT dans le
 * navigateur (localStorage) autorise l'écriture de config/*.json.
 * Le jeton n'est jamais committé ni envoyé ailleurs que vers api.github.com.
 */

const GitHubStore = (() => {
  const LS_KEY = 'veille.github';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch { return {}; }
  }
  function setConfig(cfg) {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }
  function isConnected() {
    const c = getConfig();
    return !!(c.token && c.owner && c.repo);
  }
  function clear() { localStorage.removeItem(LS_KEY); }

  function headers() {
    const { token } = getConfig();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
  }

  /** Vérifie le jeton + l'accès au dépôt. */
  async function verify() {
    const { owner, repo } = getConfig();
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: headers() });
    if (r.status === 401) throw new Error('Jeton invalide ou expiré.');
    if (r.status === 404) throw new Error('Dépôt introuvable ou jeton sans accès à ce dépôt.');
    if (!r.ok) throw new Error('Erreur GitHub : ' + r.status);
    const data = await r.json();
    return { fullName: data.full_name, private: data.private, branch: data.default_branch };
  }

  /** Lit un fichier JSON du dépôt. Retourne { json, sha } (sha requis pour réécrire). */
  async function getJson(path) {
    const { owner, repo, branch } = getConfig();
    const ref = branch ? `?ref=${branch}` : '';
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref}`,
      { headers: headers() });
    if (r.status === 404) return { json: null, sha: null };
    if (!r.ok) throw new Error('Lecture impossible : ' + r.status);
    const data = await r.json();
    return { json: JSON.parse(b64decode(data.content)), sha: data.sha };
  }

  /** Écrit (crée ou met à jour) un fichier JSON. */
  async function putJson(path, obj, sha, message) {
    const { owner, repo, branch } = getConfig();
    const body = {
      message: message || `Veille: maj ${path}`,
      content: b64encode(JSON.stringify(obj, null, 2) + '\n'),
    };
    if (sha) body.sha = sha;
    if (branch) body.branch = branch;
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('Écriture impossible : ' + (e.message || r.status));
    }
    const data = await r.json();
    return data.content.sha; // nouveau sha
  }

  return { getConfig, setConfig, isConnected, clear, verify, getJson, putJson };
})();
