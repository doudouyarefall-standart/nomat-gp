// api/tenants/[slug]/bookings.js — POST: create booking for a tenant
// GET: list bookings (authentifié)

import {
  getTenantBySlug,
  saveTenantBooking,
  listTenantBookings,
  getSession,
  isKvConfigured,
} from "../../../lib/db-saas.js";

function generateReference() {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function generateTracking(tenantSlug) {
  const prefix = tenantSlug.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  return `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Id");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { slug } = req.query;

  const kvOk = await isKvConfigured();
  if (!kvOk) {
    return res.status(503).json({ error: "DB not configured", code: "KV_NOT_CONFIGURED" });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return res.status(404).json({ error: "GP introuvable: " + slug });
  }
  if (tenant.status !== "active") {
    return res.status(402).json({ error: "Ce GP n'est pas actif" });
  }

  // POST: créer réservation (public)
  if (req.method === "POST") {
    try {
      const b = req.body || {};
      const required = [
        "expediteurNom", "expediteurTel", "destinataireNom",
        "destinataireTel", "destinataireAdresse", "poids",
        "modePaiement", "dateDepart",
      ];
      for (const f of required) {
        if (!b[f]) return res.status(400).json({ error: `Champ manquant: ${f}` });
      }

      const poids = Number(b.poids);
      if (isNaN(poids) || poids <= 0) return res.status(400).json({ error: "Poids invalide" });

      const reference = generateReference();
      const trackingNumber = generateTracking(tenant.slug);
      const now = new Date().toISOString();
      const pricePerKg = tenant.config?.pricePerKg || 20;
      const montantTotal = poids * pricePerKg;

      const booking = {
        reference, trackingNumber, tenantId: tenant.id, tenantSlug: tenant.slug,
        expediteurNom: b.expediteurNom, expediteurTel: b.expediteurTel,
        expediteurEmail: b.expediteurEmail || null,
        destinataireNom: b.destinataireNom, destinataireTel: b.destinataireTel,
        destinataireEmail: b.destinataireEmail || null,
        destinataireAdresse: b.destinataireAdresse,
        paysDestination: b.paysDestination || "CANADA",
        villeDestination: b.villeDestination || "Montréal",
        poids, description: b.description || null,
        modePaiement: b.modePaiement,
        modalitePaiement: b.modalitePaiement || "ENTIER_AVANCE",
        statutPaiement: b.modalitePaiement === "MI_MI" ? "ACOMPTE_VERSE" : "EN_ATTENTE",
        statut: "EN_PREPARATION", dateDepart: b.dateDepart,
        montantTotal, currency: tenant.config?.currency || "USD",
        historique: [{ statut: "EN_PREPARATION", date: now, lieu: "Dépôt", note: "Réservation enregistrée." }],
        createdAt: now, updatedAt: now,
      };

      await saveTenantBooking(tenant.id, booking);

      return res.status(201).json({
        success: true, reference, trackingNumber, montantTotal,
        currency: booking.currency, statutPaiement: booking.statutPaiement,
        message: "Réservation enregistrée.",
      });
    } catch (error) {
      console.error("[TENANT_BOOKING_ERROR]", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  // GET: liste (authentifié)
  if (req.method === "GET") {
    try {
      const sessionId = req.headers["x-session-id"];
      const session = await getSession(sessionId);
      if (!session || session.tenantId !== tenant.id) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      const bookings = await listTenantBookings(tenant.id, 100);
      return res.status(200).json({ success: true, bookings });
    } catch (error) {
      console.error("[TENANT_BOOKING_LIST_ERROR]", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
