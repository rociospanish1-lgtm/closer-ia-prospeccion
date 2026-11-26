// Historial de contacto por lead: qué se envió, por qué canal, cuándo y qué respondió.
// Sirve para no perder a nadie entre búsquedas y saber cuándo toca cada seguimiento.

export type CanalEnvio = 'email' | 'whatsapp' | 'instagram' | 'llamada' | 'otro';
export type TipoEvento = 'contacto' | 'seguimiento' | 'respuesta' | 'nota' | 'estado';

export interface Evento {
  fecha: string; // ISO
  tipo: TipoEvento;
  canal?: CanalEnvio;
  texto?: string;
}

export type AutorMensaje = 'yo' | 'clinica';

export interface LeadConHistorial {
  id: string;
  estado: string;
  ultimoContacto?: string;
  seguimientos?: number;
  historial?: Evento[];
  // Control de conversaciones pendientes (se marca a mano, sin conectar con WhatsApp)
  ultimoMensajeDe?: AutorMensaje;
  ultimoMensajeFecha?: string; // ISO
  ultimoMensajeCanal?: CanalEnvio;
  proximoTexto?: string; // «Llamar a Belén»
  proximoFecha?: string; // AAAA-MM-DD
  pidioInfo?: boolean;
  estadoCloser?: string;
}

const DIA = 86_400_000;

// 1.er seguimiento a los 3 días del contacto; 2.º a los 4 días del primero; cierre a los 4 días del 2.º
export function proximoPaso(l: LeadConHistorial, ahora = Date.now()): { tipo: 'seguimiento1' | 'seguimiento2' | 'cerrar' | 'ninguno'; fecha: number | null; vencido: boolean } {
  if (l.estado !== 'CONTACTADO' || !l.ultimoContacto) return { tipo: 'ninguno', fecha: null, vencido: false };
  const base = Date.parse(l.ultimoContacto);
  if (!isFinite(base)) return { tipo: 'ninguno', fecha: null, vencido: false };
  const n = l.seguimientos || 0;
  const tipo = n === 0 ? 'seguimiento1' : n === 1 ? 'seguimiento2' : 'cerrar';
  const fecha = base + (n === 0 ? 3 : 4) * DIA;
  // Se cuenta por días naturales: si toca el jueves, el jueves por la mañana ya aparece
  const inicioHoy = new Date(ahora); inicioHoy.setHours(23, 59, 59, 999);
  return { tipo, fecha, vencido: fecha <= inicioHoy.getTime() };
}

// Regla de captación: máximo 3 toques sin respuesta (contacto + 2 seguimientos) y nunca dos
// mensajes escritos seguidos sin respuesta. WhatsApp, Instagram o email solo si la clínica dio permiso.
const ESCRITOS: CanalEnvio[] = ['whatsapp', 'instagram', 'email'];

// Toques (contacto y seguimientos) desde su última respuesta, del más antiguo al más reciente
export function toquesSinRespuesta(l: LeadConHistorial): Evento[] {
  const h = l.historial || [];
  let desde = 0;
  h.forEach((e, i) => { if (e.tipo === 'respuesta') desde = i + 1; });
  return h.slice(desde).filter((e) => e.tipo === 'contacto' || e.tipo === 'seguimiento');
}

// Canal del siguiente seguimiento: si el último toque fue escrito y no contestaron, toca llamar.
// Si fue una llamada, pasa a WhatsApp solo con permiso; sin permiso, se vuelve a llamar.
export function canalSeguimiento(l: LeadConHistorial & { pidioInfo?: boolean }): CanalEnvio {
  const toques = toquesSinRespuesta(l);
  const ultimo = toques[toques.length - 1]?.canal;
  if (ultimo && ESCRITOS.includes(ultimo)) return 'llamada';
  return l.pidioInfo ? 'whatsapp' : 'llamada';
}

export const NOMBRE_CANAL: Record<CanalEnvio, string> = { email: 'Email', whatsapp: 'WhatsApp', instagram: 'Instagram', llamada: 'Llamada', otro: 'Otro' };

