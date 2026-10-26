// Analizador de perfil de Instagram.
// Recibe los datos en bruto (de la API de Meta o de la bio pegada a mano) y saca lo que sirve para el mensaje:
// cómo se pide cita desde Instagram, qué hay en el enlace de la bio, tratamientos, precios y actividad.
// Regla: solo afirmamos lo que está en el perfil. Lo que no se ve, no se dice.

export interface IgPost {
  caption: string;
  fecha?: string; // ISO
  comentarios?: number;
  likes?: number;
}

export interface IgCrudo {
  usuario: string;
  nombre?: string;
  bio: string;
  enlace?: string;
  seguidores?: number;
  publicaciones?: number;
  posts?: IgPost[];
  fuente: 'api' | 'manual';
}

export type IgEnlaceTipo = 'reserva' | 'whatsapp' | 'agregador' | 'web' | 'ninguno';

export interface IgFicha {
  usuario: string;
  nombre: string;
  fuente: 'api' | 'manual';
  seguidores: number | null;
  publicaciones: number | null;
  enlace: string;
  enlaceTipo: IgEnlaceTipo;
  plataforma: string; // Treatwell, Booksy... si se ve en la bio o el enlace
  citaPorDM: boolean; // la bio o las publicaciones piden escribir por privado para cita/info/precio
  telefonoEnBio: boolean;
  whatsappEnBio: boolean;
  tratamientos: string[];
  precio: { tratamiento: string; euros: number } | null;
  publicaciones30d: number | null; // solo con datos de la API
  diasUltimaPublicacion: number | null;
  mediaComentarios: number | null;
  postsConInfoPorDM: number; // publicaciones que dicen "info por privado", "precio por DM"...
  // Ofertas, bonos y descuentos publicados (bio + publicaciones). Opcional: los leads antiguos no lo tienen.
  ofertas?: { texto: string; fecha?: string }[];
  tiposOferta?: string[];
  descuentoMax?: number | null;
  postsConOferta?: number | null; // de las publicaciones leídas, cuántas anuncian una oferta
  analizadoEl: string;
}

// ---------- Ofertas, bonos y descuentos ----------
// Mismo criterio que en api/analyze.ts (la web). Solo se recoge lo que el negocio publica tal cual.
const RE_OFERTA =
  /\b(ofertas?|promo|promos|promocion|promociones|descuentos?|dto|rebajas?|bonos?|packs?|2x1|3x2|black ?friday|cyber ?monday|precios? especial(es)?|gratis|gratuit[ao]s?|de regalo|regalamos|cupon(es)?|codigo (de )?descuento|codigo promocional|sesion de prueba|financiacion|financiamos|sin intereses)\b/;
const RUIDO_OFERTA = /cookie|politica de privacidad|aviso legal|envios? gratis|newsletter|suscrib/;
const TIPOS_OFERTA: [string, RegExp][] = [
  ['descuento', /oferta|promo|descuento|dto|rebaja|friday|monday|especial|cupon|codigo|\d\s?%/],
  ['bono', /bono|pack/],
  ['2x1', /2x1|3x2/],
  ['regalo / gratis', /gratis|gratuit|regalo|regalamos|sesion de prueba/],
  ['financiación', /financ|sin intereses/],
];

export function detectarOfertas(texto: string) {
  const frases = (texto || '')
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 8);
  const vistos = new Set<string>();
  const ofertas: string[] = [];
  const tipos = new Set<string>();
  let descuentoMax: number | null = null;
  for (const f of frases) {
    const p = sinAcentos(f);
    const m = p.match(RE_OFERTA);
    if (!m || RUIDO_OFERTA.test(p)) continue;
    for (const [tipo, re] of TIPOS_OFERTA) if (re.test(p)) tipos.add(tipo);
    for (const pm of p.matchAll(/(\d{1,2})\s?%/g)) {
      const n = Number(pm[1]);
      if (n >= 5 && n <= 90) descuentoMax = Math.max(descuentoMax ?? 0, n);
    }
    let frag = f;
    if (frag.length > 160) {
      const ini = Math.max(0, (m.index || 0) - 60);
      frag = (ini > 0 ? '…' : '') + f.slice(ini, ini + 160).trim() + '…';
    }
    const clave = sinAcentos(frag).replace(/[^a-z0-9]/g, '');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    ofertas.push(frag);
  }
  return { ofertas: ofertas.slice(0, 6), tiposOferta: [...tipos], descuentoMax };
}

