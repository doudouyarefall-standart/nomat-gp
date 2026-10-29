// s/[slug].js — Vercel function : génère le site GP d'un tenant depuis le template
// Visite /s/{slug} → lit config tenant depuis DB → substitue dans template → renvoie HTML

import { getTenantBySlug, isKvConfigured } from "../../lib/db-saas.js";

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).send("Slug manquant");
  }

  // Vérifie KV
  const kvOk = await isKvConfigured();
  if (!kvOk) {
    return res.status(503).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Configuration en cours</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:3rem;">
      <h1>⚙️ Configuration en cours</h1>
      <p>La base de données Vercel KV n'est pas encore configurée.</p>
      <p>Voir le README pour les instructions.</p>
      </body></html>
    `);
  }

  // Récupère le tenant
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return res.status(404).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>GP introuvable</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:3rem;">
      <h1>🔍 GP introuvable</h1>
      <p>Aucun service GP trouvé pour le slug: <strong>${slug}</strong></p>
      <p><a href="/">← Retour à la plateforme</a></p>
      </body></html>
    `);
  }

  if (tenant.status === "pending_payment") {
    return res.status(402).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Abonnement en attente</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:3rem;">
      <h1>💳 Abonnement en attente</h1>
      <p>${tenant.name} n'a pas encore réglé son abonnement.</p>
      </body></html>
    `);
  }

  // Charge le template HTML (servi statiquement par Vercel)
  const baseUrl = `https://${req.headers.host}`;
  let templateHtml;
  try {
    const res2 = await fetch(`${baseUrl}/templates/gp-template.html`);
    if (!res2.ok) throw new Error("Template fetch failed: " + res2.status);
    templateHtml = await res2.text();
  } catch (err) {
    console.error("[TEMPLATE_FETCH_ERROR]", err);
    return res.status(500).send("Erreur lors du chargement du template.");
  }

  // === Substitutions dynamiques ===
  const cfg = tenant.config || {};
  const companyName = cfg.companyName || tenant.name || "GP Express";
  const pricePerKg = cfg.pricePerKg || 20;
  const currency = cfg.currency || "USD";
  const tagline = cfg.tagline || "Votre partenaire de transport de confiance";
  const phone = cfg.phone || "";
  const phone2 = cfg.phone2 || "";
  const phoneCanada = cfg.phoneCanada || "";
  const email = cfg.email || "";
  const depotAddress = cfg.depotAddress || "Dépôt à définir";
  const depotAddressCanada = cfg.depotAddressCanada || "";

  // Substitue toutes les occurrences NOMAT GP → nom du tenant
  let html = templateHtml
    // Nom de l'entreprise (partout dans le HTML)
    .replaceAll("NOMAT GP", companyName)
    .replaceAll("NOMAT", companyName.split(" ")[0]) // si juste "NOMAT" sans "GP"
    
    // Tagline
    .replaceAll("Votre partenaire de transport de confiance", tagline)
    .replaceAll("Colis sans frontières", cfg.tagline || tagline)
    
    // Prix
    .replaceAll("20$/KG", `${pricePerKg}$/${currency === "USD" ? "KG" : currency}`)
    .replaceAll("À partir de 20$/KG", `À partir de ${pricePerKg}$/${currency === "USD" ? "KG" : currency}`)
    .replaceAll('"pricePerKg":20', `"pricePerKg":${pricePerKg}`)
    
    // Téléphones
    .replaceAll("+221 77 341 98 04", phone || "+221 77 000 00 00")
    .replaceAll("+221773419804", (phone || "").replace(/[^+\d]/g, ""))
    .replaceAll("+221 77 556 12 66", phone2 || "")
    .replaceAll("+221775561266", (phone2 || "").replace(/[^+\d]/g, ""))
    .replaceAll("+1 (514) 346 15 38", phoneCanada || "")
    .replaceAll("+15143461538", (phoneCanada || "").replace(/[^+\d]/g, ""))
    
    // Email
    .replaceAll("contact@nomatgp.example", email || "contact@" + slug + ".com")
    
    // Adresses dépôts
    .replaceAll("Ouest Foire, Dakar, Sénégal", depotAddress)
    .replaceAll("Ouest Foire, Dakar", depotAddress.split(",")[0] || depotAddress)
    .replaceAll("373 rue Savard, Chicoutimi, QC, Canada", depotAddressCanada)
    .replaceAll("373 rue Savard, Chicoutimi, QC", depotAddressCanada.split(", Canada")[0] || depotAddressCanada)

    // WhatsApp links
    .replaceAll("wa.me/221773419804", phone ? `wa.me/${phone.replace(/[^+\d]/g, "").replace("+", "")}` : "#")
    .replaceAll("wa.me/15143461538", phoneCanada ? `wa.me/${phoneCanada.replace(/[^+\d]/g, "").replace("+", "")}` : "#");

  // Si le tenant a un logo personnalisé, remplace le logo
  if (cfg.logoUrl) {
    html = html.replaceAll('src="logo-nomat-gp.png"', `src="${cfg.logoUrl}"`);
  }

  // Ajoute un badge "Propulsé par NOMAT GP SaaS" avant </body>
  html = html.replace(
    "</body>",
    `<div style="position:fixed;bottom:0;left:0;right:0;text-align:center;padding:6px;font-size:10px;background:rgba(0,0,0,0.7);color:#fff;z-index:9999;">
      Propulsé par <a href="${baseUrl}/" style="color:#f59e0b;text-decoration:none;font-weight:bold;">NOMAT GP SaaS</a>
    </div></body>`
  );

  // Renvoie le HTML personnalisé
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60"); // cache 1 min
  return res.status(200).send(html);
}
