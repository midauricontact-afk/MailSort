# MailSort 📬

Web app installable (PWA) pour **trier et nettoyer sa boîte Gmail** depuis un iPhone.
Tout ce que fait MailSort est appliqué **directement sur le compte Gmail** (libellés,
corbeille, filtres) : on retrouve exactement le même résultat dans l'application Gmail de Google.

- **Tri automatique** par entreprise (amazon.fr + amazon.com + marketplace.amazon → « Amazon »),
  en 8 catégories, appliqué comme libellés Gmail `MailSort/…`.
- **Stockage** : qui prend le plus de place, filtres (grosses pièces jointes, vieux mails,
  promos jamais ouvertes), nettoyage en masse avec estimation de l'espace libéré.
- **Expéditeurs Autorisés / Bloqués / Neutres** avec de vrais filtres Gmail, et **désinscription en un bouton**.
- **Conseils** : suggestions de ménage calculées sur le téléphone.
- Recherche, gestes de glissement, mode sombre, interface en français.
- **Jamais de suppression définitive** : tout passe par la corbeille de Gmail (récupérable 30 jours).
- **Aucun serveur** : l'app parle directement à Google depuis le téléphone. Les données restent sur l'appareil.

---

## Installation pas à pas

Il y a 4 étapes : créer l'identifiant Google, mettre l'app en ligne, ajouter l'adresse
autorisée chez Google, puis installer sur l'iPhone. Compte environ 20 minutes.

> Dans ce guide, `TON-PSEUDO` est ton nom d'utilisateur GitHub (par exemple `midauri`).
> L'adresse de l'app sera donc : `https://TON-PSEUDO.github.io/MailSort/`

### 1. Créer le projet Google Cloud et l'identifiant OAuth