// Lectura para valorar el lead a partir de sus ofertas
export function valoracionOfertas(n: number, tipos: string[] = []): string {
  if (!n) return 'No se ven ofertas ni bonos publicados: el argumento es la atención del día a día, no los picos de consultas.';
  const bonos = tipos.includes('bono') ? ' y vende bonos (clientas que vuelven y preguntan por sesiones pendientes)' : '';
  return `Hace promociones${bonos}: invierte en atraer clientas y cada campaña trae un pico de preguntas de precio y disponibilidad. Buen encaje para el agente; menciona la oferta en el mensaje.`;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// [nombre que sale en el mensaje, patrón sobre texto sin acentos]. Mismo criterio que el analizador de webs.
const TRATAMIENTOS: [string, RegExp][] = [
  ['depilación láser', /depilacion (con )?laser|laser de diodo|depilacion definitiva/g],
  ['limpieza facial', /limpieza facial|higiene facial/g],
  ['Hydrafacial', /hydrafacial|hydra ?facial/g],
  ['tratamiento con bótox', /botox|toxina botulinica/g],
  ['ácido hialurónico', /acido hialuronico|hialuronico/g],
  ['aumento de labios', /aumento de labios|relleno de labios|perfilado de labios/g],
  ['mesoterapia', /mesoterapia/g],
  ['peeling', /peeling/g],
  ['radiofrecuencia', /radiofrecuencia/g],
  ['presoterapia', /presoterapia/g],
  ['criolipólisis', /criolipolisis/g],
  ['microblading', /microblading/g],
  ['micropigmentación', /micropigmentacion/g],
  ['lifting de pestañas', /lifting de pestanas/g],
  ['extensiones de pestañas', /extensiones de pestanas/g],
  ['hilos tensores', /hilos tensores/g],
  ['dermapen', /dermapen|microneedling/g],
  ['carboxiterapia', /carboxiterapia/g],
  ['maderoterapia', /maderoterapia/g],
  ['eliminación de tatuajes', /eliminacion de tatuajes/g],
  ['manicura', /manicura/g],
  ['pedicura', /pedicura/g],
  ['ortodoncia invisible', /ortodoncia invisible|invisalign/g],
  ['implantes dentales', /implantes? dental(es)?|implantologia/g],
  ['blanqueamiento dental', /blanqueamiento/g],
  ['fisioterapia', /fisioterapia/g],
  ['balayage', /balayage/g],
  ['alisado de keratina', /keratina|alisado/g],
  ['mechas', /mechas/g],
];

const PLATAFORMAS: [string, RegExp][] = [
  ['Doctoralia', /doctoralia/], ['Treatwell', /treatwell/], ['Booksy', /booksy/], ['Fresha', /fresha/],
  ['Calendly', /calendly/], ['SimplyBook', /simplybook/], ['Setmore', /setmore/], ['Reservio', /reservio/],
  ['Flowww', /flowww/], ['Koibox', /koibox/], ['Timp', /timp\.pro|timpapp/], ['Bewe', /bewe\.io|bewe\.co/],
];

const AGREGADORES = /linktr\.ee|linktree|beacons\.ai|linkin\.bio|lnk\.bio|taplink|bio\.link|campsite\.bio|later\.com|msha\.ke/;
const WHATSAPP = /wa\.me|api\.whatsapp|whatsapp\.com|wa\.link/;

// "pide cita por MD", "info por privado", "reservas por DM", "precio por mensaje directo"...
const POR_DM =
  /(cita|citas|reserva|reservas|info|informacion|precio|precios|presupuesto)[^\n.]{0,30}\b(md|dm|privado|mensaje directo|mensaje privado|directo)\b|\b(md|dm|privado)\b[^\n.]{0,25}(cita|reserva|info|precio)/;

// "1.234", "12,5 mil", "3k", "1,2 M"
export function numeroIg(s: string): number | null {
  const m = sinAcentos(s).trim().match(/^([\d.,]+)\s*(mil|k|m|mill|millones)?$/);
  if (!m) return null;
  const suf = m[2] || '';
  let base = m[1];
  if (suf) base = base.replace(',', '.');
  else base = base.replace(/[.,]/g, '');
  const n = Number(base);
  if (!isFinite(n)) return null;
  if (suf === 'mil' || suf === 'k') return Math.round(n * 1000);
  if (suf) return Math.round(n * 1_000_000);
  return n;
}

// Acepta "@usuario", "usuario", "instagram.com/usuario" o la URL completa
export function normalizarUsuario(s: string): string {
  const t = (s || '').trim();
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  const u = (m ? m[1] : t.replace(/^@/, '')).toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(u)) return '';
  if (['p', 'reel', 'reels', 'explore', 'stories', 'accounts'].includes(u)) return '';
  return u;
}

