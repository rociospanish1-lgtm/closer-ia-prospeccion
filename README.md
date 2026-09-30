# CLOSER V4.1

Flujo completo de prospección: buscar negocios en Google Maps → analizar su web → mensajes (email/WhatsApp/llamada) → gestión de objeciones → cobro con Stripe.

## Variables de entorno (Vercel > Settings > Environment Variables)
| Variable | Para qué |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Búsqueda de leads (Places API New activada en Google Cloud) |
| `STRIPE_SECRET_KEY` | Crear el checkout de pago (`sk_test_...` para probar, `sk_live_...` para cobrar) |
| `APP_PASSWORD` | Contraseña para entrar en la app. Obligatoria: protege la app y las rutas `/api` |
| `PUBLIC_URL` | Opcional. URL pública para las páginas de éxito/cancelación del pago |

## Despliegue
1. Importa el repo en Vercel (detecta Vite y `/api`).
2. Añade las variables y redespliega.

## Desarrollo local
```bash
npm install
cp .env.example .env   # rellena las claves
npx vercel dev
```

## Flujo
1. **Paso 1** Buscar por nicho + ciudad (datos reales de Google Maps). Los leads se guardan en el navegador (`localStorage`).
2. **Paso 2** "Analizar web automáticamente": detecta WhatsApp, reservas, píxel, schema local, imágenes y tiempo de carga (`/api/analyze`).
3. **Pasos 3-4** Mensajes y closer.
4. **Paso 5** Genera un Stripe Checkout (pago único + mensualidad opcional) con `/api/checkout` y lo envías al cliente. Tras pagar, va a `/gracias.html`.

Prueba antes el pago con `sk_test_` y la tarjeta `4242 4242 4242 4242`.
