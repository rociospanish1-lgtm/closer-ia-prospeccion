// Mensajes personalizados a partir del análisis de la web y del perfil de Instagram.
// Regla: si el mensaje se pudiera mandar a otro negocio cambiando solo el nombre, está mal.
//
// Método (neuroventa):
// - Primer contacto = LLAMADA. WhatsApp y email solo como seguimiento tras un "sí".
// - Cada texto escrito abre con una escena en presente (día, hora, lo que ve u oye) donde la
//   protagonista es la clienta de la clínica, construida con datos reales del análisis.
// - La clínica detecta sola el problema mediante preguntas; no se lo señalamos nosotros.
// - Cero lenguaje de anuncio, nada de "solución", "revolucionario" ni cifras o porcentajes inventados.
// - Firma: "Rocío Pineda", sin nombre de agencia.
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
  telefono: string;
  email: string;
}

export interface Gancho {
  id: string;
  frase: string; // escena en presente: lo que vive su clienta, con un dato real suyo
  concreto: boolean; // false si no hay un dato verificable detrás
  origen: Canal;
}

export const FIRMA_NOMBRE = 'Rocío Pineda';

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const unir = (xs: string[]) => (xs.length <= 1 ? xs[0] || '' : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);
const sinPunto = (s: string) => s.trim().replace(/[.\s]+$/, '');

export function persona(nicho: string) {
  const n = sinAcentos(nicho);
  if (/estetica|belleza|peluquer|unas|spa|beauty|depilacion|pestan/.test(n)) return 'una clienta';
  if (/dental|dentist|fisio|medic|podolog|psicolog|nutricion|clinica/.test(n)) return 'un paciente';
  return 'un cliente';
}

export function tratamientoPorDefecto(nicho: string) {
  const n = sinAcentos(nicho);
  if (/dental|dentist/.test(n)) return 'una revisión';
  if (/fisio/.test(n)) return 'una sesión de fisioterapia';
  if (/peluquer/.test(n)) return 'una cita de peluquería';
  if (/estetica|belleza/.test(n)) return 'un tratamiento';
  return 'una cita';
}

// Momentos concretos para las escenas. Solo usamos horas en las que la clínica está cerrada
// según su horario publicado; sin horario, domingo por la noche (ninguna clínica abre a esa hora).
function momentos(f?: Ficha) {
  const fuera = !f || !f.abreDomingo ? 'Domingo, 22:10' : !f.abreSabado ? 'Sábado, 21:30' : 'Martes, 22:40';
  const fuera2 = !f || !f.abreSabado ? 'Sábado, 16:45' : 'Jueves, 22:25';
  const cabina = 'Martes, 12:15';
  const finde = !f || !f.abreSabado ? 'Sábado, 11:30' : 'Domingo, 11:30';
  return { fuera, fuera2, cabina, finde };
}

const cuandoAbren = (f?: Ficha) => (f && !f.abreDomingo ? 'el lunes' : 'que abráis');

// Primera oferta, bono o descuento publicado (web o Instagram), recortada para que quepa en una frase
export function ofertaCorta(lead: DatosLead): string {
  const bruta = lead.ficha?.ofertas?.[0] || lead.ig?.ofertas?.[0]?.texto || '';
  let t = bruta.replace(/…/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+/u, '').replace(/[.:;,!¡\s]+$/, '');
  if (t.length > 70) {
    // "Bonos digitales: elige un tratamiento…" → "Bonos digitales"
    const dosPuntos = t.indexOf(':');
    if (dosPuntos >= 6 && dosPuntos <= 50) t = t.slice(0, dosPuntos);
    else {
      const corte = t.lastIndexOf(' ', 70);
      t = t.slice(0, corte > 30 ? corte : 70);
    }
  }
  // Nunca terminar en "por las", "de", "y"…
  const VACIAS = /\s+(a|al|con|de|del|el|en|la|las|los|lo|para|por|que|se|sin|su|sus|un|una|y|o|tu|tus)$/i;
  t = t.replace(/[,;:\s]+$/, '');
  while (VACIAS.test(t)) t = t.replace(VACIAS, '').replace(/[,;:\s]+$/, '');
  return t;
}

