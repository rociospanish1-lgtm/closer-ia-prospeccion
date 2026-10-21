import { createHmac, timingSafeEqual } from "crypto";

// Lee un perfil público de Instagram (cuenta de empresa o creador) con la API oficial de Meta:
// "Business Discovery" de la Instagram Graph API. Instagram bloquea la lectura directa de perfiles
// desde servidores, así que no se hace scraping: o API oficial, o la bio pegada a mano en la app.
//
// Variables en Vercel:
//   IG_ACCESS_TOKEN  token de larga duración de TU cuenta de Instagram profesional (vinculada a una página de Facebook)
//   IG_USER_ID       id de TU cuenta de Instagram profesional (no el del negocio que analizas)
//   IG_GRAPH_VERSION opcional, por defecto v23.0

const COOKIE = "closer_session";

function sign(secret: string, exp: number) {
  return createHmac("sha256", secret).update(String(exp)).digest("hex");
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

function normalizarUsuario(s: string): string {
  const t = (s || "").trim();
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  const u = (m ? m[1] : t.replace(/^@/, "")).toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(u)) return "";
  if (["p", "reel", "reels", "explore", "stories", "accounts"].includes(u)) return "";
  return u;
}

export default async function handler(req: any, res: any) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const usuario = normalizarUsuario(String(req.body?.usuario || ""));
  if (!usuario) return res.status(400).json({ error: "Escribe el usuario de Instagram (@usuario o el enlace del perfil)." });

  const token = process.env.IG_ACCESS_TOKEN;
  const igId = process.env.IG_USER_ID;
  const version = process.env.IG_GRAPH_VERSION || "v23.0";
  if (!token || !igId) {
    return res.status(501).json({
      modo: "manual",
      error: "La lectura automática de Instagram no está configurada. Pega la bio del perfil abajo y analízala.",
    });
  }

  const campos =
    `business_discovery.username(${usuario})` +
    `{username,name,biography,website,followers_count,media_count,` +
    `media.limit(12){caption,timestamp,like_count,comments_count}}`;
  const url =
    `https://graph.facebook.com/${version}/${encodeURIComponent(igId)}` +
    `?fields=${encodeURIComponent(campos)}&access_token=${encodeURIComponent(token)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data: any = await r.json();

    if (!r.ok || data?.error) {
      const code = data?.error?.code;
      const sub = data?.error?.error_subcode;
      console.error("instagram business_discovery:", usuario, code, sub, data?.error?.message);
      if (code === 190) {
        return res.status(502).json({ modo: "manual", error: "El token de Instagram ha caducado o no es válido. Renueva IG_ACCESS_TOKEN en Vercel. Mientras, pega la bio abajo." });
      }
      if (code === 4 || code === 17 || code === 32 || code === 613) {
        return res.status(429).json({ modo: "manual", error: "Instagram ha limitado las consultas por ahora. Espera un rato o pega la bio abajo." });
      }
      // 110 / 100: el perfil no existe o es una cuenta personal (la API solo lee cuentas de empresa o creador)
      return res.status(404).json({
        modo: "manual",
        error: `No se puede leer @${usuario} por la API: no existe o es una cuenta personal. Pega la bio abajo.`,
      });
    }

    const bd = data.business_discovery || {};
    const posts = (bd.media?.data || []).map((p: any) => ({
      caption: String(p.caption || ""),
      fecha: p.timestamp || undefined,
      comentarios: typeof p.comments_count === "number" ? p.comments_count : undefined,
      likes: typeof p.like_count === "number" ? p.like_count : undefined,
    }));

    return res.status(200).json({
      usuario: bd.username || usuario,
      nombre: bd.name || "",
      bio: bd.biography || "",
      enlace: bd.website || "",
      seguidores: typeof bd.followers_count === "number" ? bd.followers_count : undefined,
      publicaciones: typeof bd.media_count === "number" ? bd.media_count : undefined,
      posts,
      fuente: "api",
    });
  } catch (e: any) {
    return res.status(502).json({
      modo: "manual",
      error: e?.name === "AbortError" ? "Instagram tardó demasiado en responder. Pega la bio abajo." : "No se pudo consultar Instagram. Pega la bio abajo.",
    });
  }
}
