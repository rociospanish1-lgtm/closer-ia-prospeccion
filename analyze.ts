import { createHmac, timingSafeEqual } from "crypto";
import https from "https";
import http from "http";

const UA_NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function hostPermitido(host: string) {
  return !(
    !host.includes(".") ||
    host === "localhost" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host)
  );
}

// Plan B cuando fetch() falla por la conexión segura: muchas webs de negocios pequeños tienen el
// certificado mal montado o un servidor antiguo. Un navegador las abre igual; Node no. Aquí solo
// LEEMOS el HTML público (no se envía nada sensible), así que se acepta esa conexión imperfecta.
function descargaTolerante(url: string, finLimite: number, saltos = 0): Promise<{ status: number; html: string }> {
  return new Promise((resolve, reject) => {
    if (saltos > 4) return reject(new Error("demasiadas redirecciones"));
    const u = new URL(url);
    if (!hostPermitido(u.hostname)) return reject(new Error("URL no válida"));
    const restante = finLimite - Date.now();
    if (restante <= 0) return reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.get(
      url,
      {
        headers: { "User-Agent": UA_NAVEGADOR, Accept: "text/html,*/*" },
        timeout: restante,
        ...(u.protocol === "https:"
          ? { rejectUnauthorized: false, minVersion: "TLSv1" as const, ciphers: "DEFAULT:@SECLEVEL=0" }
          : {}),
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve(descargaTolerante(new URL(res.headers.location, url).toString(), finLimite, saltos + 1));
        }
        let total = 0;
        const trozos: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          total += c.length;
          if (total > 3_000_000) { resolve({ status, html: Buffer.concat(trozos).toString("utf8") }); req.destroy(); return; }
          trozos.push(c);
        });
        res.on("end", () => resolve({ status, html: Buffer.concat(trozos).toString("utf8") }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "AbortError" })));
    req.on("error", reject);
  });
}

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

// ---------- Ficha de personalización ----------
// Saca de la web datos concretos (tratamientos, precios, horario, cómo se reserva, tipo de WhatsApp)
// para que los mensajes hablen de ESE negocio y no sean genéricos.

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&ntilde;": "ñ", "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú", "&Ntilde;": "Ñ",
  "&euro;": "€", "&quot;": '"', "&#39;": "'", "&rsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&ndash;": "–",
};

function textoVisible(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => ENTIDADES[m] ?? " ")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}

// [nombre que sale en el mensaje, patrón sobre texto sin acentos]
const TRATAMIENTOS: [string, RegExp][] = [
  // Estética
  ["depilación láser", /depilacion (con )?laser|laser de diodo|depilacion definitiva/g],
  ["limpieza facial", /limpieza facial|higiene facial/g],
  ["Hydrafacial", /hydrafacial|hydra ?facial/g],
  ["tratamiento con bótox", /botox|toxina botulinica/g],
  ["ácido hialurónico", /acido hialuronico|hialuronico/g],
  ["aumento de labios", /aumento de labios|relleno de labios|perfilado de labios/g],
  ["mesoterapia", /mesoterapia/g],
  ["peeling", /peeling/g],
  ["radiofrecuencia", /radiofrecuencia/g],
  ["presoterapia", /presoterapia/g],
  ["criolipólisis", /criolipolisis/g],
  ["microblading", /microblading/g],
  ["micropigmentación", /micropigmentacion/g],
  ["lifting de pestañas", /lifting de pestanas/g],
  ["extensiones de pestañas", /extensiones de pestanas/g],
  ["hilos tensores", /hilos tensores/g],
  ["dermapen", /dermapen|microneedling/g],
  ["carboxiterapia", /carboxiterapia/g],
  ["maderoterapia", /maderoterapia/g],
  ["eliminación de tatuajes", /eliminacion de tatuajes/g],
  ["manicura", /manicura/g],
  ["pedicura", /pedicura/g],
  // Dental
  ["ortodoncia invisible", /ortodoncia invisible|invisalign/g],
  ["ortodoncia", /ortodoncia/g],
  ["implantes dentales", /implantes? dental(es)?|implantologia/g],
  ["blanqueamiento dental", /blanqueamiento/g],
  ["limpieza dental", /limpieza dental|higiene dental|limpieza bucal/g],
  ["carillas", /carillas/g],
  ["endodoncia", /endodoncia/g],
  // Fisio / salud
  ["fisioterapia", /fisioterapia/g],
  ["osteopatía", /osteopatia/g],
  ["suelo pélvico", /suelo pelvico/g],
  ["punción seca", /puncion seca/g],
  ["pilates", /pilates/g],
  // Peluquería
  ["balayage", /balayage/g],
  ["alisado de keratina", /keratina|alisado/g],
  ["mechas", /mechas/g],
];