1. Va sur <https://console.cloud.google.com/> et connecte-toi avec ton compte Gmail.
2. En haut, clique sur le sélecteur de projet › **Nouveau projet** › nom : `MailSort` › **Créer**.
3. Menu ☰ › **API et services** › **Bibliothèque** › cherche **Gmail API** › **Activer**.
4. Menu ☰ › **API et services** › **Écran de consentement OAuth** (ou « Google Auth Platform ») :
   - Type d'utilisateur : **Externe** › Créer.
   - Nom de l'application : `MailSort`, adresse d'assistance et de contact : ton adresse Gmail.
   - **Accès aux données / Champs d'application** › Ajouter :
     `https://www.googleapis.com/auth/gmail.modify` et
     `https://www.googleapis.com/auth/gmail.settings.basic`.
   - **Audience / Utilisateurs test** › **Ajouter des utilisateurs** › ton adresse Gmail.
     *(Laisse l'application en mode « Test » : pas besoin de validation par Google pour un usage perso.)*
5. Menu ☰ › **API et services** › **Identifiants** › **Créer des identifiants** › **ID client OAuth** :
   - Type : **Application Web**, nom : `MailSort`.
   - **Origines JavaScript autorisées** › Ajouter : `https://TON-PSEUDO.github.io`
     (et `http://localhost:5173` si tu veux tester sur ton PC).
   - **URI de redirection autorisés** › Ajouter : `https://TON-PSEUDO.github.io/MailSort/`
     (et `http://localhost:5173/` pour les tests sur PC).
   - **Créer**. Copie l'**ID client** (il finit par `.apps.googleusercontent.com`).
6. Ouvre le fichier `.env` du projet et remplace la valeur factice :
   ```
   VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
   ```
   *(Cet identifiant n'est pas un secret, il peut être publié.)*

### 2. Mettre l'app en ligne (GitHub Pages, gratuit)

1. Crée un compte sur <https://github.com> si tu n'en as pas.
2. Crée un dépôt : **New repository** › nom **`MailSort`** › **Public** › *ne coche rien d'autre* › **Create repository**.
   *(GitHub Pages gratuit demande un dépôt public. Il ne contient aucun secret.)*
3. Dans le dossier du projet, envoie le code (remplace `TON-PSEUDO`) :
   ```bash
   git remote add origin https://github.com/TON-PSEUDO/MailSort.git
   ```
   ```bash
   git push -u origin main
   ```
4. Sur GitHub, dans le dépôt : **Settings** › **Pages** › **Source** : **GitHub Actions**.
5. Onglet **Actions** : le déploiement « Déployer sur GitHub Pages » se lance (ou relance-le avec
   **Run workflow**). Après 1 à 2 minutes, l'app est en ligne sur `https://TON-PSEUDO.github.io/MailSort/`.

Chaque `git push` republie automatiquement l'app (les tests doivent passer).

> **Variante sans toucher au fichier `.env`** : sur GitHub, **Settings** › **Secrets and variables** ›
> **Actions** › onglet **Variables** › **New repository variable** : nom `GOOGLE_CLIENT_ID`, valeur = ton ID client.
> Ou encore : colle l'ID client directement dans l'écran d'accueil de l'app, elle s'en souviendra.

> **Variante Netlify** : `npm run build`, puis glisse le dossier `dist` sur <https://app.netlify.com/drop>.
> Pense alors à mettre l'adresse Netlify dans les origines et URI de redirection Google.

### 3. Installer l'app sur l'iPhone

1. Ouvre **Safari** (pas Chrome) sur l'iPhone et va sur `https://TON-PSEUDO.github.io/MailSort/`.
2. Touche **Se connecter avec Google**, choisis ton compte. Google affiche « Google n'a pas validé
   cette application » : touche **Continuer** (c'est ton app, en mode test), puis coche **toutes**
   les autorisations demandées.
3. Touche **Partager** (carré avec une flèche) › **Sur l'écran d'accueil** › **Ajouter**.
4. Ouvre MailSort depuis l'écran d'accueil : elle s'affiche en plein écran comme une vraie app.
   Reconnecte-toi une fois dans l'app installée (l'iPhone sépare Safari et les apps de l'écran d'accueil).

---

## Utilisation

| Onglet | Ce qu'on y fait |
| --- | --- |
| **Tri** | Les 8 catégories. Touche une catégorie pour filtrer. Glisse un expéditeur **←** pour le *déplacer* ou le *bloquer*, **→** pour l'*autoriser*. Un long glissement déclenche l'action directement. |
| **Expéditeurs** | Neutres / Autorisés / Bloqués, recherche et tri. |
| **Stockage** | Classement par espace ou par nombre, filtres, corbeille par expéditeur ou en masse. |
| **Conseils** | Désinscriptions et nettoyages suggérés. |
| **Réglages** | Nombre de mails analysés, tri des futurs mails, thème, déconnexion. |

Touche un expéditeur pour ouvrir sa fiche : statut, catégorie, désinscription, corbeille
(« plus de X mois » ou tout), derniers mails et **Ouvrir dans Gmail**.

**Dans l'app Gmail** : menu ☰ › section Libellés › **MailSort** › la catégorie voulue.

### Ce que MailSort crée dans ton compte Gmail

| Élément | Détail |
| --- | --- |
| Libellés | `MailSort/Achats & livraisons`, `MailSort/Banque & factures`, `MailSort/Réseaux sociaux`, `MailSort/Newsletters & promos`, `MailSort/Services & comptes`, `MailSort/Voyages`, `MailSort/Personnel`, `MailSort/Autres`, `MailSort/Autorisés` |
| Filtres de tri | Un filtre par catégorie (« De : amazon.fr OR fnac.com… » › libellé). Les nouveaux mails sont rangés même quand l'app est fermée. Désactivable dans Réglages. |
| Filtre « Bloqué » | « De : expéditeur » › mettre à la corbeille, retirer de la boîte de réception. |
| Filtre « Autorisé » | « De : expéditeur » › libellé `MailSort/Autorisés` + marquer comme important. |

Tout est visible et modifiable dans Gmail sur le web : ⚙️ › **Voir tous les paramètres** › **Filtres et adresses bloquées**.

### Bon à savoir

- **Session Google** : Google donne aux apps sans serveur un accès valable 1 heure. MailSort le renouvelle
  tout seul en arrière-plan. Si l'iPhone bloque ce renouvellement (app restée longtemps en veille),
  un bandeau orange **« Toucher pour reconnecter »** apparaît : un toucher suffit, sans mot de passe.
- En mode « Test » chez Google, il faudra peut-être réautoriser l'app environ une fois par semaine.
- **Espace libéré** : Gmail vide la corbeille au bout de 30 jours ; c'est à ce moment que l'espace est
  réellement récupéré (ou tout de suite si tu vides la corbeille dans Gmail).
- **Désinscription** : en un clic quand l'expéditeur le permet (norme RFC 8058), sinon par un mail
  envoyé depuis ton compte, sinon la page de désinscription de l'expéditeur s'ouvre.
- **Ouvrir dans Gmail** ouvre l'app Gmail (lien `googlegmail://`) et copie la recherche de l'expéditeur :
  colle-la dans la barre de recherche de Gmail.
- **Mode démo** : sur l'écran d'accueil, « Essayer avec des données de démo » montre l'app avec un faux
  compte. Rien n'est envoyé à Gmail.

---

## Pour les développeurs

```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npm run build
```

- Vite + React 19 + TypeScript, aucun framework UI.
- `src/core/` : logique pure et testée (regroupement, classement, filtres, désinscription, suggestions).
- `src/gmail/` : client de l'API REST Gmail (requêtes batch, reprise sur quota) + client de démo.
- `src/auth/` : Google Identity Services (jeton 1 h, renouvellement silencieux, repli par redirection).
- `src/storage/` : cache IndexedDB (une base par compte).
- `src/state/store.ts` : orchestration (synchro, libellés, filtres, corbeille).
- `src/ui/` : écrans et composants.
- `public/sw.js` : service worker (met en cache l'interface seulement, jamais les données Gmail).
- `npm run icons` régénère les icônes PNG.