// Explicación corta para Rocío de por qué toca ese canal
export function motivoCanal(l: LeadConHistorial & { pidioInfo?: boolean }): string {
  const toques = toquesSinRespuesta(l);
  const ultimo = toques[toques.length - 1]?.canal;
  const c = canalSeguimiento(l);
  if (ultimo && ESCRITOS.includes(ultimo)) return `El último toque fue por ${NOMBRE_CANAL[ultimo]} y no contestó: nunca dos mensajes escritos seguidos. Este va por llamada.`;
  if (c === 'whatsapp') return 'El último toque fue una llamada y te dio permiso: este puede ir por WhatsApp.';
  return 'Sin permiso para escribirle: este toque va por llamada (prueba otra hora: a primera hora o después de comer).';
}

// "No me contactes más": bloqueado para siempre (RGPD / LSSI)
export const bloqueado = (l: { estado: string }) => l.estado === 'NO_CONTACTAR';

// Para avisar si se vuelve a añadir a mano una clínica bloqueada
const normaliza = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const soloDigitos = (s = '') => s.replace(/\D/g, '').slice(-9);
export function coincideBloqueado<T extends { estado: string; nombre: string; telefono: string }>(lista: T[], nombre: string, telefono = ''): T | undefined {
  const n = normaliza(nombre), t = soloDigitos(telefono);
  return lista.find((l) => bloqueado(l) && ((n && normaliza(l.nombre) === n) || (t.length === 9 && soloDigitos(l.telefono) === t)));
}