// Dato real que se cita en voz alta en la llamada ("he visto que…")
function anclaDato(lead: DatosLead, trat: string, tratamientoPropio: boolean): string {
  const f = lead.ficha;
  const of = ofertaCorta(lead);
  if (of) return `he visto que tenéis «${of}»`;
  if (f?.precio) return `he visto en vuestra web ${f.precio.tratamiento} a ${f.precio.euros} €`;
  if (f?.plataforma && f.plataforma !== 'reserva integrada') return `he visto que las citas las lleváis con ${f.plataforma}`;
  if (tratamientoPropio) return `he visto que trabajáis mucho ${trat}`;
  if (f?.horario) return `he visto que abrís ${f.horario}`;
  if (lead.ig) return `he estado viendo vuestro Instagram, @${lead.ig.usuario}`;
  return 'he visto vuestra ficha en Google';
}

function ganchosWeb(lead: DatosLead, checks: string[], trat: string): Gancho[] {
  const f = lead.ficha;
  const nom = lead.nombre;
  const { fuera, cabina, finde } = momentos(f);
  const abren = cuandoAbren(f);
  const lista: Gancho[] = [];
  const g = (id: string, concreto: boolean, frase: string) => lista.push({ id, concreto, frase, origen: 'web' });

  // Web montada con JavaScript: no se puede leer bien, así que no afirmamos nada que no hayamos visto
  if (f && f.pocoTexto) {
    g('revisar', false, `[abre su web y escribe aquí la escena: día y hora en que una clienta quiere ${trat}, por dónde lo intenta (WhatsApp, formulario, teléfono) y qué ve o qué oye en ese momento]`);
    return lista;
  }

  if (f) {
    const plat = f.plataforma && f.plataforma !== 'reserva integrada' ? f.plataforma : 'vuestra reserva online';
    // Oferta publicada: es el dato más personal. La escena dice lo que pasa al intentar reservarla.
    const of = ofertaCorta(lead);
    if (of) {
      const despues = f.reservaTipo === 'plataforma'
        ? `antes de entrar en ${plat}, quiere saber si es para ella. Pregunta y la respuesta espera hasta ${abren}.`
        : f.reservaTipo === 'formulario'
          ? `rellena el formulario, pulsa «enviar» y no sabe si tiene hueco hasta ${abren}.`
          : f.whatsappTipo
            ? `os escribe por WhatsApp y el mensaje se queda en gris hasta ${abren}.`
            : `tiene que esperar a llamar hasta ${abren}.`;
      g('oferta', true, `${fuera}. Una clienta ve en vuestra web «${of}» y le interesa: ${despues}`);
    }

    if (f.reservaTipo === 'formulario') g('formulario', true, `${fuera}. Una clienta rellena el formulario de ${nom} para ${trat}, pulsa «enviar» y se queda mirando la pantalla: no sabe si tiene hueco hasta ${abren}.`);
    else if (f.reservaTipo === 'telefono') g('telefono', true, `${cabina}. Estáis en cabina y el teléfono de ${nom} suena en recepción: es una clienta que quiere ${trat}. Nadie puede cogerlo.`);
    else if (f.reservaTipo === 'ninguna') g('sin_reserva', true, `${fuera}. Una clienta entra en la web de ${nom} para reservar ${trat}, busca dónde pedir cita y no lo encuentra. Cierra la pestaña.`);

    if (f.chat) g('chat', false, `[tienen ${f.chat} en la web: pruébalo y escribe aquí la escena de lo que ve una clienta que pregunta por ${trat} fuera de horario]`);
    else if (f.whatsappTipo) g('whatsapp_manual', true, f.plataforma
      ? `${fuera}. Una clienta duda si ${trat} es para ella. En vez de reservar en ${plat}, pulsa vuestro WhatsApp y pregunta. El mensaje se queda en gris hasta ${abren}.`
      : `${fuera}. Una clienta pulsa el botón de WhatsApp de ${nom} para preguntar por ${trat}. Escribe, envía y el mensaje se queda en gris hasta ${abren}.`);
    else g('sin_whatsapp', true, `${fuera}. Una clienta tiene una duda sobre ${trat}, busca un WhatsApp en la web de ${nom} y no lo hay. Para preguntar tiene que esperar a llamar ${abren === 'el lunes' ? 'el lunes' : 'en horario'}.`);

    if (f.horario && !f.abreSabado) g('horario', true, `${finde}. Una clienta quiere ${trat}, mira vuestro horario (${f.horario}) y lo deja para el lunes.`);
  } else {
    // Sin ficha (lead antiguo o análisis manual): usamos los checks marcados
    if (checks.includes('sin_reservas')) g('sin_reserva', true, `${fuera}. Una clienta entra en la web de ${nom} para reservar ${trat}, busca dónde pedir cita y no lo encuentra. Cierra la pestaña.`);
    if (checks.includes('sin_whatsapp')) g('sin_whatsapp', true, `${fuera}. Una clienta tiene una duda sobre ${trat}, busca un WhatsApp en la web de ${nom} y no lo hay. Para preguntar tiene que esperar a llamar en horario.`);
  }
  return lista;
}

