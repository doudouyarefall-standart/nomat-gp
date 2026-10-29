// lib/db-saas.js — Multi-tenant KV helpers pour la plateforme SaaS NOMAT GP
// Chaque tenant (GP operator) a ses données préfixées par tenant:{tenantId}:

import { kv } from "@vercel/kv";

const TENANT_PREFIX = "saas:tenant:";
const TENANT_SLUG_INDEX = "saas:tenant:slug:"; // slug → tenantId
const TENANT_ALL_INDEX = "saas:tenants:all"; // sorted set
const TENANT_BOOKING_PREFIX = "saas:tenant:"; // tenant:{id}:booking:{ref}

// === TENANT MANAGEMENT ===

export async function createTenant(tenant) {
  if (!tenant.id) throw new Error("tenant.id required");
  if (!tenant.slug) throw new Error("tenant.slug required");
  
  // Vérifie que le slug est unique
  const existing = await kv.get(TENANT_SLUG_INDEX + tenant.slug);
  if (existing) throw new Error("Slug déjà pris: " + tenant.slug);

  const now = new Date().toISOString();
  const full = {
    ...tenant,
    plan: tenant.plan || "trial",
    status: tenant.status || "active",
    createdAt: now,
    updatedAt: now,
    config: tenant.config || getDefaultConfig(tenant.name),
  };

  await kv.set(TENANT_PREFIX + tenant.id, JSON.stringify(full));
  await kv.set(TENANT_SLUG_INDEX + tenant.slug, tenant.id);
  await kv.zadd(TENANT_ALL_INDEX, { score: Date.now(), member: tenant.id });
  return full;
}

export async function getTenantById(id) {
  const data = await kv.get(TENANT_PREFIX + id);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getTenantBySlug(slug) {
  const id = await kv.get(TENANT_SLUG_INDEX + slug);
  if (!id) return null;
  return getTenantById(id);
}

export async function updateTenant(id, updates) {
  const existing = await getTenantById(id);
  if (!existing) throw new Error("Tenant not found");
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(TENANT_PREFIX + id, JSON.stringify(updated));
  return updated;
}

export async function listTenants(limit = 100) {
  const ids = await kv.zrange(TENANT_ALL_INDEX, 0, limit - 1, { rev: true });
  if (!ids?.length) return [];
  const tenants = await Promise.all(ids.map((id) => getTenantById(id)));
  return tenants.filter(Boolean);
}

// === TENANT BOOKINGS ===

export async function saveTenantBooking(tenantId, booking) {
  const key = `${TENANT_BOOKING_PREFIX}${tenantId}:booking:${booking.reference}`;
  const trackKey = `${TENANT_BOOKING_PREFIX}${tenantId}:tracking:${booking.trackingNumber}`;
  const allKey = `${TENANT_BOOKING_PREFIX}${tenantId}:bookings:all`;
  
  await kv.set(key, JSON.stringify(booking));
  await kv.set(trackKey, booking.reference);
  await kv.zadd(allKey, { score: Date.now(), member: booking.reference });
  return booking;
}

export async function getTenantBookingByRef(tenantId, reference) {
  const data = await kv.get(`${TENANT_BOOKING_PREFIX}${tenantId}:booking:${reference}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getTenantBookingByTracking(tenantId, trackingNumber) {
  const ref = await kv.get(`${TENANT_BOOKING_PREFIX}${tenantId}:tracking:${trackingNumber}`);
  if (!ref) return null;
  return getTenantBookingByRef(tenantId, ref);
}

export async function listTenantBookings(tenantId, limit = 50) {
  const refs = await kv.zrange(`${TENANT_BOOKING_PREFIX}${tenantId}:bookings:all`, 0, limit - 1, { rev: true });
  if (!refs?.length) return [];
  const bookings = await Promise.all(refs.map((ref) => getTenantBookingByRef(tenantId, ref)));
  return bookings.filter(Boolean);
}

// === AUTH (simple session) ===

export async function createSession(tenantId, email) {
  const sessionId = generateSessionId();
  const session = {
    sessionId,
    tenantId,
    email,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
  };
  await kv.set(`saas:session:${sessionId}`, JSON.stringify(session), { ex: 7 * 24 * 60 * 60 });
  return session;
}

export async function getSession(sessionId) {
  if (!sessionId) return null;
  const data = await kv.get(`saas:session:${sessionId}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

// === HELPERS ===

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateTenantId() {
  return 't_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

function getDefaultConfig(name) {
  return {
    companyName: name,
    tagline: "Votre partenaire de transport de confiance",
    pricePerKg: 20,
    currency: "USD",
    routes: [
      { origin: "Dakar", originCountry: "Sénégal", destinations: ["New York", "Montréal"] },
    ],
    departureDays: ["Mardi", "Jeudi"],
    phone: "",
    phone2: "",
    phoneCanada: "",
    email: "",
    depotAddress: "",
    depotAddressCanada: "",
    primaryColor: "#f59e0b", // gold
    accentColor: "#dc2626", // red
    logoUrl: null,
  };
}

export async function isKvConfigured() {
  try {
    await kv.ping();
    return true;
  } catch {
    return false;
  }
}
