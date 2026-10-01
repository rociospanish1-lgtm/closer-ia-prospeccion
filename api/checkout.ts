import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "closer_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function sign(secret: string, exp: number) {
  return createHmac("sha256", secret).update(String(exp)).digest("hex");
}

export function makeCookie(secret: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${COOKIE}=${exp}.${sign(secret, exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function passwordOk(input: string, secret: string) {
  const a = createHmac("sha256", "k").update(input).digest();
  const b = createHmac("sha256", "k").update(secret).digest();
  return timingSafeEqual(a, b);
}

// Devuelve true si la petición está autorizada. Si no, responde y devuelve false.
export function requireAuth(req: any, res: any): boolean {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    res.status(500).json({ error: "Falta configurar APP_PASSWORD en las variables de entorno de Vercel." });
    return false;
  }
  const raw: string = req.headers?.cookie || "";
  const match = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(COOKIE + "="));
  const value = match ? match.slice(COOKIE.length + 1) : "";
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (exp && sig && exp > Date.now() / 1000) {
    const good = sign(secret, exp);
    if (sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return true;
  }
  res.status(401).json({ error: "No autorizado" });
  return false;
}

// Crea una sesión de Stripe Checkout y devuelve la URL de pago.
export default async function handler(req: any, res: any) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return res.status(500).json({
      error: "Falta configurar STRIPE_SECRET_KEY en las variables de entorno de Vercel.",
    });
  }

  const { importe, concepto, email, mensualidad, leadId } = req.body || {};
  const euros = Number(importe);
  if (!euros || euros <= 0 || euros > 20000 || !concepto) {
    return res.status(400).json({ error: "Importe o concepto no válidos" });
  }

  const cuota = Number(mensualidad) || 0;
  const origin =
    process.env.PUBLIC_URL || (req.headers?.origin as string) || `https://${req.headers?.host}`;

  const p = new URLSearchParams();
  p.set("mode", cuota > 0 ? "subscription" : "payment");
  p.set("success_url", `${origin}/gracias.html`);
  p.set("cancel_url", `${origin}/cancelado.html`);
  p.set("locale", "es");
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", "eur");
  p.set("line_items[0][price_data][unit_amount]", String(Math.round(euros * 100)));
  p.set("line_items[0][price_data][product_data][name]", String(concepto).slice(0, 120));
  if (cuota > 0) {
    p.set("line_items[1][quantity]", "1");
    p.set("line_items[1][price_data][currency]", "eur");
    p.set("line_items[1][price_data][unit_amount]", String(Math.round(cuota * 100)));
    p.set("line_items[1][price_data][recurring][interval]", "month");
    p.set("line_items[1][price_data][product_data][name]", "Automatización de WhatsApp (cuota mensual)");
  } else {
    p.set("invoice_creation[enabled]", "true");
  }
  if (email) p.set("customer_email", String(email));
  if (leadId) p.set("client_reference_id", String(leadId).slice(0, 200));
  p.set("payment_method_types[0]", "card");

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: p.toString(),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Error de Stripe" });
    }
    return res.status(200).json({ url: data.url, id: data.id });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Error creando el pago" });
  }
}
