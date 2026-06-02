# Mode d'emploi — Les deux interfaces

## Interface 1 — Consultation (`index.html`)

La page d'accueil, pensée comme une **une de rédaction**.

- **À la une** : l'article au meilleur compromis urgence + pertinence est mis en avant en grand.
- **Le fil** : tous les autres articles, en cartes (visuel, rubrique colorée, titre, chapô, source, date).
- **Deux scores par article**, comme demandé :
  - **Pertinence** (qualité/adéquation de l'info) — pastille de couleur + niveau.
  - **Urgence** (priorité de lecture, surtout liée à la fraîcheur).
  - Les articles très urgents portent un bandeau **« À lire en priorité »**.
- **Filtrer par thématique** : les pastilles colorées en haut (Tout / Éducation aux médias / Enseignement / Inclusion / …).
- **Trier** : par Urgence, Pertinence ou Date.
- **Rechercher** : champ de recherche plein texte (titre, chapô, source).

Tout est **lecture seule** ici : c'est l'espace de consultation quotidienne.

---

## Interface 2 — Gestion (`admin.html`)

Accessible via le lien « Gestion › » en haut de la consultation. Quatre onglets.

### Onglet « Connexion » (à faire une fois)

Pour enregistrer tes réglages, l'app écrit dans le dépôt GitHub via un **jeton d'accès personnel**.

1. Clique sur **« Créer un jeton »** (ouvre GitHub).
   - Type : **Fine-grained token**.
   - **Resource owner** : ton compte. **Repository access** : *Only select repositories* → ce dépôt.
   - **Permissions → Repository permissions → Contents : Read and write**.
   - Génère, **copie le jeton** (il ne s'affiche qu'une fois).
2. Reviens sur la page, remplis **Owner** (ton compte/orga), **Repo** (ex. `veille`),
   **Branche** (`main`), colle le **jeton**.
3. **Connecter & vérifier**. Si tout est bon, les onglets Sources et Thématiques se chargent.

> Le jeton reste **uniquement dans ton navigateur**. Sur un ordinateur partagé, clique
> **« Déconnecter »** en partant. Si tu changes d'ordinateur, tu refais juste la connexion.

### Onglet « Sources »

- **Ajouter une source** : nom + URL du flux RSS, thème par défaut, poids, activée ou non.
- **Tester le flux** : vérification rapide (indicative) que l'URL renvoie bien des articles.
- **Poids / fiabilité** (curseur 0.1 → 2.0) : règle **le taux de pertinence** accordé à la source.
  Une source de référence (1.5–2.0) fera remonter ses articles ; une source secondaire (0.5–0.8) pèsera moins.
- **Activer / désactiver** une source sans la supprimer.
- **Modifier / Supprimer** depuis la liste.

Chaque enregistrement écrit dans `config/sources.json`. **Effet au prochain passage du robot**
(ou lance-le tout de suite dans `Actions → Veille RSS → Run workflow`).

### Onglet « Thématiques »

- **Créer / modifier / supprimer** une thématique : libellé, rubrique (sous-titre), **couleur**,
  ordre d'affichage, et surtout les **mots-clés**.
- Les **mots-clés** sont le moteur du rattachement : un article qui les contient est classé dans
  ce thème, et son score de pertinence augmente. Plus la liste est fine, meilleur est le tri.
  Astuce : mets les termes les plus distinctifs (« décolonial », « validisme »…) plutôt que des
  mots trop génériques.

### Onglet « Trouver des sources »

Colle l'adresse d'un site ; l'outil teste les emplacements RSS habituels (`/feed`, `/rss`, …) et
te propose les flux trouvés, prêts à ajouter. Détection **indicative** (via relais public) : si rien
ne sort, cherche « RSS » ou l'icône 🔶 sur le site et ajoute l'URL à la main dans « Sources ».

---

## Le quotidien, en pratique

1. Tu ouvres la **consultation** chaque jour ; tu filtres par thème, tu tries par urgence.
2. De temps en temps, tu ouvres la **gestion** pour ajouter une bonne source ou affiner un thème.
3. Le **robot** fait le reste, tout seul.

## Hiérarchisation à deux niveaux — rappel

- **Pertinence** = *est-ce une bonne info pour nous ?* → pilotée par les mots-clés du thème + le poids de la source.
- **Urgence** = *dois-je la lire maintenant ?* → pilotée par la fraîcheur + des mots signalant une échéance.

Les deux sont **indépendants** : un article peut être très pertinent mais peu urgent (un dossier de fond),
ou peu pertinent mais urgent (une actu chaude en marge de tes thèmes).