// Convierte lo que se copia de un perfil (bio, enlace, contadores y, si se quiere, textos de publicaciones)
export function crudoDesdeTexto(usuario: string, texto: string): IgCrudo {
  const t = texto.replace(/\r/g, '');
  const seg = t.match(/([\d.,]+\s*(?:mil|k|m)?)\s+seguidores/i);
  const pub = t.match(/([\d.,]+\s*(?:mil|k)?)\s+publicaciones/i);
  // Un enlace de verdad: empieza por http/www, lleva ruta, o acaba en un dominio conocido.
  // Así no confundimos el propio @usuario.con.puntos con una web.
  const TLD = /\.(es|com|net|org|eu|ee|io|me|link|bio|ai|co|app|site|page|online|shop|store|info|cat|clinic|beauty)$/i;
  const urls = (t.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/gi) || [])
    .filter((u) => !/instagram\.com/i.test(u) && !/^\d/.test(u) && u.toLowerCase().replace(/^@/, '') !== usuario)
    .filter((u) => /^(https?:\/\/|www\.)/i.test(u) || /\//.test(u) || TLD.test(u));
  return {
    usuario,
    bio: t,
    enlace: urls[0] || '',
    seguidores: seg ? numeroIg(seg[1]) ?? undefined : undefined,
    publicaciones: pub ? numeroIg(pub[1]) ?? undefined : undefined,
    fuente: 'manual',
  };
}

