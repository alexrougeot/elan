# Élan

App perso de sport, nutrition et bien-être : séances avec coach de charges et chrono de repos, calories et macros, scan des codes-barres, pesée et progression vers l'objectif.

C'est une app web installable sur iPhone (Safari → Partager → Sur l'écran d'accueil). Elle marche hors ligne et se synchronise avec Supabase dès que le réseau revient.

- App en ligne : https://alexrougeot.github.io/elan/
- Front : React + Vite, PWA (service worker Workbox), stockage local IndexedDB
- Données et comptes : Supabase (table `docs` protégée par RLS, une ligne par document)
- Rappels de repas : fonction Supabase `meal-reminders`, appelée chaque minute par `pg_cron`, envoie les notifications Web Push
- Aliments frais : table Ciqual de l'Anses (CALNUT), embarquée dans `public/data/aliments.json`
- Produits du commerce : API Open Food Facts

## Développer

```bash
npm install
npm run dev      # http://localhost:5173/elan/ (ajouter ?demo=1 pour tester sans compte)
npm run build
```

## Publier

Le site est servi par GitHub Pages depuis la branche `gh-pages`, qui contient le dossier `dist` construit.