function ganchosInstagram(lead: DatosLead, trat: string): Gancho[] {
  const ig = lead.ig;
  if (!ig) return [];
  const { fuera } = momentos(lead.ficha);
  const abren = cuandoAbren(lead.ficha);
  const lista: Gancho[] = [];
  const g = (id: string, concreto: boolean, frase: string) => lista.push({ id: 'ig_' + id, concreto, frase, origen: 'instagram' });

  const of = !lead.ficha?.ofertas?.length ? ofertaCorta(lead) : '';
  if (of) g('oferta', true, `${fuera}. Una clienta ve en vuestro Instagram «${of}», le interesa y os escribe por privado. El mensaje se queda sin leer hasta que alguien abre Instagram.`);

  if (ig.citaPorDM) {
    g('dm', true, `${fuera}. Una clienta ve una publicación vuestra de ${trat} y os escribe por privado, como pedís en ${ig.postsConInfoPorDM >= 2 ? 'las publicaciones' : 'la bio'}. El mensaje se queda sin leer hasta que alguien abre Instagram.`);
  }
  if (ig.enlaceTipo === 'ninguno') g('sin_enlace', true, `${fuera}. Una clienta os descubre en Instagram, quiere ${trat} y busca en la bio dónde reservar. No hay enlace: tiene que escribir y esperar.`);
  else if (ig.enlaceTipo === 'whatsapp') g('wa', true, `${fuera}. Una clienta pulsa el enlace de vuestra bio, se abre WhatsApp y pregunta por ${trat}. El mensaje se queda en gris hasta ${abren}.`);
  else if (ig.enlaceTipo === 'reserva' && !ig.citaPorDM) g('reserva', true, `${fuera}. Una clienta ve ${ig.plataforma || 'la reserva online'} en vuestra bio, pero antes de reservar ${trat} quiere saber si duele y cuántas sesiones necesita. Os lo pregunta por privado y espera.`);
  else if (ig.enlaceTipo === 'agregador') g('agregador', false, `[el enlace de la bio es una página de enlaces: ábrela y escribe aquí la escena de lo que encuentra una clienta que quiere reservar ${trat}]`);

  return lista;
}

