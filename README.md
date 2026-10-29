# NOMAT GP — Plateforme de fret aérien (V2 + Backend)

Site one-page de **NOMAT GP**, service de fret aérien Dakar ↔ New York ↔ Montréal, avec backend serverless (Vercel Functions + Vercel KV) et intégration Bictorys.

## 📦 Architecture

```
nomat-gp/
├── index.html                    (3.8 MB — frontend V2 self-contained, 100% offline)
├── vercel.json                   (config: rewrites /, headers cache + sécurité)
├── package.json                  (deps: @vercel/kv)
│
├── api/                          ← Backend serverless (Vercel Functions)
│   ├── bookings.js               POST: créer réservation + génère ref + tracking
│   │                             GET: lister (admin)
│   ├── track.js                  GET: suivre colis par ref ou tracking
│   ├── bictorys/
│   │   ├── checkout.js           POST: initie paiement Bictorys (redirige)
│   │   └── webhook.js            POST: reçoit notifications Bictorys
│   └── admin/
│       └── bookings.js           GET: liste admin / PATCH: maj statut
│
├── lib/                          ← Helpers backend
│   ├── db.js                     (Vercel KV — saveBooking, getBooking, etc.)
│   └── bictorys.js               (Client API Bictorys — initiateCheckout, verifyWebhook)
│
├── .env.example                  (template des variables d'environnement)
│
└── [assets images]               logo, flyers, bannières sections (6 images)
```

## 🚀 Déploiement sur Vercel

### Étape 1 — Pré-requis
- Compte Vercel (gratuit) : https://vercel.com
- Repo GitHub : https://github.com/doudouyarefall-standart/nomat-gp

### Étape 2 — Import sur Vercel
1. https://vercel.com/new
2. Importez le repo `doudouyarefall-standart/nomat-gp`
3. Vercel détecte automatiquement `vercel.json` + `package.json`
4. Cliquez **Deploy** — le site est live sur `nomat-gp.vercel.app`

### Étape 3 — Créer le KV Store (base de données)
1. Vercel Dashboard → **Storage** → **Create Database** → **KV** (Senegal-friendly: gratuite jusqu'à 256 MB)
2. Donnez un nom : `nomat-gp-db`
3. Cliquez **Connect to Project** → sélectionnez votre projet NOMAT GP
4. Les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont auto-injectées

### Étape 4 — Configurer les variables d'environnement
Vercel Dashboard → Project → **Settings → Environment Variables**. Ajoutez :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `BICTORYS_API_KEY` | Votre clé API Bictorys (compte marchand) | Oui pour paiements réels |
| `BICTORYS_BASE_URL` | `https://api.bictorys.com/v1` (prod) ou `https://sandbox-api.bictorys.com/v1` (test) | Oui |
| `BICTORYS_WEBHOOK_SECRET` | Secret webhook (à créer sur dashboard Bictorys) | Recommandé |
| `ADMIN_PASSWORD` | Mot de passe admin (par défaut: `nomat2026`) | Oui |
| `NEXT_PUBLIC_SITE_URL` | `https://nomat-gp.vercel.app` | Oui |

### Étape 5 — Configurer le webhook Bictorys
Sur votre dashboard Bictorys marchand, ajoutez l'URL webhook :
```
https://nomat-gp.vercel.app/api/bictorys/webhook
```

### Étape 6 — Redéployer
Une fois les variables + KV configurés, Vercel redéploie automatiquement. Sinon : Project → **Deployments** → **Redeploy**.

## 🔌 Endpoints API

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/bookings` | Crée une réservation (génère référence + tracking) |
| `GET` | `/api/bookings` | Liste les 50 dernières réservations (admin — header `X-Admin-Password`) |
| `GET` | `/api/track?numero=NOMAT-XXXX-XXXX` | Suit un colis par tracking OU référence |
| `POST` | `/api/bictorys/checkout` | Initie un paiement Bictorys (body: `{reference}`) |
| `POST` | `/api/bictorys/webhook` | Webhook Bictorys (appelé par Bictorys) |
| `GET` | `/api/admin/bookings` | Liste admin (header `X-Admin-Password`) |
| `PATCH` | `/api/admin/bookings` | Met à jour le statut (body: `{reference, statut}`) |

### Exemple : créer une réservation
```bash
curl -X POST https://nomat-gp.vercel.app/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "expediteurNom": "Awa Diop",
    "expediteurTel": "+221771234567",
    "destinataireNom": "Mamadou Sow",
    "destinataireTel": "+15141234567",
    "destinataireAdresse": "456 Avenue du Parc, Montréal QC",
    "paysDestination": "CANADA",
    "villeDestination": "Montréal",
    "poids": 15.5,
    "modePaiement": "WAVE",
    "modalitePaiement": "MI_MI",
    "dateDepart": "2026-11-04"
  }'
