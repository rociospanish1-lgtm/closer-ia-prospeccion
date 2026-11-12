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
// - En lo escrito solo se cuenta la escena del problema: nunca la solución técnica ni nombres de
//   herramientas (la solución se cuenta en la llamada o la demo).
// - La fuente se nombra igual que el dato: "vuestra web" o "vuestro Instagram", nunca mezcladas.
// - Nada de "otra vez" ni "lo que hablamos" si no hay un toque anterior registrado.
// - Todo mensaje termina con una pregunta fácil de contestar.
// - Mensajes escritos solo si el prospecto "pidió info"; si no, Closer muestra el guion de llamada.
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
export function ofertaCorta(lead: DatosLead, fuente?: Canal): string {
  const web = lead.ficha?.ofertas?.[0] || '';
  const ig = lead.ig?.ofertas?.[0]?.texto || '';
  const bruta = fuente === 'web' ? web : fuente === 'instagram' ? ig : fuente === 'google' ? '' : web || ig;
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

// Dato real que se cita en voz alta en la llamada ("he visto…"). Sale de la MISMA fuente que la escena.
function anclaDato(lead: DatosLead, trat: string, tratamientoPropio: boolean, fuente: Canal): string {
  const of = ofertaCorta(lead, fuente);
  if (fuente === 'instagram' && lead.ig) {
    const ig = lead.ig;
    if (of) return `he visto en vuestro Instagram «${of}»`;
    if (ig.precio) return `he visto en vuestro Instagram ${ig.precio.tratamiento} a ${ig.precio.euros} €`;
    if (tratamientoPropio) return `he visto en vuestro Instagram que trabajáis mucho ${trat}`;
    return 'he estado viendo vuestro Instagram';
  }
  if (fuente === 'google' || !lead.ficha) return 'he visto vuestra ficha de Google';
  const f = lead.ficha;
  if (of) return `he visto en vuestra web «${of}»`;
  if (f.precio) return `he visto en vuestra web ${f.precio.tratamiento} a ${f.precio.euros} €`;
  if (tratamientoPropio) return `he visto en vuestra web que trabajáis ${trat}`;
  if (f.horario) return `he visto en vuestra web que abrís ${f.horario}`;
  return 'he estado viendo vuestra web';
}

// Cómo se nombra la fuente en el texto
export const nombreFuente = (fuente: Canal) => (fuente === 'instagram' ? 'vuestro Instagram' : fuente === 'google' ? 'vuestra ficha de Google' : 'vuestra web');

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
    const plat = 'la reserva online'; // nunca el nombre de la herramienta
    // Oferta publicada: es el dato más personal. La escena dice lo que pasa al intentar reservarla.
    const of = ofertaCorta(lead, 'web');
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

    if (f.reservaTipo === 'formulario') g('formulario', true, `${fuera}. Una clienta rellena el formulario de vuestra web para ${trat}, pulsa «enviar» y se queda mirando la pantalla: no sabe si tiene hueco hasta ${abren}.`);
    else if (f.reservaTipo === 'telefono') g('telefono', true, `${cabina}. Estáis en cabina y el teléfono de ${nom} suena en recepción: es una clienta que quiere ${trat}. Nadie puede cogerlo.`);
    else if (f.reservaTipo === 'ninguna') g('sin_reserva', true, `${fuera}. Una clienta entra en vuestra web para reservar ${trat}, busca dónde pedir cita y no lo encuentra. Cierra la pestaña.`);

    if (f.chat) g('chat', false, `[tienen ${f.chat} en la web: pruébalo y escribe aquí la escena de lo que ve una clienta que pregunta por ${trat} fuera de horario]`);
    else if (f.whatsappTipo) g('whatsapp_manual', true, f.plataforma
      ? `${fuera}. Una clienta duda si ${trat} es para ella. En vez de usar ${plat}, pulsa el WhatsApp de vuestra web y pregunta. El mensaje se queda en gris hasta ${abren}.`
      : `${fuera}. Una clienta pulsa el botón de WhatsApp de vuestra web para preguntar por ${trat}. Escribe, envía y el mensaje se queda en gris hasta ${abren}.`);
    else g('sin_whatsapp', true, `${fuera}. Una clienta tiene una duda sobre ${trat}, busca un WhatsApp en vuestra web y no lo hay. Para preguntar tiene que esperar a llamar ${abren === 'el lunes' ? 'el lunes' : 'en horario'}.`);

    if (f.horario && !f.abreSabado) g('horario', true, `${finde}. Una clienta quiere ${trat}, mira en vuestra web el horario (${f.horario}) y lo deja para el lunes.`);
  } else {
    // Sin ficha (lead antiguo o análisis manual): usamos los checks marcados
    if (checks.includes('sin_reservas')) g('sin_reserva', true, `${fuera}. Una clienta entra en vuestra web para reservar ${trat}, busca dónde pedir cita y no lo encuentra. Cierra la pestaña.`);
    if (checks.includes('sin_whatsapp')) g('sin_whatsapp', true, `${fuera}. Una clienta tiene una duda sobre ${trat}, busca un WhatsApp en vuestra web y no lo hay. Para preguntar tiene que esperar a llamar en horario.`);
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

  const of = ofertaCorta(lead, 'instagram');
  if (of) g('oferta', true, `${fuera}. Una clienta ve en vuestro Instagram «${of}», le interesa y os escribe por privado. El mensaje se queda sin leer hasta que alguien abre Instagram.`);

  if (ig.citaPorDM) {
    g('dm', true, `${fuera}. Una clienta ve una publicación vuestra de ${trat} y os escribe por privado, como pedís en vuestro Instagram. El mensaje se queda sin leer hasta que alguien abre Instagram.`);
  }
  if (ig.enlaceTipo === 'ninguno') g('sin_enlace', true, `${fuera}. Una clienta os descubre en vuestro Instagram, quiere ${trat} y busca dónde reservar. No hay enlace: tiene que escribir y esperar.`);
  else if (ig.enlaceTipo === 'whatsapp') g('wa', true, `${fuera}. Una clienta pulsa el enlace de vuestro Instagram, se abre WhatsApp y pregunta por ${trat}. El mensaje se queda en gris hasta ${abren}.`);
  else if (ig.enlaceTipo === 'reserva' && !ig.citaPorDM) g('reserva', true, `${fuera}. Una clienta ve el enlace de reserva en vuestro Instagram, pero antes de reservar ${trat} quiere saber si duele y cuántas sesiones necesita. Os lo pregunta por privado y espera.`);
  else if (ig.enlaceTipo === 'agregador') g('agregador', false, `[el enlace de su Instagram es una página de enlaces: ábrela y escribe aquí la escena de lo que encuentra una clienta que quiere reservar ${trat}]`);

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
    if (clave !== 'oferta' && vistos.has(clave)) return false;
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

export interface Mensajes {
  guion: string[]; // guion de llamada (primer contacto), 5 bloques
  guionTitulos: string[];
  objBooksy: string;
  objEmail: string;
  llamada: string; // guion completo + objeciones, para copiar de una vez y guardar en el historial
  whatsapp: string; // solo si pidió info
  email: string; // solo si pidió info; sin enlaces
  seguimiento1: string; // 3 días sin respuesta
  seguimiento2: string; // 7 días, el último
  vozInicial: string;
  vozSeguimiento: string;
  vozCierre: string;
  calidad: { ok: boolean; texto: string }[];
}

export const DM_MAX = 500;
export const PALABRAS_PROHIBIDAS = /soluci[oó]n|revolucion|siguiente nivel|innovador|era digital|optimizar procesos|\bbot\b/i;
// En lo escrito no se da la solución técnica ni se nombran herramientas
export const SOLUCION_TECNICA = /\bagente|inteligencia artificial|\bIA\b|automatiz|calendario de reservas|enlace de reservas?|respuestas? autom[aá]tica|mensaje autom[aá]tico|whatsapp business|chatbot|booksy|treatwell|fresha|calendly|manychat|reserva integrada/i;
const PRESUPONE_CONTACTO = /otra vez|de nuevo|como te (dije|coment)|lo que (hablamos|comentamos)|hemos quedado|te llam[eé] |seg[uú]n hablamos/i;

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
  contactoPrevio?: boolean; // hay un toque anterior registrado en el historial
  pidioInfo?: boolean; // marcado "pidió info": solo entonces se generan mensajes escritos
}): Mensajes {
  const { lead, tratamiento: trat, tratamientoPropio, contacto, firma } = opts;
  const canal: Canal = opts.canal || 'web';
  const previo = !!opts.contactoPrevio;
  const pidioInfo = !!opts.pidioInfo;
  const nom = lead.nombre;
  const f = lead.ficha;
  const ang = opts.angulo || '';
  // La fuente del dato manda: escena de Instagram → "vuestro Instagram"; de la web → "vuestra web"
  const fuente: Canal = ang.startsWith('ig_') ? 'instagram' : ang === 'sin_web' ? 'google' : ang ? 'web' : canal;
  const escena = sinPunto(opts.frase) + '.';
  const escena2 = opts.frase2 && opts.frase2.trim() !== opts.frase.trim() ? sinPunto(opts.frase2) + '.' : '';
  const firmaNombre = firma.nombre.trim() || FIRMA_NOMBRE;
  const holaSoy = `Hola${contacto ? `, ${contacto}` : ''}, soy ${firmaNombre}.`;
  const otros = (fuente === 'instagram' ? lead.ig?.tratamientos || [] : f?.tratamientos || lead.ig?.tratamientos || []).filter((t) => t !== trat).slice(0, 2);
  const tratsLista = unir([trat, ...otros]);
  const of = ofertaCorta(lead, fuente);
  const ancla = anclaDato(lead, trat, tratamientoPropio, fuente);
  const donde = nombreFuente(fuente);

  // ---------- GUION DE LLAMADA (primer contacto; aquí sí se cuenta la oferta) ----------
  // La pregunta de dolor habla de devolver llamadas: la escena de la llamada es la del teléfono en cabina
  const { cabina } = momentos(f);
  const loQueQuiere = of ? `pregunta por «${of}»` : `quiere ${trat}`;
  const escenaCabina = `${cabina}. Estáis en cabina con una clienta y suena el teléfono de ${nom}: es otra clienta que ${loQueQuiere}. Nadie puede cogerlo.`;
  const escenaEsCabina = ang === 'telefono';
  const guionTitulos = [
    '1 · APERTURA (dato suyo + la pregunta)',
    '2 · DOLOR (escena + pregunta; que lo diga ella)',
    '3 · OFERTA EN UNA FRASE',
    '4 · CIERRE',
    '5 · PEDIR HORA PARA VOLVER A LLAMAR',
  ];
  const guion = [
    `Hola, ¿hablo con ${contacto || `la responsable de ${nom}`}? Soy ${firmaNombre}, de Sevilla. Estaba mirando ${nom} y ${ancla}. Te robo un minuto con una pregunta: ¿cómo agendáis las citas que os entran cuando estáis en cabina o fuera de horario?\n[escucha sin interrumpir]`,
    `Te pongo un ejemplo con lo vuestro: ${escenaCabina}\n[pausa]\n¿Os pasa que al devolver la llamada ya no la cogen?\n[si dice que sí] ¿Y en una semana normal, cuántas veces os pasa?\n[apunta su número; no des tú ninguna cifra]${escenaEsCabina ? '' : `\n[si sigue la conversación] Y otra cosa que vi en ${donde}: ${escena} ¿Eso cómo lo lleváis?`}`,
    `Yo preparo un agente IA que contesta el WhatsApp de ${nom} cuando estáis en cabina o cerrados, resuelve las dudas de ${tratsLista} y deja la cita apuntada; lo que necesita a una persona os lo pasa a vosotras.`,
    `¿Con quién lo podría comentar 10 minutos?`,
    `¿Qué te viene mejor para que te llame: mañana a primera hora o mañana después de comer?\n[espera la respuesta]\n¿Te mando la hora por WhatsApp a este número?\n[si dice que sí: marca «PIDIÓ INFO» en Closer]`,
  ];

  // ---------- OBJECIONES EN LA LLAMADA ----------
  const objBooksy = `«Ya usamos Booksy / una agenda y nos va bien.»
→ "Genial, entonces la agenda la tenéis resuelta. Solo una pregunta: cuando una clienta duda antes de reservar ${trat} (cuánto cuesta, cuántas sesiones, si duele), ¿dónde os lo pregunta, en vuestra agenda o por WhatsApp?"
[espera]
"¿Y quién le contesta si estáis en cabina?"
[espera]
"Lo que os enseñaría no cambia vuestra agenda: es justo esa duda de antes de reservar. ¿Con quién lo podría comentar 10 minutos?"`;

  const objEmail = `«Mándamelo por email.»
→ "Claro, te lo mando. Para que no sea un email más: ¿qué te interesa ver, cómo se contestan las dudas de ${trat} o cómo queda la cita apuntada?"
[espera]
"¿A qué email y a nombre de quién?"
[espera — si te lo da, marca «PIDIÓ INFO» en Closer]
"Te lo envío hoy y te llamo pasado mañana para comentarlo 10 minutos. ¿Mejor por la mañana o por la tarde?"`;

  const llamada = `Guion de llamada: ${nom}\n\n${guion.map((b, i) => `${guionTitulos[i]}\n${b}`).join('\n\n')}\n\nOBJECIONES\n${objBooksy}\n\n${objEmail}`;

  // ---------- MENSAJES ESCRITOS (solo si pidió info) ----------
  // Solo la escena del problema + una pregunta fácil. Sin solución, sin herramientas, sin enlaces.
  const enlace = previo ? 'Es lo que comentamos por teléfono. ' : '';
  // Pregunta fácil que encaja con lo que pasa en la escena
  const preguntaPara = (t: string) =>
    /tel[eé]fono|llama/i.test(t) ? '¿Cuándo le devolvéis la llamada?'
      : /escribe|pregunta|formulario|mensaje|enviar|privado/i.test(t) ? '¿Cuándo le contestáis a esa clienta?'
        : '¿Os pasa algo así?';
  const preguntaEscena = preguntaPara(escena);
  const preguntaHueco = '¿Qué día os viene bien 10 minutos?';

  const whatsapp = `${holaSoy}
${escena}
${enlace}${previo ? preguntaHueco : preguntaEscena}`;

  const asunto = previo ? `${nom}: lo que comentamos de ${trat}` : `${nom}: una clienta de ${trat}`;
  const email = `Asunto: ${asunto}

${contacto ? `Hola, ${contacto}` : 'Hola'}:

${escena}

${enlace}${previo ? preguntaHueco : preguntaEscena}

${firmaNombre}${firma.telefono ? `\n${firma.telefono}` : ''}`;

  // Seguimientos: escena nueva del problema + pregunta (nunca "¿viste mi mensaje?")
  const seguimiento1 = `${holaSoy}
${escena2 || escenaCabina}
${preguntaPara(escena2 || escenaCabina)}`;

  const seguimiento2 = `${holaSoy}
${escena}
Es el último mensaje que te mando sobre esto. ¿Lo dejamos aquí o te llamo 10 minutos?`;

  // ---------- NOTAS DE VOZ (WhatsApp, solo si pidió info) ----------
  const vozInicial = `Hola${contacto ? ' ' + contacto : ''}, soy ${firmaNombre} [pausa] ${escena} [pausa] ${enlace}[respiración] ${previo ? preguntaHueco : preguntaEscena}`;
  const vozSeguimiento = `Hola${contacto ? ' ' + contacto : ''}, soy ${firmaNombre} [pausa] ${escena2 || escenaCabina} [respiración] ${preguntaPara(escena2 || escenaCabina)}`;
  const vozCierre = `Hola${contacto ? ' ' + contacto : ''}, soy ${firmaNombre} [pausa] ${escena} [respiración] Es el último mensaje que te mando sobre esto [pausa corta] ¿Lo dejamos aquí o te llamo diez minutos?`;

  // ---------- CONTROL DE CALIDAD ----------
  const pendiente = /\[/;
  const escritos = { WhatsApp: whatsapp, email, 'seguimiento 1': seguimiento1, 'seguimiento 2': seguimiento2, 'voz inicial': vozInicial, 'voz seguimiento': vozSeguimiento, 'voz cierre': vozCierre };
  const todo = [llamada, ...Object.values(escritos)].join('\n');
  // Los % solo valen si están en la oferta que publican ellos
  const sinOferta = of ? todo.split(of).join('') : todo;
  const prohibida = todo.match(PALABRAS_PROHIBIDAS)?.[0] || (/\d\s?%/.test(sinOferta) ? '%' : '');
  const conSolucion = Object.entries(escritos).map(([k, t]) => [k, t.match(SOLUCION_TECNICA)?.[0]] as const).find(([, m]) => m);
  const mezcla = Object.entries(escritos).find(([, t]) => /vuestra web/i.test(t) && /vuestro instagram/i.test(t))?.[0];
  const presupone = previo ? '' : Object.entries(escritos).find(([, t]) => PRESUPONE_CONTACTO.test(t))?.[0];
  const cuerpoEmail = email.replace(new RegExp(`\\n\\n${firmaNombre}[\\s\\S]*$`), '');
  const sinPregunta = Object.entries({ ...escritos, email: cuerpoEmail }).find(([, t]) => !/\?\s*$/.test(t.trim()))?.[0];
  const datoReal = !!of || !!f?.precio || tratamientoPropio || !!f?.horario || !!lead.ig;
  const calidad = [
    { ok: pidioInfo, texto: pidioInfo ? 'Pidió info: puedes enviar WhatsApp o email' : 'No ha pedido info: solo llamada (los mensajes escritos se desbloquean al marcar «PIDIÓ INFO»)' },
    { ok: true, texto: `Nombre de la clínica: ${nom}` },
    { ok: datoReal, texto: datoReal ? `Dato real en la apertura: ${ancla.replace(/^he (visto|estado viendo) /, '')}` : 'Sin dato real suyo: analiza su web o su Instagram, o escribe un tratamiento que ofrezcan' },
    { ok: tratamientoPropio, texto: tratamientoPropio ? `Tratamiento suyo: ${trat}` : 'Sin tratamiento suyo: escribe uno que ofrezcan de verdad' },
    { ok: !pendiente.test(opts.frase) && /\d{1,2}:\d{2}/.test(opts.frase), texto: pendiente.test(opts.frase) ? 'Falta completar la escena del paso 2' : /\d{1,2}:\d{2}/.test(opts.frase) ? 'Escena en presente con día y hora' : 'La escena no tiene día y hora: añádelos en el paso 2' },
    { ok: !mezcla, texto: mezcla ? `El ${mezcla} mezcla «vuestra web» y «vuestro Instagram»` : `Fuente coherente: ${donde}` },
    { ok: !conSolucion, texto: conSolucion ? `El ${conSolucion[0]} da la solución o nombra una herramienta («${conSolucion[1]}»): quítalo` : 'Lo escrito solo cuenta el problema' },
    { ok: !presupone, texto: presupone ? `El ${presupone} da por hecho un contacto previo que no está registrado` : previo ? 'Hay un contacto previo registrado' : 'Sin dar por hecho un contacto previo' },
    { ok: !sinPregunta, texto: sinPregunta ? `El ${sinPregunta} no termina con una pregunta` : 'Todos los mensajes terminan con una pregunta' },
    { ok: !prohibida, texto: prohibida ? `Palabra o cifra a quitar: «${prohibida}»` : 'Sin lenguaje de anuncio ni porcentajes inventados' },
    { ok: !/https?:|www\.|@[\w.-]+\.\w/.test(email), texto: /https?:|www\.|@[\w.-]+\.\w/.test(email) ? 'El email lleva un enlace: quítalo' : 'Email sin enlaces' },
    { ok: whatsapp.length <= DM_MAX, texto: `WhatsApp de ${whatsapp.length} caracteres (máx. ${DM_MAX})` },
    { ok: firmaNombre === FIRMA_NOMBRE, texto: firmaNombre === FIRMA_NOMBRE ? `Firma: ${FIRMA_NOMBRE}` : `La firma debería ser «${FIRMA_NOMBRE}»` },
  ];

  return { guion, guionTitulos, objBooksy, objEmail, llamada, whatsapp, email, seguimiento1, seguimiento2, vozInicial, vozSeguimiento, vozCierre, calidad };
}
