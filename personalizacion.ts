// Mensajes personalizados a partir del análisis de la web.
// Regla: si el mensaje se pudiera mandar a otro negocio cambiando solo el nombre, está mal.

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
  pocoTexto: boolean;
}

export interface DatosLead {
  nombre: string;
  nicho: string;
  rating: string;
  reviews: string;
  ficha?: Ficha;
}

export interface Firma {
  nombre: string;
  agencia: string;
  telefono: string;
  email: string;
}

export interface Gancho {
  id: string;
  frase: string; // evidencia de su web + lo que le pasa a su cliente
  concreto: boolean; // false si no hay un dato verificable detrás
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

// Elige UN gancho: el fallo que más citas hace perder, con su evidencia.
export function ganchos(lead: DatosLead, checks: string[], trat: string): Gancho[] {
  const f = lead.ficha;
  const m = momento(f);
  const lista: Gancho[] = [];

  // Web montada con JavaScript: no se puede leer bien, así que no afirmamos nada que no hayamos visto
  if (f && f.pocoTexto) {
    return [{ id: 'revisar', concreto: false, frase: `[abre su web y escribe aquí lo que has visto: cómo se pide cita, si hay WhatsApp y qué pasa si alguien escribe por ${trat} fuera de horario]` }];
  }

  if (f) {
    if (f.reservaTipo === 'formulario') {
      lista.push({ id: 'formulario', concreto: true, frase: `para pedir cita hay un formulario, pero no se puede elegir día ni hora; si alguien lo rellena ${m} para ${trat}, no sabe hasta el día siguiente si tiene hueco` });
    } else if (f.reservaTipo === 'telefono') {
      lista.push({ id: 'telefono', concreto: true, frase: `para pedir cita hay que llamar; si alguien se decide por ${trat} ${m}, no puede reservar hasta que abráis${cuandoAbren(f)}` });
    } else if (f.reservaTipo === 'ninguna') {
      lista.push({ id: 'sin_reserva', concreto: true, frase: `no he encontrado una forma de reservar cita online; si alguien quiere ${trat} ${m}, tiene que esperar a que abráis${cuandoAbren(f)}` });
    }

    if (f.chat) {
      lista.push({ id: 'chat', concreto: false, frase: `tenéis ${f.chat} en la web; habría que ver si contesta solo a las dudas sobre ${trat} y si deja la cita reservada` });
    } else if (f.whatsappTipo) {
      lista.push({ id: 'whatsapp_manual', concreto: true, frase: `tenéis el botón de WhatsApp${f.plataforma ? ` y reservas con ${f.plataforma}` : ''}, pero si alguien pregunta por ${trat} ${m} (precio, sesiones, si duele), la respuesta depende de que alguien del equipo lo vea al día siguiente` });
    } else {
      lista.push({ id: 'sin_whatsapp', concreto: true, frase: `no he visto WhatsApp; quien tenga una duda sobre ${trat} ${m} tiene que esperar a llamar en horario` });
    }

    if (f.horario && !f.abreSabado) {
      lista.push({ id: 'horario', concreto: true, frase: `abrís ${f.horario}; todo lo que llegue el fin de semana se queda esperando al lunes` });
    }
    if (f.precio) {
      const e = f.precio.euros;
      lista.push({ id: 'precio', concreto: true, frase: `con ${f.precio.tratamiento} a ${e} €, una sola cita que no se pierda a la semana son unos ${e * 4} € al mes` });
    }
  } else {
    // Sin ficha (lead antiguo o análisis manual): usamos los checks marcados
    if (checks.includes('sin_reservas')) lista.push({ id: 'sin_reserva', concreto: true, frase: `no he encontrado una forma de reservar cita online; si alguien quiere ${trat} ${momento()}, tiene que esperar a que abráis` });
    if (checks.includes('sin_whatsapp')) lista.push({ id: 'sin_whatsapp', concreto: true, frase: `no he visto WhatsApp; quien tenga una duda sobre ${trat} ${momento()} tiene que esperar a llamar en horario` });
  }

  if (lista.length === 0) {
    lista.push({ id: 'generico', concreto: false, frase: `me gustaría saber qué pasa con las consultas sobre ${trat} que os llegan fuera de horario` });
  }
  return lista;
}

export function lineaPositiva(lead: DatosLead) {
  const r = Number(String(lead.rating).replace(',', '.'));
  const n = Number(lead.reviews);
  if (r >= 4.3 && n >= 15) return `Tenéis un ${String(r).replace('.', ',')} en Google con ${n} reseñas, así que la gente quiere venir.`;
  const t = lead.ficha?.tratamientos || [];
  if (t.length >= 2) return `He visto que trabajáis ${unir(t.slice(0, 2))}.`;
  return '';
}

export interface Mensajes {
  email: string;
  dm: string;
  llamada: string;
  seguimiento1: string;
  seguimiento2: string;
  vozInicial: string;
  vozSeguimiento: string;
  vozCierre: string;
  calidad: { ok: boolean; texto: string }[];
}

export function construirMensajes(opts: {
  lead: DatosLead;
  frase: string; // gancho principal (editable por Rocío)
  frase2: string; // segundo dato para el seguimiento
  tratamiento: string;
  tratamientoPropio: boolean;
  contacto: string;
  firma: Firma;
}): Mensajes {
  const { lead, frase, tratamiento: trat, tratamientoPropio, contacto, firma } = opts;
  const frase2 = opts.frase2 && opts.frase2.trim() !== frase.trim() ? opts.frase2.trim() : '';
  const nom = lead.nombre;
  const quien = persona(lead.nicho);
  const saludo = contacto ? `Hola ${contacto}` : 'Hola';
  const positivo = lineaPositiva(lead);
  const otros = (lead.ficha?.tratamientos || []).filter((t) => t !== trat).slice(0, 2);
  const tratsLista = unir([trat, ...otros]);
  const firmaEmail = `${firma.nombre}\n${firma.agencia}${firma.telefono ? `\nTel.: ${firma.telefono}` : ''}${firma.email ? `\nEmail: ${firma.email}` : ''}`;

  // Oferta: revisión gratuita de 15 min (diagnóstico primero, automatización después).
  // Nunca "monto agentes que contestan solos" ni cifras de resultados.
  const juntas = quien === 'una clienta' ? 'juntas' : 'juntos';
  const fallos = [frase, frase2].filter((x) => x && x.trim()).map((x) => `– ${mayus(x.trim().replace(/\.$/, ''))}.`).join('\n');
  const revision = `Hago una revisión de 15 minutos, sin coste, para enseñaros dónde se pierden consultas y qué se puede automatizar, por ejemplo contestar y dar cita a quien escribe fuera de horario.`;
  const pregunta = `¿Te interesa que lo revisemos ${juntas} y veamos qué se puede mejorar?`;

  const email = `Asunto: ${tratamientoPropio ? `${mayus(trat)} en ${nom}` : `Citas fuera de horario en ${nom}`}

${contacto ? `Hola ${contacto}` : `Hola, equipo de ${nom}`}:

Soy ${firma.nombre}, de ${firma.agencia}, una agencia de automatización de Sevilla.${positivo ? ' ' + positivo : ''}

He estado mirando vuestra web y he visto un par de cosas que os pueden estar costando citas:
${fallos}

${revision}

${pregunta} Si no os encaja, decídmelo y no insisto.

Un saludo,
${firmaEmail}`;

  const dm = `${contacto ? `Hola, ${contacto}` : "Hola"}. Soy ${firma.nombre}, tengo una agencia de automatización aquí en Sevilla. He estado mirando la web de ${nom} y he visto un par de cosas que os pueden estar costando citas:
${fallos}
${revision} ${pregunta}`;

  const llamada = `Guion de llamada: ${nom}

1. Saludo: "Hola, ¿hablo con ${contacto || nom}? Soy ${firma.nombre}, de ${firma.agencia}, una agencia de automatización de Sevilla. ¿Tienes un minuto?"
2. Motivo (su web): "He estado mirando vuestra web y ${frase}."
3. Pregunta: "¿Cómo lo estáis llevando ahora? ¿Quién contesta lo que entra por la noche o el fin de semana?"
4. Qué hago: "Reviso cómo os llegan las consultas (web, WhatsApp, Instagram), dónde se pierden y qué tareas se pueden automatizar, como contestar las dudas sobre ${tratsLista} y dar cita fuera de horario. Lo que necesita a una persona lo sigue llevando vuestro equipo."
5. Cierre: "Son 15 minutos, sin coste. ¿Te viene mejor el martes o el jueves por la mañana?"`;

  const seguimiento1 = frase2
    ? `${saludo}, te escribí hace unos días sobre la web de ${nom}. Te dejo otro dato por si te sirve: ${frase2}. Si queréis, lo vemos en 15 minutos.`
    : `${saludo}, te escribí hace unos días sobre la web de ${nom}. Si queréis, en 15 minutos os enseño lo que he visto y qué se puede mejorar. ¿Te viene bien esta semana?`;

  const seguimiento2 = `${saludo}, no te escribo más sobre ${nom}. Si en algún momento queréis revisar cómo os llegan las consultas y qué se puede automatizar, me escribís y lo vemos. Gracias por tu tiempo.`;

  const vozInicial = `Hola ${contacto || nom}, soy ${firma.nombre} de ${firma.agencia}, una agencia de automatización de Sevilla [pausa] He estado mirando vuestra web y ${frase} [pausa corta] Hago una revisión de quince minutos, sin coste, para ver dónde se pierden consultas y qué se puede automatizar, como dar cita fuera de horario [respiración] ¿Te interesa que lo revisemos ${juntas}?`;
  const vozSeguimiento = `Hola ${contacto ? contacto + ', ' : ''}soy ${firma.nombre} de ${firma.agencia} [pausa] Te escribo por lo de ${nom} [respiración] ${frase2 ? mayus(frase2) + ' [pausa corta] ' : ''}Si queréis, lo vemos en quince minutos y os enseño qué se puede mejorar [pausa] ¿Te viene bien esta semana?`;
  const vozCierre = `Hola ${contacto ? contacto + ', ' : ''}soy ${firma.nombre} de ${firma.agencia} [pausa] Solo quería cerrar el tema de ${nom} [respiración] Si algún día queréis revisar cómo os llegan las consultas sobre ${trat}, me escribís y lo vemos [pausa corta] Si no os encaja, lo dejamos aquí. Gracias por tu tiempo.`;

  const calidad = [
    { ok: true, texto: `Nombre del negocio: ${nom}` },
    { ok: tratamientoPropio, texto: tratamientoPropio ? `Tratamiento suyo: ${trat}` : 'Sin tratamiento suyo: escribe uno que ofrezcan en su web' },
    { ok: !/me gustaría saber qué pasa con las consultas|\[/.test(frase), texto: /\[/.test(frase) ? 'Falta el dato de su web: completa el gancho del paso 2' : 'Dato concreto de su web en el mensaje' },
    { ok: !!frase2 && !/\[/.test(frase2), texto: frase2 ? 'Segundo fallo de su web en el mensaje' : 'Falta el segundo fallo de su web' },
    { ok: dm.length <= 800, texto: `DM de ${dm.length} caracteres (máx. 800)` },
  ];

  return { email, dm, llamada, seguimiento1, seguimiento2, vozInicial, vozSeguimiento, vozCierre, calidad };
}