function tratamientosDe(plano: string) {
  let lista = TRATAMIENTOS
    .map(([nombre, re]) => ({ nombre, n: (plano.match(re) || []).length }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((t) => t.nombre);
  return lista.slice(0, 4);
}

function precioDe(plano: string, tratamientos: string[]) {
  for (const nombre of tratamientos) {
    const re = TRATAMIENTOS.find(([n]) => n === nombre)![1];
    const m = plano.match(new RegExp(`(?:${re.source})[^\\n€]{0,60}?(\\d{2,4})(?:[.,]\\d{2})?\\s?(?:€|eur)`));
    if (m) {
      const euros = Number(m[m.length - 1]);
      if (euros >= 15 && euros <= 5000) return { tratamiento: nombre, euros };
    }
  }
  return null;
}

export function analizarInstagram(c: IgCrudo, ahora = Date.now()): IgFicha {
  const posts = c.posts || [];
  const textoBio = sinAcentos(c.bio || '');
  const textoPosts = sinAcentos(posts.map((p) => p.caption || '').join('\n'));
  const enlace = (c.enlace || '').trim();
  const enl = sinAcentos(enlace);
  const todo = `${textoBio}\n${enl}`;

  const plataforma = PLATAFORMAS.find(([, re]) => re.test(todo))?.[0] || '';
  const enlaceTipo: IgEnlaceTipo = !enlace
    ? 'ninguno'
    : PLATAFORMAS.some(([, re]) => re.test(enl))
      ? 'reserva'
      : WHATSAPP.test(enl)
        ? 'whatsapp'
        : AGREGADORES.test(enl)
          ? 'agregador'
          : 'web';

  const postsConInfoPorDM = posts.filter((p) => POR_DM.test(sinAcentos(p.caption || ''))).length;
  const citaPorDM = POR_DM.test(textoBio) || postsConInfoPorDM >= 2;

  const tratamientos = tratamientosDe(`${textoBio}\n${textoPosts}`);
  const precio = precioDe(`${textoBio}\n${textoPosts}`, tratamientos);

  const fechas = posts.map((p) => (p.fecha ? Date.parse(p.fecha) : NaN)).filter((n) => isFinite(n));
  const dia = 86_400_000;
  const publicaciones30d = fechas.length ? fechas.filter((f) => ahora - f <= 30 * dia).length : null;
  const diasUltimaPublicacion = fechas.length ? Math.floor((ahora - Math.max(...fechas)) / dia) : null;
  const conComentarios = posts.filter((p) => typeof p.comentarios === 'number');
  const mediaComentarios = conComentarios.length
    ? Math.round(conComentarios.reduce((s, p) => s + (p.comentarios || 0), 0) / conComentarios.length)
    : null;

  // Ofertas: primero las de las publicaciones (con su fecha), luego las de la bio
  const ofertas: { texto: string; fecha?: string }[] = [];
  const tiposOferta = new Set<string>();
  let descuentoMax: number | null = null;
  let postsConOferta = 0;
  const sumar = (texto: string, fecha?: string) => {
    const r = detectarOfertas(texto);
    r.tiposOferta.forEach((t) => tiposOferta.add(t));
    if (r.descuentoMax !== null) descuentoMax = Math.max(descuentoMax ?? 0, r.descuentoMax);
    // Una línea por publicación (con su fecha); en la bio, una por oferta
    const trozos = fecha ? [r.ofertas.join(' ').slice(0, 240)].filter(Boolean) : r.ofertas;
    trozos.forEach((o) => { if (!ofertas.some((x) => x.texto === o)) ofertas.push({ texto: o, fecha }); });
    return r.ofertas.length > 0;
  };
  for (const p of posts) if (sumar(p.caption || '', p.fecha)) postsConOferta++;
  sumar(c.bio || '');

  return {
    usuario: c.usuario,
    nombre: c.nombre || '',
    fuente: c.fuente,
    seguidores: typeof c.seguidores === 'number' ? c.seguidores : null,
    publicaciones: typeof c.publicaciones === 'number' ? c.publicaciones : null,
    enlace,
    enlaceTipo,
    plataforma,
    citaPorDM,
    telefonoEnBio: /(\+34\s?)?[6789]\d{2}[\s.]?\d{3}[\s.]?\d{3}/.test(c.bio || ''),
    whatsappEnBio: /whatsapp|wasap|wsp/.test(textoBio) || WHATSAPP.test(enl),
    tratamientos,
    precio,
    publicaciones30d,
    diasUltimaPublicacion,
    mediaComentarios,
    postsConInfoPorDM,
    ofertas: ofertas.slice(0, 6),
    tiposOferta: [...tiposOferta],
    descuentoMax,
    postsConOferta: posts.length ? postsConOferta : null,
    analizadoEl: new Date(ahora).toISOString(),
  };
}

// Resumen en una línea por dato, para la pantalla del analizador
export function resumenIg(f: IgFicha): string[] {
  const l: string[] = [];
  if (f.seguidores !== null) l.push(`Seguidores: ${f.seguidores.toLocaleString('es-ES')}${f.publicaciones !== null ? ` · publicaciones: ${f.publicaciones.toLocaleString('es-ES')}` : ''}`);
  l.push(`Enlace de la bio: ${f.enlace ? `${f.enlace} (${({ reserva: `reserva online${f.plataforma ? ' · ' + f.plataforma : ''}`, whatsapp: 'abre WhatsApp', agregador: 'página de enlaces: ábrela y mira si se puede reservar', web: 'su web', ninguno: '' } as const)[f.enlaceTipo]})` : 'no tiene'}`);
  l.push(`Cita desde Instagram: ${f.citaPorDM ? 'piden escribir por privado (DM)' : f.enlaceTipo === 'reserva' ? 'por el enlace de reservas' : f.telefonoEnBio ? 'teléfono en la bio' : 'no se indica'}`);
  if (f.postsConInfoPorDM) l.push(`Publicaciones que mandan al privado para info/precio: ${f.postsConInfoPorDM}`);
  if (f.tratamientos.length) l.push(`Tratamientos: ${f.tratamientos.join(', ')}`);
  if (f.precio) l.push(`Precio visto: ${f.precio.tratamiento} · ${f.precio.euros} €`);
  if (f.ofertas) {
    const n = f.ofertas.length;
    l.push(`Ofertas y bonos: ${n ? `${f.postsConOferta ? `${f.postsConOferta} publicaciones con promo · ` : ''}${(f.tiposOferta || []).join(', ')}${f.descuentoMax ? ` · hasta ${f.descuentoMax} %` : ''}` : 'no se ven'}`);
  }
  if (f.publicaciones30d !== null) l.push(`Actividad: ${f.publicaciones30d} publicaciones en 30 días${f.diasUltimaPublicacion !== null ? ` · última hace ${f.diasUltimaPublicacion} d` : ''}${f.mediaComentarios !== null ? ` · ${f.mediaComentarios} comentarios de media` : ''}`);
  return l;
}