const PLATAFORMAS_RESERVA: [string, RegExp][] = [
  ["Doctoralia", /doctoralia/], ["Treatwell", /treatwell/], ["Booksy", /booksy/], ["Fresha", /fresha/],
  ["Calendly", /calendly\.com/], ["SimplyBook", /simplybook/], ["Cal.com", /cal\.com/], ["Setmore", /setmore/],
  ["Reservio", /reservio/], ["Bookeo", /bookeo/], ["Acuity", /acuityscheduling/], ["Flowww", /flowww/],
  ["Koibox", /koibox/], ["Timp", /timp\.pro|timpapp/], ["Bewe", /bewe\.io|bewe\.co/]
];

const CHATS: [string, RegExp][] = [
  ["Tidio", /tidio/], ["Crisp", /crisp\.chat/], ["Intercom", /intercom/], ["Tawk.to", /tawk\.to/],
  ["LiveChat", /livechatinc/], ["Zendesk", /zdassets|zendesk/], ["HubSpot", /js\.hs-scripts|hubspot.*conversations/],
  ["ManyChat", /manychat/], ["Landbot", /landbot/], ["Chatbase", /chatbase/], ["Botpress", /botpress/],
];

const WIDGETS_WHATSAPP = /joinchat|wa-widget|getbutton\.io|elfsight.*whatsapp|superlemon|wati\.io|whatsapp-button|click-to-chat|ht-ctc/;