export function fechaCorta(ms: number | string) {
  const d = new Date(ms);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function fechaHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// Leads guardados antes de que existiera el historial: se les crea la primera entrada con lo que se sabe
export function migrar<T extends LeadConHistorial>(l: T): T {
  if (l.historial && l.historial.length) return l;
  if (l.estado === 'NUEVO' || !l.ultimoContacto) return l;
  return { ...l, historial: [{ fecha: l.ultimoContacto, tipo: 'contacto', texto: 'Contacto registrado antes de activar el historial (sin texto guardado).' }] };
}

// Une una copia de seguridad con lo que hay: por lead, se queda con el que tenga más historial
// y, a igualdad, con el contacto más reciente. Nunca borra leads que solo estén en uno de los dos.
export function fusionar<T extends LeadConHistorial>(actuales: T[], copia: T[]): { leads: T[]; nuevos: number; actualizados: number } {
  const porId = new Map(actuales.map((l) => [l.id, l]));
  let nuevos = 0, actualizados = 0;
  for (const c of copia) {
    if (!c || typeof c.id !== 'string') continue;
    const a = porId.get(c.id);
    if (!a) { porId.set(c.id, c); nuevos++; continue; }
    const ha = a.historial?.length || 0, hc = c.historial?.length || 0;
    const ta = a.ultimoContacto ? Date.parse(a.ultimoContacto) : 0, tc = c.ultimoContacto ? Date.parse(c.ultimoContacto) : 0;
    if (hc > ha || (hc === ha && tc > ta)) { porId.set(c.id, c); actualizados++; }
  }
  // Conserva el orden actual y añade los nuevos al principio
  const ids = new Set(actuales.map((l) => l.id));
  const añadidos = [...porId.values()].filter((l) => !ids.has(l.id));
  return { leads: [...añadidos, ...actuales.map((l) => porId.get(l.id)!)], nuevos, actualizados };
}


// ───────── Conversaciones pendientes ─────────
export const CANALES_CONTROL: CanalEnvio[] = ['whatsapp', 'llamada', 'email', 'instagram'];
const CANALES_ESCRITOS: CanalEnvio[] = ['whatsapp', 'instagram', 'email'];

export interface UltimoMensaje { de: AutorMensaje; fecha: string; canal?: CanalEnvio }

// Último mensaje: lo marcado en la ficha; si no hay, se deduce del historial (contacto/seguimiento = yo, respuesta = clínica)
export function ultimoMensaje(l: LeadConHistorial): UltimoMensaje | null {
  if (l.ultimoMensajeDe && l.ultimoMensajeFecha && isFinite(Date.parse(l.ultimoMensajeFecha))) {
    return { de: l.ultimoMensajeDe, fecha: l.ultimoMensajeFecha, canal: l.ultimoMensajeCanal };
  }
  const h = l.historial || [];
  for (let i = h.length - 1; i >= 0; i--) {
    const e = h[i];
    if (e.tipo === 'respuesta') return { de: 'clinica', fecha: e.fecha, canal: e.canal };
    if (e.tipo === 'contacto' || e.tipo === 'seguimiento') return { de: 'yo', fecha: e.fecha, canal: e.canal };
  }
  if (l.ultimoContacto) return { de: 'yo', fecha: l.ultimoContacto };
  return null;
}

// No salen en Pendientes ni en Prioritarios: no interesadas, bloqueadas y las que ya han pagado
export const fueraDeJuego = (l: { estado: string; estadoCloser?: string }) =>
  l.estado === 'NO_INTERESADO' || l.estado === 'NO_CONTACTAR' || l.estadoCloser === 'PAGO';

const inicioDia = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
// Días naturales entre una fecha y hoy (ayer = 1)
export const diasDesde = (iso: string, ahora = Date.now()) => Math.round((inicioDia(ahora) - inicioDia(Date.parse(iso))) / DIA);
export const hoyISO = (ahora = Date.now()) => {
  const d = new Date(ahora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Canal propuesto cuando les escribiste hace 3 días o más y no han contestado
export function proponerCanal(ultimo: CanalEnvio | undefined, pidioInfo?: boolean): { canal: CanalEnvio; motivo: string } {
  if (ultimo && CANALES_ESCRITOS.includes(ultimo)) return { canal: 'llamada', motivo: `Escribiste por ${NOMBRE_CANAL[ultimo]} y no contesta: toca llamar.` };
  if (ultimo === 'llamada' && pidioInfo) return { canal: 'whatsapp', motivo: 'Llamaste y no lo cogió: como pidió info, puedes escribirle por WhatsApp.' };
  return { canal: 'llamada', motivo: 'Sin permiso para escribirle: vuelve a llamar a otra hora (primera hora o después de comer).' };
}

export interface FilaPendiente<T> { lead: T; ultimo: UltimoMensaje | null; dias: number; canalPropuesto?: { canal: CanalEnvio; motivo: string } }

// Cada clínica sale en una sola lista, la de más prioridad
export function calcularPendientes<T extends LeadConHistorial>(leads: T[], ahora = Date.now()) {
  const contestaron: FilaPendiente<T>[] = [], hoy: FilaPendiente<T>[] = [], sinRespuesta: FilaPendiente<T>[] = [];
  const hoyStr = hoyISO(ahora);
  for (const lead of leads) {
    if (fueraDeJuego(lead)) continue;
    const ultimo = ultimoMensaje(lead);
    const dias = ultimo ? diasDesde(ultimo.fecha, ahora) : 0;
    if (ultimo?.de === 'clinica') { contestaron.push({ lead, ultimo, dias }); continue; }
    if (lead.proximoFecha && lead.proximoFecha <= hoyStr) { hoy.push({ lead, ultimo, dias }); continue; }
    if (ultimo?.de === 'yo' && dias >= 3) sinRespuesta.push({ lead, ultimo, dias, canalPropuesto: proponerCanal(ultimo.canal, lead.pidioInfo) });
  }
  const t = (f: FilaPendiente<T>) => (f.ultimo ? Date.parse(f.ultimo.fecha) : 0);
  contestaron.sort((a, b) => t(a) - t(b)); // la que lleva más tiempo esperando, arriba
  hoy.sort((a, b) => (a.lead.proximoFecha! < b.lead.proximoFecha! ? -1 : 1));
  sinRespuesta.sort((a, b) => b.dias - a.dias);
  return { contestaron, hoy, sinRespuesta, total: contestaron.length + hoy.length + sinRespuesta.length };
}
