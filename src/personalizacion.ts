// Mensajes personalizados a partir del análisis de la web y del perfil de Instagram.
// Regla: si el mensaje se pudiera mandar a otro negocio cambiando solo el nombre, está mal.
import type { IgFicha } from './instagram';

export interface Ficha {
  titulo: string;
  tratamientos: string[];
  precio: { tratamiento: string; euros: number } | null;
  horario: string;
  abreSabado: boolean;
  abreDomingo: boolean;
  reservaTipo: 'plataforma' | 'formulario' | 'telefono' | 'ninguna';
  plataforma: string;
  whatsappTipo: 'widget' | 'enlace' | '';
  chat: string;
  instagram: string;
  // Ofertas, bonos y descuentos publicados en la web. Opcional: los leads antiguos no lo tienen.
  ofertas?: string[];
  tiposOferta?: string[];
  descuentoMax?: number | null;
  pocoTexto: boolean;
}

export interface DatosLead {
  nombre: string;
  nicho: string;
  rating: string;
  reviews: string;
  web?: string;
  ficha?: Ficha;
  ig?: IgFicha;
}

// De dónde sale el dato que citamos: cambia cómo se escribe el mensaje
export type Canal = 'web' | 'instagram' | 'google';

export interface Firma {
  nombre: string;
  agencia: string;
  telefono: string;
  email: string;
}

