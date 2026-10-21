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

export interface LeadConHistorial {
  id: string;
  estado: string;
  ultimoContacto?: string;
  seguimientos?: number;
  historial?: Evento[];
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
