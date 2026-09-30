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

// Analiza la web de un negocio y devuelve los huecos detectados (ids de CHECKLIST_ITEMS).
export default async function handler(req: any, res: any) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  let url: string = String(req.body?.url || "").trim();
  if (!url) return res.status(400).json({ error: "Falta la URL de la web" });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (
      !host.includes(".") ||
      host === "localhost" ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    ) {
      return res.status(400).json({ error: "URL no válida" });
    }
  } catch {
    return res.status(400).json({ error: "URL no válida" });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const start = Date.now();
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CloserBot/1.0)" },
    });
    clearTimeout(timer);
    if (!response.ok) {
      return res.status(502).json({
        error: `La web respondió ${response.status} (puede bloquear bots). Revísala a mano y marca los checks.`,
      });
    }
    const html = await response.text();
    const segundos = (Date.now() - start) / 1000;
    const h = html.toLowerCase();

    const tieneWhatsapp = /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com|joinchat|wa-widget/.test(h);
    const tieneReservas =
      /calendly\.com|doctoralia|treatwell|simplybook|bookeo|setmore|reservio|acuityscheduling|fresha|cal\.com|booksy|agenda online|reserva online|reservar cita|pedir cita|solicitar cita|book now|reserva tu cita/.test(h);
    const tienePixel =
      /fbq\(|connect\.facebook\.net|googletagmanager\.com|gtag\(|google-analytics\.com|analytics\.tiktok\.com|hotjar/.test(h);
    const tieneSchema =
      /application\/ld\+json/.test(h) && /localbusiness|dentist|medicalbusiness|beautysalon|healthandbeautybusiness|physician|restaurant/.test(h);

    const imgs = (html.match(/<img\b/gi) || []).length;
    const sinLazy = (html.match(/<img\b(?![^>]*loading=["']lazy)/gi) || []).length;
    const imagenesPesadas = imgs > 15 && sinLazy > 10;
    const lenta = segundos > 3 || html.length > 1_500_000;

    const checks: string[] = [];
    if (!tieneReservas) checks.push("sin_reservas");
    if (!tienePixel) checks.push("sin_pixel");
    if (lenta) checks.push("lenta");
    if (!tieneWhatsapp) checks.push("sin_whatsapp");
    if (!tieneSchema) checks.push("sin_schema");
    if (imagenesPesadas) checks.push("imagenes");

    const tieneTitle = /<title>[^<]{10,}<\/title>/.test(h);
    const tieneDesc = /<meta[^>]+name=["']description["']/.test(h);
    const tieneH1 = /<h1[\s>]/.test(h);
    const seoScore = Math.max(
      1,
      Math.min(
        10,
        3 + (tieneTitle ? 2 : 0) + (tieneDesc ? 2 : 0) + (tieneH1 ? 1 : 0) + (tieneSchema ? 2 : 0)
      )
    );

    return res.status(200).json({
      checks,
      seoScore,
      velocidad: `${segundos.toFixed(1)}s`,
      detalle: { tieneWhatsapp, tieneReservas, tienePixel, tieneSchema, imagenes: imgs, status: response.status },
    });
  } catch (error: any) {
    return res.status(502).json({
      error:
        error?.name === "AbortError"
          ? "La web tardó más de 12s en responder (ya es un dato: web lenta)."
          : "No se pudo abrir la web: " + (error?.message || "error"),
    });
  }
}
