import { makeCookie, clearCookie, passwordOk, requireAuth } from "./_auth.js";

export default async function handler(req: any, res: any) {
  // GET: ¿hay sesión válida?
  if (req.method === "GET") {
    if (!requireAuth(req, res)) return;
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearCookie());
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    return res.status(500).json({ error: "Falta configurar APP_PASSWORD en las variables de entorno de Vercel." });
  }
  const pass = String(req.body?.password || "");
  if (!passwordOk(pass, secret)) {
    await new Promise((r) => setTimeout(r, 1000));
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }
  res.setHeader("Set-Cookie", makeCookie(secret));
  return res.status(200).json({ ok: true });
}
