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
  const { lead, frase, frase2, tratamiento: trat, tratamientoPropio, contacto, firma } = opts;
  const nom = lead.nombre;
  const quien = persona(lead.nicho);
  const m = momento(lead.ficha);
  const saludo = contacto ? `Hola ${contacto}` : 'Hola';
  const positivo = lineaPositiva(lead);
  const otros = (lead.ficha?.tratamientos || []).filter((t) => t !== trat).slice(0, 2);
  const tratsLista = unir([trat, ...otros]);
  const firmaEmail = `${firma.nombre}\n${firma.agencia}${firma.telefono ? `\nTel.: ${firma.telefono}` : ''}${firma.email ? `\nEmail: ${firma.email}` : ''}`;

  const email = `Asunto: ${tratamientoPropio ? `${mayus(trat)} en ${nom}` : `Citas fuera de horario en ${nom}`}

${contacto ? `Hola ${contacto}` : `Hola, equipo de ${nom}`}:

Soy ${firma.nombre}, de ${firma.agencia}.${positivo ? ' ' + positivo : ''}

He estado mirando vuestra web: ${frase}.

Lo que hago es montar un agente de inteligencia artificial en vuestro WhatsApp que contesta al momento las dudas sobre ${tratsLista} (precio, sesiones, preparación) y deja la cita en vuestra agenda. Lo que necesite a una persona lo pasa a vuestro equipo.

¿Os mando un vídeo de 1 minuto con cómo respondería a ${quien} que pregunta por ${trat} ${m}? Si no os encaja, decídmelo y no insisto.

Un saludo,
${firmaEmail}`;

  const dm = `${saludo}, soy ${firma.nombre}. He estado mirando la web de ${nom}: ${frase}. Monto agentes de IA que contestan y agendan solos. ¿Te mando un vídeo de 1 minuto con cómo respondería a ${quien} que pregunta por ${trat}?`;

  const llamada = `Guion de llamada: ${nom}

1. Saludo: "Hola, ¿hablo con ${contacto || nom}? Soy ${firma.nombre}, de ${firma.agencia}. ¿Tienes un minuto?"
2. Motivo (su web): "He estado mirando vuestra web y ${frase}."
3. Pregunta: "¿Cómo lo estáis llevando ahora? ¿Quién contesta lo que entra por la noche o el fin de semana?"
4. Qué hago: "Monto un agente de inteligencia artificial en vuestro WhatsApp que responde las dudas sobre ${tratsLista} y deja la cita en la agenda. Lo que necesita a una persona os lo pasa."
5. Cierre: "¿Te mando un vídeo de 1 minuto con cómo respondería a ${quien} que pregunta por ${trat}? Así lo ves con calma."`;

  const seguimiento1 = `${saludo}, te escribí hace unos días sobre ${nom}. Un dato más: ${frase2}. ¿Te enseño en un minuto cómo lo resolvería el agente?`;

  const seguimiento2 = `${saludo}, te dejo el vídeo de cómo respondería el agente a ${quien} que pregunta por ${trat} en ${nom}: [ENLACE AL VÍDEO]. No te escribo más; si algún día queréis verlo en directo, aquí estoy.`;

  const vozInicial = `Hola ${contacto || nom}, soy ${firma.nombre} de ${firma.agencia} [pausa] He estado mirando vuestra web y ${frase} [pausa corta] Monto un agente de inteligencia artificial en vuestro WhatsApp que responde y agenda solo [respiración] ¿Te mando un vídeo de un minuto con cómo respondería a ${quien} que pregunta por ${trat}?`;
  const vozSeguimiento = `Hola ${contacto ? contacto + ', ' : ''}soy ${firma.nombre} de ${firma.agencia} [pausa] Te escribo por lo de ${nom} [respiración] ${mayus(frase2)} [pausa corta] He preparado un ejemplo de cómo el agente respondería a ${quien} que pregunta por ${trat} [pausa] ¿Quieres que te lo envíe?`;
  const vozCierre = `Hola ${contacto ? contacto + ', ' : ''}soy ${firma.nombre} de ${firma.agencia} [pausa] Solo quería cerrar el tema de ${nom} [respiración] Si algún día queréis ver cómo contestaría el agente a las consultas de ${trat}, me escribís y lo vemos [pausa corta] Si no os encaja, lo dejamos aquí. Gracias por tu tiempo.`;

  const calidad = [
    { ok: true, texto: `Nombre del negocio: ${nom}` },
    { ok: tratamientoPropio, texto: tratamientoPropio ? `Tratamiento suyo: ${trat}` : 'Sin tratamiento suyo: escribe uno que ofrezcan en su web' },
    { ok: !/me gustaría saber qué pasa con las consultas|\[/.test(frase), texto: /\[/.test(frase) ? 'Falta el dato de su web: completa el gancho del paso 2' : 'Dato concreto de su web en el mensaje' },
    { ok: dm.length <= 450, texto: `DM de ${dm.length} caracteres (máx. 450)` },
  ];

  return { email, dm, llamada, seguimiento1, seguimiento2, vozInicial, vozSeguimiento, vozCierre, calidad };
}
