import { requireAuth } from "./_auth";

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
