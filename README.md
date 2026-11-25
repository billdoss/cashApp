# FedhApp

Application mobile (PWA) de gestion de dépenses : budgets avec alertes, statistiques, prévisions, objectifs d'épargne et conseiller. Installable sur l'écran d'accueil, fonctionne sans réseau.

## Comptes, démo et sécurité

- **Une seule page d'accès** : onglets *Connexion* et *Créer un compte*, plus un bouton *Essayer la démo*.
- **Création de compte** : e-mail, nom d'utilisateur, mot de passe, PIN (6 chiffres, saisi deux fois).
- **Première connexion sur un appareil** : nom d'utilisateur (ou e-mail) + mot de passe + PIN. Le PIN est comparé à celui du compte.
- **Ensuite** : le PIN seul. Il déchiffre le coffre local (AES-GCM, clé dérivée par PBKDF2 310 000 itérations ; le PIN n'est jamais stocké). 5 essais, puis temporisation croissante ; verrouillage automatique réglable.
- **PIN oublié** : on se reconnecte avec le mot de passe et on choisit un nouveau PIN (valable sur tous les appareils ; les autres appareils sont invités à se reconnecter).
- **Démo** : données d'exemple stockées en clair sur l'appareil, sans PIN ni synchronisation ; « Créer un compte » quitte la démo et efface ses données.
- Compromis à connaître : le cloud ne garde qu'un hash salé du PIN (PBKDF2). Un PIN à 6 chiffres reste devinable hors ligne par quelqu'un qui aurait accès à la base ; le mot de passe protège l'accès au compte. La connexion par nom d'utilisateur permet de retrouver l'e-mail associé (fonction `login_email`).

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Page unique |
| `js/auth.js` | Coffre chiffré, démo, hash du PIN, essais limités |
| `js/storage.js` | Couche de stockage (`Store` + adaptateur local) |
| `js/app.js` | Interface, calculs, prévisions, conseils |
| `js/lock.js` | Page connexion / création de compte / démo, clavier PIN, verrouillage |
| `sw.js`, `manifest.webmanifest` | Mode hors ligne et installation |

## Phase 2 : synchronisation Supabase (optionnelle)

- `supabase/schema.sql` : tables `profile`, `categories`, `expenses`, `goals`, avec Row Level Security (chaque utilisateur ne voit que ses lignes). À exécuter une fois dans Supabase > SQL Editor.
- `js/config.js` : URL du projet et clé publique `anon`. Tant qu'ils sont vides, l'application reste 100 % locale.
- `js/sync.js` : inscription, connexion (nom d'utilisateur + mot de passe + PIN), puis synchronisation automatique ligne par ligne. La modification la plus récente gagne, les suppressions sont propagées, les données d'exemple ne sont jamais envoyées. Un nouvel appareil récupère les données du cloud sans écraser celles qui existent.
- La session cloud est gardée dans le coffre chiffré : verrouiller l'application la coupe, le PIN la remet.
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
