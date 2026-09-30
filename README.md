# CLOSER V4.1

Herramienta de prospección para Agencia de Agentes IA: busca negocios locales en Google Maps, analiza su web, genera mensajes y guía el cierre.

## Puesta en marcha
```bash
npm install
npm run dev      # solo frontend; /api/search requiere Vercel
npx vercel dev   # frontend + API
```

## Variables de entorno
Copia `.env.example` a `.env` y rellena `GOOGLE_PLACES_API_KEY` (Google Places API New). En producción, configúrala en Vercel.

## Datos
Los leads se guardan en `localStorage` del navegador (clave `closer_leads`).