// Elige la escena principal (el fallo que más citas hace perder, con su evidencia) y las siguientes.
// El canal decide qué evidencia va primero: si el dato sale de Instagram, la escena de Instagram.
export function ganchos(lead: DatosLead, checks: string[], trat: string, canal: Canal = 'web'): Gancho[] {
  const web = ganchosWeb(lead, checks, trat);
  const ig = ganchosInstagram(lead, trat);
  let lista = canal === 'instagram' ? [...ig, ...web] : [...web, ...ig];
  const { fuera } = momentos(lead.ficha);

  if (!lead.web && !lead.ficha) {
    lista.push({ id: 'sin_web', concreto: true, origen: 'google', frase: `${fuera}. Una clienta busca ${lead.nombre} en Google para ${trat}: solo ve el teléfono. Llama y suena hasta que se corta.` });
  }

  // Sin repetir el mismo dato (p. ej. la oferta vista en web y en Instagram)
  const vistos = new Set<string>();
  lista = lista.filter((x) => {
    const clave = x.id.replace(/^ig_/, '');
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
  // Primero lo que se puede comprobar; las notas para revisar a mano, al final (orden estable)
  lista = [...lista.filter((x) => x.concreto), ...lista.filter((x) => !x.concreto)];

  if (lista.length === 0) {
    lista.push({ id: 'generico', concreto: false, origen: canal, frase: `${fuera}. Una clienta quiere ${trat} en ${lead.nombre} y escribe fuera de horario. [completa con lo que ve: por dónde escribe y qué respuesta recibe]` });
  }
  return lista;
}

// Escena de "después" (con el agente funcionando), siempre con datos suyos
function escenaDespues(lead: DatosLead, trat: string) {
  const { fuera2 } = momentos(lead.ficha);
  const of = ofertaCorta(lead);
  const que = of ? `por «${of}»` : `por ${trat}`;
  return `${fuera2}. Una clienta pregunta a ${lead.nombre} ${que}. Antes de dejar el móvil en la mesa ya tiene la respuesta y su cita apuntada.`;
}

export interface Mensajes {
  guion: string[]; // guion de llamada (primer contacto), 5 bloques
  guionTitulos: string[];
  objBooksy: string;
  objEmail: string;
  llamada: string; // guion completo + objeciones, para copiar de una vez y guardar en el historial
  whatsapp: string; // tras el "sí" en la llamada
  email: string; // tras el "sí" (o tras "mándalo por email"); sin enlaces
  seguimiento1: string; // 3 días sin respuesta tras el "sí"
  seguimiento2: string; // 7 días, el último
  vozInicial: string;
  vozSeguimiento: string;
  vozCierre: string;
  calidad: { ok: boolean; texto: string }[];
}

export const DM_MAX = 500;
export const PALABRAS_PROHIBIDAS = /soluci[oó]n|revolucion|siguiente nivel|innovador|era digital|optimizar procesos|\bbot\b/i;

export function construirMensajes(opts: {
  lead: DatosLead;
  frase: string; // escena principal (editable por Rocío en el paso 2)
  frase2: string; // segunda escena, para el seguimiento
  tratamiento: string;
  tratamientoPropio: boolean;
  contacto: string;
  firma: Firma;
  canal?: Canal;
  angulo?: string;
}): Mensajes {
  const { lead, tratamiento: trat, tratamientoPropio, contacto, firma } = opts;
  const canal: Canal = opts.canal || 'web';
  const nom = lead.nombre;
  const f = lead.ficha;
  const escena = sinPunto(opts.frase) + '.';
  const escena2 = opts.frase2 && opts.frase2.trim() !== opts.frase.trim() ? sinPunto(opts.frase2) + '.' : '';
  const despues = escenaDespues(lead, trat);
  const firmaNombre = firma.nombre.trim() || FIRMA_NOMBRE;
  const hola = contacto ? `Hola, ${contacto}.` : 'Hola.';
  const otros = (f?.tratamientos || lead.ig?.tratamientos || []).filter((t) => t !== trat).slice(0, 2);
  const tratsLista = unir([trat, ...otros]);
  const plataforma = f?.plataforma && f.plataforma !== 'reserva integrada' ? f.plataforma : '';
  const of = ofertaCorta(lead);
  const ancla = anclaDato(lead, trat, tratamientoPropio);

  // ---------- GUION DE LLAMADA (primer contacto) ----------
  // La pregunta de dolor habla de devolver llamadas: la escena de la llamada es la del teléfono en cabina
  const { cabina } = momentos(f);
  const loQueQuiere = of ? `pregunta por «${of}»` : `quiere ${trat}`;
  const escenaCabina = `${cabina}. Estáis en cabina con una clienta y suena el teléfono de ${nom}: es otra clienta que ${loQueQuiere}. Nadie puede cogerlo.`;
  const escenaEsCabina = (opts.angulo || '') === 'telefono';
  const guionTitulos = [
    '1 · APERTURA (dato suyo + la pregunta)',
    '2 · DOLOR (escena + pregunta; que lo diga ella)',
    '3 · OFERTA EN UNA FRASE',
    '4 · CIERRE',
    '5 · PEDIR HORA PARA VOLVER A LLAMAR',
  ];
  const guion = [
    `Hola, ¿hablo con ${contacto || `la responsable de ${nom}`}? Soy ${firmaNombre}, de Sevilla. Estaba mirando ${nom} y ${ancla}. Te robo un minuto con una pregunta: ¿cómo agendáis las citas que os entran cuando estáis en cabina o fuera de horario?\n[escucha sin interrumpir]`,
    `Te pongo un ejemplo con lo vuestro: ${escenaCabina}\n[pausa]\n¿Os pasa que al devolver la llamada ya no la cogen?\n[si dice que sí] ¿Y en una semana normal, cuántas veces os pasa?\n[apunta su número; no des tú ninguna cifra]${escenaEsCabina ? '' : `\n[si sigue la conversación] Y otra cosa que vi en vuestra web: ${escena} ¿Eso cómo lo lleváis?`}`,
    `Yo preparo un agente IA que contesta el WhatsApp de ${nom} cuando estáis en cabina o cerrados, resuelve las dudas de ${tratsLista} y deja la cita apuntada; lo que necesita a una persona os lo pasa a vosotras.`,
    `¿Con quién lo podría comentar 10 minutos?`,
    `¿Qué te viene mejor para que te llame: mañana a primera hora o mañana después de comer?\n[espera la respuesta]\nHecho. Te mando ahora un WhatsApp con la hora para que lo tengas apuntado. Gracias, ${contacto || 'de verdad'}.`,
  ];

  // ---------- OBJECIONES EN LA LLAMADA ----------
  const agenda = plataforma || 'vuestra agenda';
  const objBooksy = `«Ya usamos ${plataforma || 'Booksy / una agenda'} y nos va bien.»
→ "Genial, entonces la agenda la tenéis resuelta. Solo una pregunta: cuando una clienta duda antes de reservar ${trat} (cuánto cuesta, cuántas sesiones, si duele), ¿dónde os lo pregunta, en ${agenda} o por WhatsApp?"
[espera]
"¿Y quién le contesta si estáis en cabina?"
[espera]
"El agente no cambia ${agenda}: contesta esa duda y le manda reservar ahí. ¿Con quién lo podría comentar 10 minutos?"`;

  const objEmail = `«Mándamelo por email.»
→ "Claro, te lo mando. Para que no sea un email más: ¿qué te interesa ver, cómo contesta las dudas de ${trat} o cómo deja la cita apuntada?"
[espera]
"¿A qué email y a nombre de quién?"
[espera]
"Te lo envío hoy y te llamo pasado mañana para comentarlo 10 minutos. ¿Mejor por la mañana o por la tarde?"`;

  const llamada = `Guion de llamada: ${nom}\n\n${guion.map((b, i) => `${guionTitulos[i]}\n${b}`).join('\n\n')}\n\nOBJECIONES\n${objBooksy}\n\n${objEmail}`;

  // ---------- SEGUIMIENTO TRAS EL "SÍ" ----------
  // WhatsApp: la escena primero, una pregunta al final para que conteste
  const whatsapp = `${hola}
${escena}
Es lo que hablamos por teléfono. En los 10 minutos que hemos quedado te enseño qué recibiría esa clienta.
Para prepararlo: ¿cuántas veces os pasa algo así en una semana normal?
${firmaNombre}`;

  // Email: corto y sin enlaces (ni web, ni email en la firma)
  const email = `Asunto: ${nom}: lo que hablamos de ${trat}

${contacto ? `Hola, ${contacto}` : 'Hola'}:

${escena}

Es lo que hablamos por teléfono. En la llamada de 10 minutos te enseño cómo le contestaría el agente a esa clienta, con vuestros tratamientos${plataforma ? ` y sin tocar ${plataforma}` : ''}.

Una pregunta para prepararla: ¿esas consultas os llegan más por WhatsApp, por Instagram o por teléfono?

Un saludo,
${firmaNombre}${firma.telefono ? `\n${firma.telefono}` : ''}`;

  // Si no contesta tras el "sí": escena nueva primero (nunca "¿viste mi mensaje?")
  const seguimiento1 = `${escena2 || despues}
${escena2 ? 'Es otra de las cosas que quería enseñarte de ' + nom + '.' : 'Es lo que quería enseñarte de ' + nom + '.'} ¿Te llamo el martes a las 10:00 o el miércoles a las 16:00, 10 minutos?
${firmaNombre}`;

  const seguimiento2 = `${despues}
Es lo que quería enseñarte de ${nom}. No te escribo más; si algún día queréis verlo, me dices y te llamo.
${firmaNombre}`;

  // ---------- NOTAS DE VOZ (WhatsApp, tras el "sí") ----------
  const vozInicial = `Hola ${contacto || ''}, soy ${firmaNombre} [pausa] Te dejo el ejemplo que hablamos [respiración] ${escena} [pausa] Eso es lo que te quiero enseñar en los diez minutos que hemos quedado, con un ejemplo de ${trat} [pausa corta] Para prepararlo, una pregunta: ¿cuántas veces os pasa algo así en una semana normal? Me lo dices por aquí. Gracias.`.replace(/Hola ,/, 'Hola,');
  const vozSeguimiento = `${escena2 || despues} [pausa] Soy ${firmaNombre}, por lo de ${nom} [respiración] Es lo que quería enseñarte en diez minutos [pausa corta] ¿Te llamo el martes por la mañana o el miércoles por la tarde?`;
  const vozCierre = `${despues} [pausa] Soy ${firmaNombre} [respiración] Es lo que quería enseñarte de ${nom}. No te escribo más [pausa corta] Si algún día queréis verlo, me dices y te llamo. Gracias por tu tiempo.`;

  // ---------- CONTROL DE CALIDAD ----------
  const pendiente = /\[/;
  const todo = [llamada, whatsapp, email, seguimiento1, seguimiento2, vozInicial, vozSeguimiento, vozCierre].join('\n');
  // Los % solo valen si están en la oferta que publican ellos
  const sinOferta = of ? todo.split(of).join('') : todo;
  const prohibida = todo.match(PALABRAS_PROHIBIDAS)?.[0] || (/\d\s?%/.test(sinOferta) ? '%' : '');
  const datoReal = !!of || !!f?.precio || !!plataforma || tratamientoPropio || !!f?.horario || !!lead.ig;
  const calidad = [
    { ok: true, texto: `Nombre de la clínica: ${nom}` },
    { ok: datoReal, texto: datoReal ? `Dato real en la apertura: ${ancla.replace(/^he visto (que )?/, '')}` : 'Sin dato real suyo: analiza su web o su Instagram, o escribe un tratamiento que ofrezcan' },
    { ok: tratamientoPropio, texto: tratamientoPropio ? `Tratamiento suyo: ${trat}` : 'Sin tratamiento suyo: escribe uno que ofrezcan de verdad' },
    { ok: !pendiente.test(opts.frase) && /\d{1,2}:\d{2}/.test(opts.frase), texto: pendiente.test(opts.frase) ? 'Falta completar la escena del paso 2' : /\d{1,2}:\d{2}/.test(opts.frase) ? 'Escena en presente con día y hora' : 'La escena no tiene día y hora: añádelos en el paso 2' },
    { ok: canal !== 'instagram' || !!lead.ig, texto: canal === 'instagram' ? (lead.ig ? `Dato sacado de su Instagram (@${lead.ig.usuario})` : 'Citas Instagram sin haber analizado su perfil') : canal === 'web' ? (f ? 'Dato sacado de su web' : 'Dato de su web marcado a mano') : 'Dato sacado de su ficha de Google' },
    { ok: !prohibida, texto: prohibida ? `Palabra o cifra a quitar: «${prohibida}»` : 'Sin lenguaje de anuncio ni porcentajes inventados' },
    { ok: !/https?:|www\.|@[\w.-]+\.\w/.test(email), texto: /https?:|www\.|@[\w.-]+\.\w/.test(email) ? 'El email lleva un enlace: quítalo' : 'Email sin enlaces' },
    { ok: whatsapp.length <= DM_MAX, texto: `WhatsApp de ${whatsapp.length} caracteres (máx. ${DM_MAX})` },
    { ok: firmaNombre === FIRMA_NOMBRE, texto: firmaNombre === FIRMA_NOMBRE ? `Firma: ${FIRMA_NOMBRE}` : `La firma debería ser «${FIRMA_NOMBRE}»` },
  ];

  return { guion, guionTitulos, objBooksy, objEmail, llamada, whatsapp, email, seguimiento1, seguimiento2, vozInicial, vozSeguimiento, vozCierre, calidad };
}