```

Réponse :
```json
{
  "success": true,
  "reference": "REF-NOMAT-808161",
  "trackingNumber": "NOMAT-TDTUTQ-7900",
  "montantTotal": 310,
  "statutPaiement": "ACOMPTE_VERSE",
  "message": "Réservation enregistrée avec succès."
}
```

## 🗃️ Schéma base de données (KV)

Structure d'une réservation :
```json
{
  "reference": "REF-NOMAT-808161",
  "trackingNumber": "NOMAT-TDTUTQ-7900",
  "expediteurNom": "Awa Diop",
  "expediteurTel": "+221771234567",
  "expediteurEmail": null,
  "destinataireNom": "Mamadou Sow",
  "destinataireTel": "+15141234567",
  "destinataireEmail": null,
  "destinataireAdresse": "456 Avenue du Parc, Montréal QC",
  "paysDestination": "CANADA",
  "villeDestination": "Montréal",
  "poids": 15.5,
  "description": null,
  "modePaiement": "WAVE",
  "modalitePaiement": "MI_MI",
  "statutPaiement": "ACOMPTE_VERSE",
  "statut": "EN_PREPARATION",
  "dateDepart": "2026-11-04",
  "montantTotal": 310,
  "historique": [
    { "statut": "EN_PREPARATION", "date": "...", "lieu": "Dakar, Sénégal", "note": "..." }
  ],
  "bictorysTransactionId": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 💳 Bictorys — TODOs

L'intégration Bictorys dans `lib/bictorys.js` est basée sur le modèle standard des agrégateurs de paiement africains (Paystack/Flutterwave-like). **À confirmer avec la doc officielle Bictorys** :

1. **Base URL** : `https://api.bictorys.com/v1` — à vérifier
2. **Endpoint checkout** : `POST /checkout/initiate` — à vérifier
3. **Authentification** : `Authorization: Bearer <key>` — à vérifier (peut être `X-API-KEY`)
4. **Format montant** : en centimes (×100) — à vérifier
5. **Format webhook** : `data.reference`, `data.status`, `data.transaction_id` — à vérifier
6. **Signature webhook** : HMAC-SHA256 — à vérifier

Documentation officielle : https://docs.bictorys.com (peut nécessiter un compte marchand).

## 🔐 Sécurité

- Le mot de passe admin (`nomat2026` par défaut) doit être changé en production via la variable `ADMIN_PASSWORD`.
- Les webhooks Bictorys vérifient la signature HMAC si `BICTORYS_WEBHOOK_SECRET` est défini.
- CORS activé sur les endpoints publics pour permettre les appels depuis le frontend.

## 🌍 Domaine personnalisé

Vercel → Settings → Domains → ajoutez votre domaine (`nomatgp.com` etc.).
DNS à configurer : `A` record → `76.76.21.21` ou `CNAME` → `cname.vercel-dns.com`.

## 📞 Coordonnées

- **NOMAT GP Sénégal** : +221 77 341 98 04, +221 77 556 12 66 — Ouest Foire, Dakar
- **NOMAT GP Canada** : +1 (514) 346 15 38 — 373 rue Savard, Chicoutimi, QC
- **Stand'Art Digital** (agence) : +221 78 537 81 31 — https://sjfqyh.s.gy/standart_digital
