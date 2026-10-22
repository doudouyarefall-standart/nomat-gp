# NOMAT GP — Site statique

Site one-page de **NOMAT GP**, service de fret aérien Dakar ↔ New York ↔ Montréal.

## 📦 Contenu

- `index.html` — fichier HTML unique 100% self-contained (3.7 MB)
  - Tailwind CSS inliné
  - globe.gl + Three.js inlinés (globe 3D animé en hero)
  - Textures Earth Night + Earth Topology embarquées en base64
  - CSS custom inline (thème clair + sombre premium noir/or/rouge)
  - JavaScript inline pour toutes les interactions
- `logo-nomat-gp.png` — logo NOMAT GP
- `flyer-1.jpg` + `flyer-2.jpg` — flyers originaux dans la section À propos
- `vercel.json` — configuration Vercel (static site, headers de cache + sécurité)

## 🚀 Déploiement sur Vercel

### Option A — Via Git (recommandé)

1. Créez un repo sur GitHub (par ex. `nomat-gp`).
2. Pushez ce dossier :
   ```bash
   git init
   git add .
   git commit -m "NOMAT GP — site statique initial"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USER/nomat-gp.git
   git push -u origin main
   ```
3. Sur https://vercel.com/new :
   - Importez le repo GitHub
   - Framework Preset : **Other** (site statique)
   - Root Directory : laissez par défaut (le repo entier)
   - Build Command : laissez vide (pas de build)
   - Output Directory : `.` (racine)
   - Cliquez **Deploy**
4. Vercel génère une URL type `nomat-gp.vercel.app` (modifiable dans Settings → Domains).

### Option B — Via Vercel CLI

```bash
npm i -g vercel
vercel login
cd deploy
vercel --prod
```

Suivez les prompts (project name, scope, etc.). Vercel détecte automatiquement le `vercel.json`.

## 🌍 Domaine personnalisé

Une fois déployé, dans **Vercel → Settings → Domains** :
- Ajoutez `nomatgp.com` (ou votre domaine)
- Configurez les DNS chez votre registrar :
  - `A` record → `76.76.21.21` (Vercel)
  - ou `CNAME` → `cname.vercel-dns.com`

## 🔧 Maintenance

- Pour modifier le contenu : éditez `index.html` directement (les textes sont en clair dans le HTML).
- Les traductions FR/EN sont dans l'objet `I18N` (recherchez `const I18N =`).
- Le panneau admin est accessible via `#admin` à la fin de l'URL, mot de passe `nomat2026` (à changer en production).

## 📞 Coordonnées intégrées

- **NOMAT GP Sénégal** : +221 77 341 98 04, +221 77 556 12 66 — Ouest Foire, Dakar
- **NOMAT GP Canada** : +1 (514) 346 15 38 — 373 rue Savard, Chicoutimi, QC
- **Stand'Art Digital** (agence) : +221 78 537 81 31 — https://sjfqyh.s.gy/standart_digital

## 🛠 Stack technique

- HTML5 / CSS3 / Vanilla JS
- Tailwind CSS (CDN inliné)
- Three.js + globe.gl (globe 3D, inliné)
- Prisma/Next.js non requis (100% statique)
- localStorage pour : réservations, suivi, thème, langue
