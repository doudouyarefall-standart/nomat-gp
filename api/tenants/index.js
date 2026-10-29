// api/tenants/index.js — POST: signup (crée un tenant + initie subscription Bictorys)
// GET: liste tous les tenants (super-admin)

import {
  createTenant,
  generateTenantId,
  slugify,
  listTenants,
  isKvConfigured,
  createSession,
} from "../../lib/db-saas.js";
import { initiateCheckout } from "../../lib/bictorys.js";

const PLANS = {
  trial: { name: "Essai 7 jours", price: 0, duration: "7 jours" },
  basic: { name: "Basique", price: 25, duration: "mensuel" }, // 25$/mois
  pro: { name: "Pro", price: 50, duration: "mensuel" }, // 50$/mois
  enterprise: { name: "Entreprise", price: 100, duration: "mensuel" }, // 100$/mois
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const kvOk = await isKvConfigured();
  if (!kvOk) {
    return res.status(503).json({
      error: "Base de données non configurée. Activez Vercel KV.",
      code: "KV_NOT_CONFIGURED",
    });
  }

  // === POST: SIGNUP ===
  if (req.method === "POST") {
    try {
      const b = req.body || {};
      const required = ["companyName", "email", "password", "plan"];
      for (const f of required) {
        if (!b[f]) return res.status(400).json({ error: `Champ manquant: ${f}` });
      }

      if (!PLANS[b.plan]) {
        return res.status(400).json({ error: "Plan invalide. Choix: trial, basic, pro, enterprise" });
      }

      if (b.password.length < 6) {
        return res.status(400).json({ error: "Mot de passe trop court (min 6 caractères)" });
      }

      const tenantId = generateTenantId();
      let slug = b.slug ? slugify(b.slug) : slugify(b.companyName);
      
      // Si trial, crée directement sans paiement
      if (b.plan === "trial") {
        const tenant = await createTenant({
          id: tenantId,
          slug,
          name: b.companyName,
          email: b.email,
          passwordHash: hashPassword(b.password), // simple hash
          plan: "trial",
          status: "active",
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const session = await createSession(tenantId, b.email);

        return res.status(201).json({
          success: true,
          tenantId,
          slug,
          session: session.sessionId,
          dashboardUrl: `/saas/dashboard.html?session=${session.sessionId}`,
          publicSiteUrl: `/s/${slug}`,
          message: "Compte créé en essai 7 jours. Configurez votre GP dans le dashboard.",
        });
      }

      // Pour plans payants : initie le paiement Bictorys (subscription)
      const plan = PLANS[b.plan];
      const checkout = await initiateCheckout({
        reference: `sub_${tenantId}_${Date.now()}`,
        amount: plan.price,
        currency: "USD",
        customerEmail: b.email,
        customerName: b.companyName,
        description: `Abonnement NOMAT GP SaaS — Plan ${plan.name} (${plan.price}$/mois)`,
      });

      // Crée le tenant en statut "pending_payment"
      await createTenant({
        id: tenantId,
        slug,
        name: b.companyName,
        email: b.email,
        passwordHash: hashPassword(b.password),
        plan: b.plan,
        status: "pending_payment",
        subscriptionReference: `sub_${tenantId}_${Date.now()}`,
      });

      // En mode démo (pas de clé Bictorys), active directement
      if (checkout.demo) {
        await updateTenantStatus(tenantId, "active");
        const session = await createSession(tenantId, b.email);
        return res.status(201).json({
          success: true,
          demo: true,
          tenantId,
          slug,
          session: session.sessionId,
          dashboardUrl: `/saas/dashboard.html?session=${session.sessionId}`,
          publicSiteUrl: `/s/${slug}`,
          message: `Compte créé (mode démo — BICTORYS_API_KEY non configuré). Plan ${plan.name} activé.`,
        });
      }

      // Mode réel : redirige vers Bictorys
      return res.status(200).json({
        success: true,
        checkoutUrl: checkout.checkoutUrl,
        transactionId: checkout.transactionId,
        tenantId,
        slug,
        message: "Redirection vers Bictorys pour le paiement de l'abonnement.",
      });
    } catch (error) {
      console.error("[SIGNUP_ERROR]", error);
      return res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  }

  // === GET: LIST (super-admin) ===
  if (req.method === "GET") {
    try {
      const tenants = await listTenants(100);
      return res.status(200).json({ success: true, tenants, plans: PLANS });
    } catch (error) {
      console.error("[TENANTS_LIST_ERROR]", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// Simple hash (à remplacer par bcrypt en prod)
function hashPassword(pwd) {
  // TODO [PROD]: use bcrypt or argon2
  return Buffer.from(pwd).toString('base64');
}

async function updateTenantStatus(id, status) {
  const { updateTenant } = await import("../../lib/db-saas.js");
  await updateTenant(id, { status });
}
