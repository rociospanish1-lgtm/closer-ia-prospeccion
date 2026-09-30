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

export default async function handler(req: any, res: any) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { nicho, ciudad, keyword } = req.body || {};

    if (!nicho || !ciudad) {
      return res.status(400).json({
        error: "Faltan nicho y ciudad",
      });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "Falta configurar GOOGLE_PLACES_API_KEY en las variables de entorno de Vercel.",
      });
    }

    const textQuery = [nicho, keyword, ciudad]
      .filter(Boolean)
      .join(" ");

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery,
          languageCode: "es",
          regionCode: "ES",
          pageSize: 20,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Error al consultar Google Places",
      });
    }

    const leads = (data.places || []).map((place: any) => ({
      id: place.id,
      name: place.displayName?.text || "",
      web: place.websiteUri || "",
      phone: place.nationalPhoneNumber || "",
      address: place.formattedAddress || "",
      rating: place.rating || 0,
      reviews: place.userRatingCount || 0,
      estado: "nuevo",
      nicho,
      ciudad,
    }));

    return res.status(200).json({
      leads,
      total: leads.length,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Error interno del servidor",
    });
  }
}
