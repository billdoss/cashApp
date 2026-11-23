# Sika Budget

Application mobile (PWA) de gestion de dépenses : budgets avec alertes, statistiques, prévisions, objectifs d'épargne et conseiller. Installable sur l'écran d'accueil, fonctionne sans réseau.

## Données et sécurité (phase 1 : tout sur le téléphone)

- Au premier lancement, l'utilisateur choisit un prénom et un code à 6 chiffres.
- Le code n'est jamais stocké. Il sert à dériver une clé (PBKDF2, 310 000 itérations) qui chiffre toutes les données (AES-GCM) dans le `localStorage` du navigateur.
- Verrouillage automatique à la sortie de l'application (délai réglable), 5 essais puis temporisation croissante.
- Code oublié : les données ne sont pas récupérables. Il faut effacer et recommencer.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Page unique |
| `js/auth.js` | Compte local, chiffrement, essais limités |
| `js/storage.js` | Couche de stockage (`Store` + adaptateur local) |
| `js/app.js` | Interface, calculs, prévisions, conseils |
| `js/lock.js` | Écrans de création, de code et de verrouillage |
| `sw.js`, `manifest.webmanifest` | Mode hors ligne et installation |

## Phase 2 : Supabase et synchronisation

Le branchement se fait dans `js/storage.js` avec un second adaptateur, sans toucher à l'interface :

1. Tables `profils`, `categories`, `depenses`, `objectifs`, chacune avec `user_id` et une règle Row Level Security (`user_id = auth.uid()`).
2. Connexion par e-mail ou code SMS (Supabase Auth). Le code à 6 chiffres reste un verrou local de l'application.
3. Les identifiants des dépenses, budgets et objectifs sont déjà stables, et `updatedAt` est ajouté à chaque enregistrement : la fusion avec le serveur se fait sans doublons.
4. Écriture locale d'abord, envoi en arrière-plan dès que le réseau revient.

## Déploiement

Chaque push sur `main` déploie le site sur GitHub Pages (`.github/workflows/pages.yml`).
Changer `VERSION` dans `sw.js` à chaque mise en ligne pour que les téléphones récupèrent les nouveaux fichiers.

## Tester en local

```
python3 -m http.server 8000
```
puis ouvrir http://localhost:8000