export interface Gancho {
  id: string;
  frase: string; // evidencia + lo que le pasa a su cliente
  concreto: boolean; // false si no hay un dato verificable detrás
  origen: Canal;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mayus = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const unir = (xs: string[]) => (xs.length <= 1 ? xs[0] || '' : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);

export function persona(nicho: string) {
  const n = sinAcentos(nicho);
  if (/estetica|belleza|peluquer|unas|spa|beauty|depilacion|pestan/.test(n)) return 'una clienta';
  if (/dental|dentist|fisio|medic|podolog|psicolog|nutricion|clinica/.test(n)) return 'un paciente';
  return 'un cliente';
}

function sector(nicho: string) {
  const n = sinAcentos(nicho);
  if (/estetica|belleza|spa|beauty|depilacion|pestan|unas/.test(n)) return 'centros de estética';
  if (/peluquer/.test(n)) return 'peluquerías';
  if (/dental|dentist/.test(n)) return 'clínicas dentales';
  if (/fisio/.test(n)) return 'centros de fisioterapia';
  if (/clinica|medic/.test(n)) return 'clínicas';
  return 'negocios que trabajan con cita';
}

export function tratamientoPorDefecto(nicho: string) {
  const n = sinAcentos(nicho);
  if (/dental|dentist/.test(n)) return 'una revisión';
  if (/fisio/.test(n)) return 'una sesión de fisioterapia';
  if (/peluquer/.test(n)) return 'una cita de peluquería';
  if (/estetica|belleza/.test(n)) return 'un tratamiento';
  return 'una cita';
}

function momento(f?: Ficha) {
  if (!f) return 'un domingo por la noche';
  if (!f.abreDomingo) return 'un domingo por la noche';
  return 'a las once de la noche';
}

function cuandoAbren(f?: Ficha) {
  return f?.horario ? ` (vuestro horario: ${f.horario})` : '';
}

function ganchosWeb(lead: DatosLead, checks: string[], trat: string): Gancho[] {
  const f = lead.ficha;
  const m = momento(f);
  const lista: Gancho[] = [];
  const g = (id: string, concreto: boolean, frase: string) => lista.push({ id, concreto, frase, origen: 'web' });

  // Web montada con JavaScript: no se puede leer bien, así que no afirmamos nada que no hayamos visto
  if (f && f.pocoTexto) {
    g('revisar', false, `[abre su web y escribe aquí lo que has visto: cómo se pide cita, si hay WhatsApp y qué pasa si alguien escribe por ${trat} fuera de horario]`);
    return lista;
  }

  if (f) {
    if (f.reservaTipo === 'formulario') g('formulario', true, `para pedir cita hay un formulario, pero no se puede elegir día ni hora; si alguien lo rellena ${m} para ${trat}, no sabe hasta el día siguiente si tiene hueco`);
    else if (f.reservaTipo === 'telefono') g('telefono', true, `para pedir cita hay que llamar; si alguien se decide por ${trat} ${m}, no puede reservar hasta que abráis${cuandoAbren(f)}`);
    else if (f.reservaTipo === 'ninguna') g('sin_reserva', true, `no he encontrado una forma de reservar cita online; si alguien quiere ${trat} ${m}, tiene que esperar a que abráis${cuandoAbren(f)}`);

    if (f.chat) g('chat', false, `tenéis ${f.chat} en la web; habría que ver si contesta solo a las dudas sobre ${trat} y si deja la cita reservada`);
    else if (f.whatsappTipo) g('whatsapp_manual', true, `tenéis el botón de WhatsApp${f.plataforma ? ` y reservas con ${f.plataforma}` : ''}, pero si alguien pregunta por ${trat} ${m} (precio, sesiones, si duele), la respuesta depende de que alguien del equipo lo vea al día siguiente`);
    else g('sin_whatsapp', true, `no he visto WhatsApp; quien tenga una duda sobre ${trat} ${m} tiene que esperar a llamar en horario`);

    if (f.horario && !f.abreSabado) g('horario', true, `abrís ${f.horario}; todo lo que llegue el fin de semana se queda esperando al lunes`);
    if (f.precio) g('precio', true, `con ${f.precio.tratamiento} a ${f.precio.euros} €, una sola cita que no se pierda a la semana son unos ${f.precio.euros * 4} € al mes`);
  } else {
    // Sin ficha (lead antiguo o análisis manual): usamos los checks marcados
    if (checks.includes('sin_reservas')) g('sin_reserva', true, `no he encontrado una forma de reservar cita online; si alguien quiere ${trat} ${momento()}, tiene que esperar a que abráis`);
    if (checks.includes('sin_whatsapp')) g('sin_whatsapp', true, `no he visto WhatsApp; quien tenga una duda sobre ${trat} ${momento()} tiene que esperar a llamar en horario`);
  }
  return lista;
}

function ganchosInstagram(lead: DatosLead, trat: string): Gancho[] {
  const ig = lead.ig;
  if (!ig) return [];
  const m = momento(lead.ficha);
  const lista: Gancho[] = [];
  const g = (id: string, concreto: boolean, frase: string) => lista.push({ id: 'ig_' + id, concreto, frase, origen: 'instagram' });

  if (ig.citaPorDM) {
    g('dm', true, ig.postsConInfoPorDM >= 2
      ? `en vuestras publicaciones pedís que os escriban por privado para info y precios; si alguien pregunta por ${trat} ${m}, no tiene respuesta hasta que alguien del equipo abra Instagram`
      : `en la bio pedís que os escriban por privado para pedir cita; si alguien escribe por ${trat} ${m}, no tiene respuesta hasta que alguien del equipo abra Instagram`);
  }
  if (ig.enlaceTipo === 'ninguno') g('sin_enlace', true, `en la bio de Instagram no hay ningún enlace para reservar; quien os descubre por una publicación y quiere ${trat} tiene que escribir o llamar y esperar`);
  else if (ig.enlaceTipo === 'whatsapp') g('wa', true, `el enlace de la bio lleva a WhatsApp; si alguien pregunta por ${trat} ${m}, la respuesta depende de que alguien lo vea al día siguiente`);
  else if (ig.enlaceTipo === 'reserva' && !ig.citaPorDM) g('reserva', true, `tenéis ${ig.plataforma || 'reserva online'} en la bio, pero esa herramienta no contesta las dudas de antes de reservar (precio, sesiones, si duele); esas os llegan por privado y esperan a que alguien las vea`);
  else if (ig.enlaceTipo === 'agregador') g('agregador', false, `el enlace de la bio es una página de enlaces; [ábrela y escribe aquí si se puede reservar desde ahí o solo lleva a WhatsApp/teléfono]`);

  if (ig.precio && !lead.ficha?.precio) g('precio', true, `con ${ig.precio.tratamiento} a ${ig.precio.euros} €, una sola cita que no se pierda a la semana son unos ${ig.precio.euros * 4} € al mes`);
  return lista;
}

// Elige el gancho principal (el fallo que más citas hace perder, con su evidencia) y los siguientes.
// El canal decide qué evidencia va primero: si escribes por Instagram, el dato de Instagram.
export function ganchos(lead: DatosLead, checks: string[], trat: string, canal: Canal = 'web'): Gancho[] {
  const web = ganchosWeb(lead, checks, trat);
  const ig = ganchosInstagram(lead, trat);
  let lista = canal === 'instagram' ? [...ig, ...web] : [...web, ...ig];

  if (!lead.web && !lead.ficha) {
    lista.push({ id: 'sin_web', concreto: true, origen: 'google', frase: `en Google no aparece vuestra web; quien os busca para ${trat} solo ve el teléfono y tiene que llamar en horario` });
  }

  // Sin repetir el mismo dato (p. ej. el precio visto en web y en Instagram)
  const vistos = new Set<string>();
  lista = lista.filter((x) => {
    const clave = x.id.replace(/^ig_/, '');
    if (clave === 'precio' && vistos.has('precio')) return false;
    vistos.add(clave);
    return true;
  });
  // Primero lo que se puede comprobar; las notas para revisar a mano, al final (orden estable)
  lista = [...lista.filter((x) => x.concreto), ...lista.filter((x) => !x.concreto)];

  if (lista.length === 0) {
    lista.push({ id: 'generico', concreto: false, origen: canal, frase: `me gustaría saber qué pasa con las consultas sobre ${trat} que os llegan fuera de horario` });
  }
  return lista;
}

export function lineaPositiva(lead: DatosLead, canal: Canal = 'web') {
  const ig = lead.ig;
  if (canal === 'instagram' && ig) {
    if (ig.publicaciones30d !== null && ig.publicaciones30d >= 6) return `Publicáis a menudo en Instagram (${ig.publicaciones30d} publicaciones en el último mes).`;
    if (ig.seguidores !== null && ig.seguidores >= 1000) return `Tenéis ${ig.seguidores.toLocaleString('es-ES')} seguidores en Instagram.`;
  }
  const r = Number(String(lead.rating).replace(',', '.'));
  const n = Number(lead.reviews);
  if (r >= 4.3 && n >= 15) return `Tenéis un ${String(r).replace('.', ',')} en Google con ${n} reseñas, así que la gente quiere venir.`;
  const t = lead.ficha?.tratamientos?.length ? lead.ficha.tratamientos : ig?.tratamientos || [];
  if (t.length >= 2) return `He visto que trabajáis ${unir(t.slice(0, 2))}.`;
  return '';
}

// Consejo que la clínica puede aplicar sola, sin nosotros. Primer contacto = dar valor, no vender.
const CONSEJOS: Record<string, string> = {
  formulario: 'Se arregla fácil poniendo un calendario de reservas donde se elija día y hora al momento',
  telefono: 'Se arregla fácil con un enlace de reservas online, donde se elige día y hora al momento',
  sin_reserva: 'Se arregla fácil con un enlace de reservas online, donde se elige día y hora al momento',
  whatsapp_manual: 'Algo que ayuda mucho y es gratis: un mensaje automático en WhatsApp Business con precios, horario y cómo pedir cita',
  wa: 'Algo que ayuda mucho y es gratis: un mensaje automático en WhatsApp Business con precios, horario y cómo pedir cita',
  sin_whatsapp: 'Con un botón de WhatsApp en la web, quien tiene una duda os escribe en vez de irse a otro sitio',
  horario: 'Un mensaje automático de fuera de horario, diciendo cuándo contestáis y cómo reservar, ayuda a que no se vayan a otro sitio',
  dm: 'Algo que ayuda mucho: activar las respuestas automáticas de Instagram con precios y cómo pedir cita',
  sin_enlace: 'Se arregla fácil poniendo en la bio un enlace para reservar',
  reserva: 'Unas historias destacadas con las dudas típicas (precio, sesiones, si duele) quitan muchas de esas preguntas',
  sin_web: 'Algo que ayuda mucho: poner en la ficha de Google un enlace para pedir cita',
};

export function consejo(angulo: string, frase: string): string {
  const id = (angulo || '').replace(/^ig_/, '');
  if (CONSEJOS[id]) return CONSEJOS[id];
  // Gancho editado a mano: lo deducimos del texto
  const f = sinAcentos(frase);
  if (/formulario/.test(f)) return CONSEJOS.formulario;
  if (/hay que llamar|reservar cita online|no puede reservar/.test(f)) return CONSEJOS.sin_reserva;
  if (/no he visto whatsapp/.test(f)) return CONSEJOS.sin_whatsapp;
  if (/whatsapp/.test(f)) return CONSEJOS.whatsapp_manual;
  if (/privado|instagram/.test(f)) return CONSEJOS.dm;
  if (/maps|google/.test(f)) return 'Algo que ayuda mucho: completar bien la ficha de Google (categoría, horario, fotos y enlace para pedir cita)';
  return '';
}

// Algo bueno y real del negocio, dicho en tono cercano (solo si hay dato)
function lineaCercana(lead: DatosLead, canal: Canal) {
  const ig = lead.ig;
  if (canal === 'instagram' && ig && ig.publicaciones30d !== null && ig.publicaciones30d >= 6) return '¡Qué bien lleváis el Instagram!';
  const r = Number(String(lead.rating).replace(',', '.'));
  const n = Number(lead.reviews);
  if (r >= 4.3 && n >= 15) return `He visto que tenéis un ${String(r).replace('.', ',')} en Google con ${n} reseñas, ¡enhorabuena!`;
  return '';
}

export interface Mensajes {
  email: string;
  dm: string;
  dmSiResponde: string;
  dmOferta: string;
  llamada: string;
  seguimiento1: string;
  seguimiento2: string;
  vozInicial: string;
  vozSeguimiento: string;
  vozCierre: string;
  calidad: { ok: boolean; texto: string }[];
}

export const DM_MAX = 500;

export function construirMensajes(opts: {
  lead: DatosLead;
  frase: string; // gancho principal (editable por Rocío)
  frase2: string; // segundo dato para el email y el seguimiento
  tratamiento: string;
  tratamientoPropio: boolean;
  contacto: string;
  firma: Firma;
  canal?: Canal;
  angulo?: string; // id del gancho principal, para elegir el consejo
}): Mensajes {
  const { lead, frase, tratamiento: trat, tratamientoPropio, contacto, firma } = opts;
  const canal: Canal = opts.canal || 'web';
  const frase2 = opts.frase2 && opts.frase2.trim() !== frase.trim() ? opts.frase2.trim() : '';
  const nom = lead.nombre;
  const quien = persona(lead.nicho);
  const saludo = contacto ? `Hola ${contacto}` : 'Hola';
  const otros = (lead.ficha?.tratamientos || lead.ig?.tratamientos || []).filter((t) => t !== trat).slice(0, 2);
  const tratsLista = unir([trat, ...otros]);
  // Evita "de Agencia de automatización, una agencia de automatización"
  const presentacion = /automatizaci/i.test(firma.agencia) ? `${firma.agencia} de Sevilla` : `${firma.agencia}, una agencia de automatización de Sevilla`;

  // Dónde lo hemos visto, dicho con naturalidad
  const fuente = canal === 'instagram' ? 'vuestro Instagram' : canal === 'google' ? 'vuestra ficha de Google' : 'vuestra web';

  // Oferta: revisión gratuita de 15 min (diagnóstico primero, automatización después).
  // Nunca "monto agentes que contestan solos" ni cifras de resultados.
  const juntas = quien === 'una clienta' ? 'juntas' : 'juntos';
  const fraseLimpia = frase.trim().replace(/\.$/, '');

  // PRIMER CONTACTO = dar valor, no vender: un fallo suyo + un consejo que pueden aplicar solos.
  // Sin oferta, sin "¿hablamos?", sin hablar de la agencia. La oferta llega solo si preguntan a qué te dedicas.
  const tip = consejo(opts.angulo || '', frase);
  // Dónde está el fallo que citamos (no por dónde escribimos)
  const ang = opts.angulo || '';
  const fuenteDato = ang.startsWith('ig_') ? 'vuestro Instagram' : ang === 'sin_web' ? 'vuestra ficha de Google' : ang ? 'vuestra web' : fuente;
  const tipFrase = tip ? ` ${tip}.` : '';
  const cercana = lineaCercana(lead, canal);
  const firmaCercana = `${firma.nombre}${firma.telefono ? `\n${firma.telefono}` : ''}`;

  const email = `Asunto: Un detalle de ${fuenteDato}

${contacto ? `Hola, ${contacto}` : 'Hola'}:

Soy ${firma.nombre}, de Sevilla. Mirando ${fuenteDato} me fijé en un detalle: ${fraseLimpia}.${tipFrase}

Os lo comento por si os sirve.

Un saludo,
${firmaCercana}`;

  // Primer mensaje por Instagram o WhatsApp (mismo enfoque, distinto arranque)
  const dm = canal === 'instagram'
    ? `¡Hola${contacto ? ', ' + contacto : ''}!${cercana ? ' ' + cercana : ''} Por cierto, mirando ${fuenteDato} vi que ${fraseLimpia}.${tipFrase} Os lo comento por si no lo sabíais. ¡Mucho ánimo!`
    : `Hola${contacto ? ', ' + contacto : ''}, soy ${firma.nombre}, de Sevilla. Estuve mirando ${fuenteDato} y me fijé en un detalle: ${fraseLimpia}.${tipFrase} Os lo comento por si os sirve. ¡Un saludo y mucho ánimo!`;

  // Si contestan: curiosidad, que te cuenten su problema real. Nada de oferta todavía.
  const dmSiResponde = `¡Me alegro de que os sirva${contacto ? ', ' + contacto : ''}! ¿Y cómo lo lleváis ahora? ¿Os escribe mucha gente preguntando antes de reservar?`;

  // Solo si te preguntan a qué te dedicas
  const dmOferta = `Me dedico justo a esto: ayudo a ${sector(lead.nicho)} de Sevilla a que no se pierdan consultas ni citas. Si os apetece, hago una revisión de 15 minutos, sin coste, para ver cómo os llegan las consultas (Instagram, WhatsApp, web) y qué se podría automatizar, como contestar las dudas sobre ${tratsLista} y dar cita fuera de horario. Lo que necesita a una persona lo sigue llevando vuestro equipo. ¿Te viene mejor el martes o el jueves por la mañana?`;

  const llamada = `Guion de llamada: ${nom}

1. Saludo: "Hola, ¿hablo con ${contacto || nom}? Soy ${firma.nombre}, de ${presentacion}. ¿Tienes un minuto?"
2. Motivo (${fuente}): "He estado mirando ${fuente} y ${fraseLimpia}."
3. Pregunta: "¿Cómo lo estáis llevando ahora? ¿Quién contesta lo que entra por la noche o el fin de semana?"
4. Qué hago: "Reviso cómo os llegan las consultas (web, WhatsApp, Instagram), dónde se pierden y qué tareas se pueden automatizar, como contestar las dudas sobre ${tratsLista} y dar cita fuera de horario. Lo que necesita a una persona lo sigue llevando vuestro equipo."
5. Cierre: "Son 15 minutos, sin coste. ¿Te viene mejor el martes o el jueves por la mañana?"`;

  // Seguimientos: otro consejo útil, sin pedir nada
  const tip2 = frase2 ? consejo('', frase2) : '';
  const seguimiento1 = frase2
    ? `${saludo}, soy ${firma.nombre} otra vez. Mirando ${fuenteDato} vi otra cosa que os puede venir bien: ${frase2.replace(/\.$/, '')}.${tip2 ? ' ' + tip2 + '.' : ''} ¡Un saludo!`
    : `${saludo}, soy ${firma.nombre} otra vez. ¿Os sirvió lo que os comenté? Si tenéis cualquier duda con eso, me decís. ¡Un saludo!`;

  const seguimiento2 = `${saludo}, solo quería saber si os sirvió lo que os comenté de ${nom}. No os escribo más; si algún día os viene bien una mano con las citas, aquí me tenéis. ¡Mucho ánimo!`;

  const vozInicial = `Hola ${contacto || nom}, soy ${firma.nombre} de ${presentacion} [pausa] He estado mirando ${fuente} y ${fraseLimpia} [pausa corta] Hago una revisión de quince minutos, sin coste, para ver dónde se pierden consultas y qué se puede automatizar, como dar cita fuera de horario [respiración] ¿Te interesa que lo revisemos ${juntas}?`;
  const vozSeguimiento = `Hola ${contacto ? contacto + ', ' : ''}soy ${firma.nombre} de ${firma.agencia} [pausa] Te escribo por lo de ${nom} [respiración] ${frase2 ? mayus(frase2) + ' [pausa corta] ' : ''}Si queréis, lo vemos en quince minutos y os enseño qué se puede mejorar [pausa] ¿Te viene bien esta semana?`;
  const vozCierre = `Hola ${contacto ? contacto + ', ' : ''}soy ${firma.nombre} de ${firma.agencia} [pausa] Solo quería cerrar el tema de ${nom} [respiración] Si algún día queréis revisar cómo os llegan las consultas sobre ${trat}, me escribís y lo vemos [pausa corta] Si no os encaja, lo dejamos aquí. Gracias por tu tiempo.`;

  const pendiente = /me gustaría saber qué pasa con las consultas|\[/;
  const calidad = [
    { ok: true, texto: `Nombre del negocio: ${nom}` },
    { ok: tratamientoPropio, texto: tratamientoPropio ? `Tratamiento suyo: ${trat}` : 'Sin tratamiento suyo: escribe uno que ofrezcan de verdad' },
    { ok: !pendiente.test(frase), texto: /\[/.test(frase) ? 'Falta el dato: completa el gancho del paso 2' : pendiente.test(frase) ? 'Gancho genérico: analiza su web o su Instagram' : 'Dato concreto suyo en el mensaje' },
    { ok: canal !== 'instagram' || !!lead.ig, texto: canal === 'instagram' ? (lead.ig ? `Dato sacado de su Instagram (@${lead.ig.usuario})` : 'Escribes por Instagram sin haber analizado su perfil') : canal === 'web' ? (lead.ficha ? 'Dato sacado de su web' : 'Dato de su web marcado a mano') : 'Dato sacado de su ficha de Google' },
    { ok: !!frase2 && !/\[/.test(frase2), texto: frase2 ? 'Segundo dato para el email y el seguimiento' : 'Falta un segundo dato (email y seguimiento quedan más flojos)' },
    { ok: dm.length <= DM_MAX, texto: `Primer DM de ${dm.length} caracteres (máx. ${DM_MAX})` },
  ];

  return { email, dm, dmSiResponde, dmOferta, llamada, seguimiento1, seguimiento2, vozInicial, vozSeguimiento, vozCierre, calidad };
}
