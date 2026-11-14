import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "closer_session";

function sign(secret: string, exp: number) {
  return createHmac("sha256", secret).update(String(exp)).digest("hex");
}

// Devuelve true si la petición está autorizada. Si no, responde y devuelve false.
function requireAuth(req: any, res: any): boolean {
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

// Reseñas de Google de un negocio (Places API New) y, de ellas, las malas (3★ o menos).
// Límite de Google: la API solo entrega 5 reseñas por negocio (las "más relevantes"), no todas.
// Por eso también se devuelve el enlace a la ficha de Maps para ver el resto ordenadas por puntuación.
// No se devuelve el nombre de quien escribe la reseña: no hace falta para prospectar.
export default async function handler(req: any, res: any) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar GOOGLE_PLACES_API_KEY en las variables de entorno de Vercel." });
  }

  const { placeId, nombre, direccion } = req.body || {};
  const id = typeof placeId === "string" && /^[A-Za-z0-9_-]{10,}$/.test(placeId) ? placeId : "";
  if (!id && !nombre) return res.status(400).json({ error: "Falta el negocio (placeId o nombre)." });

  try {
    let place: any = null;
    if (id) {
      const r = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=es&regionCode=ES`, {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "id,rating,userRatingCount,reviews,googleMapsUri" },
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d?.error?.message || "Error al consultar Google" });
      place = d;
    } else {
      // Leads añadidos a mano: se busca el negocio por nombre + dirección
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.rating,places.userRatingCount,places.reviews,places.googleMapsUri",
        },
        body: JSON.stringify({ textQuery: [nombre, direccion].filter(Boolean).join(" "), languageCode: "es", regionCode: "ES", pageSize: 1 }),
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d?.error?.message || "Error al consultar Google" });
      place = d.places?.[0];
      if (!place) return res.status(404).json({ error: "No se encontró el negocio en Google Maps." });
    }

    const resenas = (place.reviews || []).map((rv: any) => ({
      estrellas: Number(rv.rating) || 0,
      texto: (rv.originalText?.text || rv.text?.text || "").trim(),
      hace: rv.relativePublishTimeDescription || "",
      fecha: rv.publishTime || "",
    }));
    const malas = resenas
      .filter((r: any) => r.estrellas > 0 && r.estrellas <= 3)
      .sort((a: any, b: any) => a.estrellas - b.estrellas);

    return res.status(200).json({
      placeId: place.id || id,
      rating: place.rating || 0,
      total: place.userRatingCount || 0,
      leidas: resenas.length,
      malas,
      mapsUrl: place.googleMapsUri || "",
      consultado: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Error interno del servidor" });
  }
}