export function extraerFicha(html: string) {
  const h = html.toLowerCase();
  const texto = textoVisible(html);
  const plano = sinAcentos(texto);

  const titulo = (html.match(/<title>([^<]{3,120})<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();

  // Tratamientos ordenados por número de menciones
  const encontrados = TRATAMIENTOS
    .map(([nombre, re]) => ({ nombre, n: (plano.match(re) || []).length }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n);
  let tratamientos = encontrados.map((t) => t.nombre);
  if (tratamientos.includes("ortodoncia invisible")) tratamientos = tratamientos.filter((t) => t !== "ortodoncia");
  tratamientos = tratamientos.slice(0, 4);

  // Primer precio que aparece cerca de un tratamiento detectado
  let precio: { tratamiento: string; euros: number } | null = null;
  for (const nombre of tratamientos) {
    const re = TRATAMIENTOS.find(([n]) => n === nombre)![1];
    const src = new RegExp(`(?:${re.source})[^\\n€]{0,60}?(\\d{2,4})(?:[.,]\\d{2})?\\s?(?:€|eur)`);
    const m = plano.match(src);
    if (m) {
      const euros = Number(m[m.length - 1]);
      if (euros >= 15 && euros <= 5000) { precio = { tratamiento: nombre, euros }; break; }
    }
  }

  // Horario tal como aparece en la web
  const hora = String.raw`\d{1,2}(?:[:.h]\d{2})?\s?h?`;
  const reHorario = new RegExp(String.raw`(lunes|l\s?-\s?v|lun\.?|de lunes)[^\n]{0,80}?${hora}\s?(?:-|–|a|hasta)\s?${hora}[^\n]{0,60}`, "i");
  const mh = texto.match(reHorario) || sinAcentos(texto).match(reHorario);
  const horario = mh ? mh[0].replace(/\s+/g, " ").trim().slice(0, 140) : "";
  const abreSabado = /sabados?\s*:?[^\n]{0,30}?\d{1,2}[:.h]\d{2}/.test(plano) && !/sabados?\s*:?\s*cerrado/.test(plano);
  const abreDomingo = /domingos?\s*:?[^\n]{0,30}?\d{1,2}[:.h]\d{2}/.test(plano) && !/domingos?\s*:?\s*cerrado/.test(plano);

  // Cómo se pide cita
  const plataforma = PLATAFORMAS_RESERVA.find(([, re]) => re.test(h))?.[0] || "";
  const reservaEmbebida = /<iframe[^>]+(reserv|booking|cita|agenda)/.test(h) || /type=["'](date|datetime-local|time)["']/.test(h);
  const hayFormulario = /<form[\s>]/.test(h) && /<textarea|type=["']email["']|name=["'](nombre|name|telefono|phone)/.test(h);
  const textoCita = /pedir cita|reservar cita|solicitar cita|reserva tu cita|pide tu cita|cita previa/.test(plano);
  const reservaTipo: "plataforma" | "formulario" | "telefono" | "ninguna" =
    plataforma || reservaEmbebida ? "plataforma" : hayFormulario ? "formulario" : textoCita ? "telefono" : "ninguna";

  // WhatsApp y chat
  const tieneWa = /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com/.test(h) || WIDGETS_WHATSAPP.test(h);
  const whatsappTipo: "widget" | "enlace" | "" = !tieneWa ? "" : WIDGETS_WHATSAPP.test(h) ? "widget" : "enlace";
  const chat = CHATS.find(([, re]) => re.test(h))?.[0] || "";

  const instagram = (h.match(/instagram\.com\/([a-z0-9._]{2,30})/)?.[1] || "").replace(/^(p|reel|explore)$/, "");

  return {
    titulo,
    tratamientos,
    precio,
    horario,
    abreSabado,
    abreDomingo,
    reservaTipo,
    plataforma: plataforma || (reservaEmbebida ? "reserva integrada" : ""),
    whatsappTipo,
    chat,
    instagram,
    pocoTexto: texto.length < 600, // web montada con JavaScript: hay que revisarla a mano
  };
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
    if (!hostPermitido(new URL(url).hostname)) return res.status(400).json({ error: "URL no válida" });
  } catch {
    return res.status(400).json({ error: "URL no válida" });
  }

  try {
    const start = Date.now();
    const finLimite = start + 15000;
    let status = 0;
    let html = "";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": UA_NAVEGADOR, Accept: "text/html,*/*" },
      });
      clearTimeout(timer);
      status = response.status;
      html = await response.text();
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      // fetch falla en bloque ("fetch failed") con certificados mal montados o servidores antiguos.
      console.error("analyze fetch failed:", url, e?.cause?.code || e?.cause?.message || e?.message);
      const r = await descargaTolerante(url, finLimite);
      status = r.status;
      html = r.html;
    }
    if (status < 200 || status >= 300) {
      return res.status(502).json({
        error: `La web respondió ${status} (puede bloquear bots). Revísala a mano y marca las casillas.`,
      });
    }
    const segundos = (Date.now() - start) / 1000;
    const h = html.toLowerCase();

    const ficha = extraerFicha(html);
    const tieneWhatsapp = ficha.whatsappTipo !== "";
    const tieneReservas = ficha.reservaTipo === "plataforma";
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
      detalle: { tieneWhatsapp, tieneReservas, tienePixel, tieneSchema, imagenes: imgs, status },
      ficha,
    });
  } catch (error: any) {
    return res.status(502).json({
      error:
        error?.name === "AbortError"
          ? "La web tardó más de 12s en responder (ya es un dato: web lenta)."
          : "No se pudo abrir la web ni con el plan B (" + (error?.code || error?.message || "error") + "). Revísala a mano y marca las casillas.",
    });
  }
}
