// api/tenants/[slug].js — GET: public tenant config (pour générer le site)
// PATCH: update config (authentifié via session)
// POST: login tenant

import {
  getTenantBySlug,
  getTenantById,
  updateTenant,
  getSession,
} from "../../lib/db-saas.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Id");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { slug } = req.query;

  // === GET: public config (pour afficher le site tenant) ===
  if (req.method === "GET") {
    try {
      const tenant = await getTenantBySlug(slug);
      if (!tenant) {
        return res.status(404).json({ error: "GP introuvable: " + slug });
      }
      if (tenant.status === "pending_payment") {
        return res.status(402).json({ error: "Abonnement en attente de paiement" });
      }
      // Renvoie seulement la config publique (pas le passwordHash)
      return res.status(200).json({
        success: true,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          config: tenant.config,
          plan: tenant.plan,
          status: tenant.status,
        },
      });
    } catch (error) {
      console.error("[TENANT_GET_ERROR]", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  // === POST: LOGIN ===
  if (req.method === "POST" && req.body?.action === "login") {
    try {
      const { email, password } = req.body;
      const tenant = await getTenantBySlug(slug);
      if (!tenant || tenant.email !== email) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }
      const hashedInput = Buffer.from(password).toString('base64');
      if (tenant.passwordHash !== hashedInput) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }
      const session = await createSession(tenant.id, email);
      return res.status(200).json({
        success: true,
        session: session.sessionId,
        tenantId: tenant.id,
        dashboardUrl: `/saas/dashboard.html?session=${session.sessionId}`,
      });
    } catch (error) {
      console.error("[LOGIN_ERROR]", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  // === PATCH: update config (authentifié) ===
  if (req.method === "PATCH") {
    try {
      const sessionId = req.headers["x-session-id"];
      const session = await getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Session invalide ou expirée" });
      }

      const tenant = await getTenantById(session.tenantId);
      if (!tenant || tenant.slug !== slug) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const updates = req.body || {};
      const newConfig = { ...tenant.config, ...updates.config };
      const updated = await updateTenant(tenant.id, { config: newConfig });

      return res.status(200).json({
        success: true,
        config: updated.config,
        message: "Configuration mise à jour.",
      });
    } catch (error) {
      console.error("[TENANT_UPDATE_ERROR]", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
