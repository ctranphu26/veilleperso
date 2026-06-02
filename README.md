# La Veille — Barbaria

Veille informationnelle sur **l'éducation aux médias**, **l'enseignement** et **l'inclusion**.
Application entièrement **gratuite**, **sans serveur** et **autonome** : un robot va chercher les
flux RSS tout seul à intervalles réguliers, et le site n'est que des fichiers statiques.

---

## 1. Comment ça marche (l'architecture en une image)

```
        ┌─────────────────────────────────────────────────────────┐
        │  GitHub Actions (cron, toutes les 6 h) — GRATUIT          │
        │  scripts/fetch.js                                         │
        │   1. lit config/sources.json + config/themes.json         │
        │   2. récupère les flux RSS                                 │
        │   3. calcule pertinence + urgence (scripts/scoring.js)     │
        │   4. écrit docs/data/feed.json  ──┐                        │
        └───────────────────────────────────┼──────────────────────┘
                                             │ commit automatique
                                             ▼
        ┌─────────────────────────────────────────────────────────┐
        │  GitHub Pages — site statique GRATUIT                     │
        │  docs/index.html   → Interface 1 : consultation           │
        │  docs/admin.html   → Interface 2 : gestion                │
        │       (lit/écrit config/*.json via l'API GitHub +         │
        │        un jeton stocké dans le navigateur)                │
        └─────────────────────────────────────────────────────────┘
```

Il n'y a **aucune base de données** et **aucun serveur** : la « base » est le fichier
`docs/data/feed.json`, régénéré à chaque passage du robot. Rien à entretenir, rien qui tombe en panne tout seul.

## 2. Technologies (et pourquoi)

| Brique | Choix | Pourquoi |
|---|---|---|
| Robot RSS | **GitHub Actions** (Node 20) | tâche planifiée gratuite, zéro serveur |
| Récupération RSS | **rss-parser** | gère RSS et Atom, extraction d'images |
| Stockage | **fichiers JSON** dans le dépôt | gratuit, versionné, simple |
| Site | **HTML/CSS/JS pur** (pas de build) | rien ne casse, rien à recompiler |
| Hébergement | **GitHub Pages** | gratuit, intégré au dépôt |
| Gestion | **API GitHub** + jeton local | persiste les réglages sans serveur |

Le choix du « tout statique sans étape de build » est délibéré : c'est ce qui rend l'app
**maintenable sans personne aux commandes**. Aucune dépendance frontend à mettre à jour.

## 3. Déploiement (≈ 15 min, une seule fois)

1. **Crée un dépôt GitHub** (public, pour bénéficier de Pages gratuitement), p. ex. `veille`.
2. **Dépose le contenu de ce dossier** à la racine du dépôt (glisser-déposer sur github.com,
   ou `git push`). L'arborescence doit rester :
   ```
   .github/workflows/veille.yml
   config/sources.json
   config/themes.json
   scripts/…
   docs/…            ← c'est ce dossier qui est publié
   ```
3. **Active GitHub Pages** : `Settings → Pages → Build and deployment → Deploy from a branch`,
   branche `main`, dossier **`/docs`**. Le site sera à
   `https://TON-COMPTE.github.io/veille/`.
4. **Lance le robot une première fois** : onglet `Actions → Veille RSS → Run workflow`.
   Au bout d'une minute, `docs/data/feed.json` est rempli et le site affiche la veille.
5. **Vérifie les permissions du robot** : `Settings → Actions → General → Workflow permissions`
   → coche **Read and write permissions** (pour qu'il puisse committer les résultats).

C'est tout. Ensuite, le robot tourne **tout seul toutes les 6 heures**.

## 4. Régler la fréquence

Dans `.github/workflows/veille.yml`, ligne `cron`. Exemples :
- `'0 */6 * * *'` → toutes les 6 h (par défaut)
- `'0 6,18 * * *'` → 2× par jour (6 h et 18 h UTC)
- `'0 5 * * *'` → 1× par jour à 5 h UTC

## 5. Maintenance

Quasi nulle. Les seuls points d'attention :
- **Une source qui change d'URL** : le robot l'ignore sans planter ; corrige l'URL dans la page de gestion.
- **GitHub Actions** met parfois en pause les workflows planifiés d'un dépôt **sans activité depuis 60 jours**.
  Un simple commit (ou un « Run workflow » manuel) les réactive.
- **Quota** : largement dans le gratuit (le job dure ~1 min, 4×/jour).

## 6. Limites connues (honnêtes)

- Le classement par thème repose sur des **mots-clés**, pas sur de l'IA. Un article à cheval sur
  deux thèmes (p. ex. « représentation des femmes dans les médias ») peut tomber dans l'un ou l'autre.
  On ajuste en peaufinant les mots-clés depuis la gestion.
- Le **« Tester le flux »** et le **« Trouver des sources »** de la page de gestion passent par un
  relais public (allorigins) à cause des restrictions navigateur (CORS). C'est **indicatif** : la
  validation qui fait foi est le prochain passage du robot.
- Pour rester gratuit, le dépôt est **public** : la liste des sources et la veille sont visibles de tous.
  Le jeton GitHub, lui, n'est **jamais** publié (il reste dans ton navigateur).

## 7. Faire évoluer

- **Nouveau thème / nouvelle source** : via la page de gestion (aucun code).
- **Changer le design** : tout est dans `docs/css/styles.css` (variables de couleur en haut).
- **Changer la logique de scoring** : `scripts/scoring.js`, abondamment commenté.
- **Ajouter un export, une newsletter, etc.** : le `feed.json` est un format simple et stable,
  facile à brancher ailleurs.

Voir `DOCUMENTATION.md` pour le mode d'emploi des deux interfaces.
