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

## Phase 2 : synchronisation Supabase (optionnelle)

- `supabase/schema.sql` : tables `profile`, `categories`, `expenses`, `goals`, avec Row Level Security (chaque utilisateur ne voit que ses lignes). À exécuter une fois dans Supabase > SQL Editor.
- `js/config.js` : URL du projet et clé publique `anon`. Tant qu'ils sont vides, l'application reste 100 % locale.
- `js/sync.js` : connexion par e-mail et mot de passe, puis synchronisation automatique ligne par ligne. La modification la plus récente gagne, les suppressions sont propagées, les données d'exemple ne sont jamais envoyées. Un nouvel appareil récupère les données du cloud sans écraser celles qui existent.
- La session cloud est gardée dans le coffre chiffré : verrouiller l'application la coupe, le code la remet.
- Hors ligne, tout fonctionne ; les changements partent au retour du réseau.

## Déploiement

GitHub Pages sert directement la racine de la branche `main` (Settings > Pages > Deploy from a branch > `main` / `(root)`).
Chaque push sur `main` met le site à jour en une à deux minutes.
Changer `VERSION` dans `sw.js` à chaque mise en ligne pour que les téléphones récupèrent les nouveaux fichiers.

## Tester en local

```
python3 -m http.server 8000
```
puis ouvrir http://localhost:8000
