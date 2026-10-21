import React, { useMemo, useRef, useState } from 'react';
import { Clock, MessageSquare, Phone, Mail, Instagram, StickyNote, Download, Upload, ChevronRight, CheckCircle2, X, Search, AlertTriangle } from 'lucide-react';
import { Evento, CanalEnvio, proximoPaso, fechaCorta, fechaHora, fusionar } from './historial';

export interface LeadH {
  id: string;
  nombre: string;
  telefono: string;
  web: string;
  nicho: string;
  ciudad: string;
  estado: string;
  instagram?: string;
  ultimoContacto?: string;
  seguimientos?: number;
  historial?: Evento[];
}

type Filtro = 'hoy' | 'espera' | 'respondieron' | 'cerrados' | 'todos';

const ICONO: Record<CanalEnvio, any> = { email: Mail, whatsapp: MessageSquare, instagram: Instagram, llamada: Phone, otro: StickyNote };
const NOMBRE_CANAL: Record<CanalEnvio, string> = { email: 'Email', whatsapp: 'WhatsApp', instagram: 'Instagram', llamada: 'Llamada', otro: 'Otro' };
const NOMBRE_TIPO: Record<Evento['tipo'], string> = { contacto: 'Primer contacto', seguimiento: 'Seguimiento', respuesta: 'Respuesta', nota: 'Nota', estado: 'Estado' };

export default function Historial<T extends LeadH>(props: {
  leads: T[];
  setLeads: (f: (prev: T[]) => T[]) => void;
  registrar: (id: string, ev: Evento, cambios?: Partial<T>) => void;
  onAbrir: (l: T) => void;
}) {
  const { leads, setLeads, registrar, onAbrir } = props;
  const [filtro, setFiltro] = useState<Filtro>('hoy');
  const [busca, setBusca] = useState('');
  const [abierto, setAbierto] = useState<string>('');
  const [texto, setTexto] = useState('');
  const [canalNota, setCanalNota] = useState<CanalEnvio>('instagram');
  const [aviso, setAviso] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Todo lo que ya se ha tocado, sin depender del nicho o la ciudad del buscador
  const contactados = useMemo(() => leads.filter((l) => l.estado !== 'NUEVO' || (l.historial?.length || 0) > 0), [leads]);

  const grupo = (l: T): Exclude<Filtro, 'todos'> => {
    if (l.estado === 'CALIENTE') return 'respondieron';
    if (l.estado === 'NO_INTERESADO') return 'cerrados';
    return proximoPaso(l).vencido ? 'hoy' : 'espera';
  };

  const conteo = useMemo(() => {
    const c = { hoy: 0, espera: 0, respondieron: 0, cerrados: 0, todos: contactados.length };
    contactados.forEach((l) => c[grupo(l)]++);
    return c;
  }, [contactados]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contactados
      .filter((l) => filtro === 'todos' || grupo(l) === filtro)
      .filter((l) => !q || (l.nombre + ' ' + (l.instagram || '') + ' ' + l.telefono).toLowerCase().includes(q))
      .sort((a, b) => (proximoPaso(a).fecha ?? Infinity) - (proximoPaso(b).fecha ?? Infinity));
  }, [contactados, filtro, busca]);

  const exportar = () => {
    const blob = new Blob([JSON.stringify({ app: 'closer', version: 1, fecha: new Date().toISOString(), leads }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `closer-copia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    try { localStorage.setItem('closer_ultima_copia', new Date().toISOString()); } catch {}
    setAviso(`Copia descargada: ${leads.length} leads.`);
  };

  const importar = async (f?: File) => {
    if (!f) return;
    try {
      const datos = JSON.parse(await f.text());
      const copia = Array.isArray(datos) ? datos : datos?.leads;
      if (!Array.isArray(copia)) throw new Error('El archivo no es una copia de Closer.');
      let r = { nuevos: 0, actualizados: 0 };
      setLeads((prev) => { const x = fusionar(prev, copia as T[]); r = x; return x.leads; });
      setTimeout(() => setAviso(`Copia cargada: ${r.nuevos} leads nuevos y ${r.actualizados} actualizados. No se ha borrado nada.`), 0);
    } catch (e: any) {
      setAviso(e.message || 'No se pudo leer el archivo.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const ultimaCopia = (() => { try { return localStorage.getItem('closer_ultima_copia') || ''; } catch { return ''; } })();
  const diasSinCopia = ultimaCopia ? Math.floor((Date.now() - Date.parse(ultimaCopia)) / 86_400_000) : null;

  const pasoTexto = (l: T) => {
    const p = proximoPaso(l);
    if (l.estado === 'CALIENTE') return { t: 'Ha respondido: sigue la conversación', c: 'text-[#c6ff00]' };
    if (l.estado === 'NO_INTERESADO') return { t: 'Cerrado', c: 'text-white/40' };
    if (p.tipo === 'ninguno' || p.fecha === null) return { t: 'Sin fecha de contacto', c: 'text-white/40' };
    const cuando = p.vencido ? 'toca hoy' : fechaCorta(p.fecha);
    if (p.tipo === 'cerrar') return { t: `Sin respuesta tras 2 seguimientos: cerrar (${cuando})`, c: p.vencido ? 'text-red-300' : 'text-white/60' };
    return { t: `${p.tipo === 'seguimiento1' ? '1.er' : '2.º'} seguimiento: ${cuando}`, c: p.vencido ? 'text-amber-300' : 'text-white/60' };
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Clock size={16} className="text-[#c6ff00]" /><span className="font-display font-bold text-sm">HISTORIAL DE CONTACTADOS · {contactados.length}</span></div>
        <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-black border border-white/15 rounded-lg px-3">
          <Search size={12} className="text-white/40" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre, @instagram o teléfono" className="flex-1 bg-transparent py-2 text-[12px] outline-none" />
        </div>
        <button onClick={exportar} className="px-3 py-2 rounded-lg bg-white text-black font-bold text-[11px] flex items-center gap-1"><Download size={12} /> DESCARGAR COPIA</button>
        <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 font-bold text-[11px] flex items-center gap-1"><Upload size={12} /> CARGAR COPIA</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importar(e.target.files?.[0])} />
      </div>

      <div className="text-[11px] flex items-start gap-2 text-white/50">
        <AlertTriangle size={12} className="mt-0.5 text-amber-300 shrink-0" />
        <span>El historial se guarda en este navegador. Si borras los datos del navegador o entras desde otro dispositivo, no estará. {diasSinCopia === null ? 'Aún no has descargado ninguna copia.' : `Última copia hace ${diasSinCopia} días.`} Descarga una copia cada semana; con «Cargar copia» la recuperas en cualquier dispositivo sin borrar nada.</span>
      </div>
      {aviso && <div className="text-[11px] text-[#c6ff00] flex items-center gap-2"><CheckCircle2 size={12} /> {aviso} <button onClick={() => setAviso('')}><X size={12} /></button></div>}

      <div className="flex flex-wrap gap-1">
        {([['hoy', 'TOCA HOY'], ['espera', 'EN ESPERA'], ['respondieron', 'HAN RESPONDIDO'], ['cerrados', 'CERRADOS'], ['todos', 'TODOS']] as [Filtro, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)} className={`px-3 py-1.5 rounded-lg font-bold text-[10px] border ${filtro === id ? 'bg-[#c6ff00] text-black border-[#c6ff00]' : 'bg-black text-white/70 border-white/15'}`}>{label} · {conteo[id]}</button>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="rounded-2xl border border-white/10 p-10 text-center text-white/30 text-sm">
          {contactados.length === 0 ? 'Aún no has contactado a nadie. Al pulsar «Marcar como contactado» en el paso 3, el lead aparece aquí con el mensaje que enviaste.' : filtro === 'hoy' ? 'Hoy no toca ningún seguimiento.' : 'No hay leads en este grupo.'}
        </div>
      )}

      <div className="space-y-2">
        {lista.map((l) => {
          const p = pasoTexto(l);
          const hist = [...(l.historial || [])].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
          const primero = (l.historial || []).find((e) => e.tipo === 'contacto');
          const esAbierto = abierto === l.id;
          const proximo = proximoPaso(l);
          return (
            <div key={l.id} className="rounded-2xl bg-white/[0.04] border border-white/10">
              <button onClick={() => { setAbierto(esAbierto ? '' : l.id); setTexto(''); }} className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-[180px] flex-1">
                  <div className="font-display font-bold text-sm">{l.nombre}</div>
                  <div className="text-[10px] text-white/40">{l.nicho} · {l.ciudad}{l.instagram ? ` · @${l.instagram}` : ''}{l.telefono ? ` · ${l.telefono}` : ''}</div>
                </div>
                <div className="text-[11px] text-white/60">{primero ? `Contactado ${fechaCorta(primero.fecha)}${primero.canal ? ' por ' + NOMBRE_CANAL[primero.canal] : ''}` : l.ultimoContacto ? `Contactado ${fechaCorta(l.ultimoContacto)}` : ''} · {hist.length} {hist.length === 1 ? 'entrada' : 'entradas'}</div>
                <div className={`text-[11px] font-bold ${p.c}`}>{p.t}</div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-black border border-white/10">{l.estado}</span>
              </button>

              {esAbierto && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onAbrir(l)} className="px-3 py-2 rounded-lg bg-[#c6ff00] text-black font-bold text-[11px] flex items-center gap-1">VER MENSAJES DE SEGUIMIENTO <ChevronRight size={12} /></button>
                    {l.estado === 'CONTACTADO' && proximo.tipo !== 'cerrar' && (
                      <button onClick={() => registrar(l.id, { fecha: new Date().toISOString(), tipo: 'seguimiento', canal: primero?.canal, texto: `${proximo.tipo === 'seguimiento1' ? '1.er' : '2.º'} seguimiento enviado.` }, { ultimoContacto: new Date().toISOString(), seguimientos: (l.seguimientos || 0) + 1 } as Partial<T>)} className="px-3 py-2 rounded-lg bg-amber-400 text-black font-bold text-[11px]">MARCAR {proximo.tipo === 'seguimiento1' ? '1.er' : '2.º'} SEGUIMIENTO ENVIADO</button>
                    )}
                    {l.estado !== 'NO_INTERESADO' && (
                      <button onClick={() => registrar(l.id, { fecha: new Date().toISOString(), tipo: 'estado', texto: 'Cerrado sin respuesta o sin interés.' }, { estado: 'NO_INTERESADO' } as Partial<T>)} className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 font-bold text-[11px]">CERRAR</button>
                    )}
                    {l.estado === 'NO_INTERESADO' && (
                      <button onClick={() => registrar(l.id, { fecha: new Date().toISOString(), tipo: 'estado', texto: 'Reabierto.' }, { estado: 'CONTACTADO' } as Partial<T>)} className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 font-bold text-[11px]">REABRIR</button>
                    )}
                  </div>

                  <div className="rounded-xl bg-black border border-white/10 p-3 space-y-2">
                    <div className="text-[10px] text-white/40 font-bold tracking-widest">AÑADIR AL HISTORIAL</div>
                    <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pega lo que te ha contestado o escribe una nota (p. ej.: «llamé, me dice que hable con la dueña el lunes»)" className="w-full h-20 bg-black border border-white/15 rounded-lg p-2 text-[12px] outline-none focus:border-[#c6ff00]" />
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={canalNota} onChange={(e) => setCanalNota(e.target.value as CanalEnvio)} className="bg-black border border-white/15 rounded px-2 py-1.5 text-[11px]">
                        {(Object.keys(NOMBRE_CANAL) as CanalEnvio[]).map((c) => <option key={c} value={c}>{NOMBRE_CANAL[c]}</option>)}
                      </select>
                      <button disabled={!texto.trim()} onClick={() => { registrar(l.id, { fecha: new Date().toISOString(), tipo: 'respuesta', canal: canalNota, texto: texto.trim() }, { estado: 'CALIENTE' } as Partial<T>); setTexto(''); }} className="px-3 py-1.5 rounded-lg bg-[#c6ff00] text-black font-bold text-[11px] disabled:opacity-30">GUARDAR COMO RESPUESTA SUYA</button>
                      <button disabled={!texto.trim()} onClick={() => { registrar(l.id, { fecha: new Date().toISOString(), tipo: 'nota', canal: canalNota, texto: texto.trim() }); setTexto(''); }} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 font-bold text-[11px] disabled:opacity-30">GUARDAR COMO NOTA</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {hist.map((e, i) => {
                      const Icono = e.canal ? ICONO[e.canal] : StickyNote;
                      return (
                        <div key={i} className={`p-3 rounded-xl border text-[12px] ${e.tipo === 'respuesta' ? 'bg-[#c6ff00]/10 border-[#c6ff00]/30' : 'bg-black border-white/10'}`}>
                          <div className="flex items-center gap-2 text-[10px] text-white/50 mb-1">
                            <Icono size={11} /><span className="font-bold text-white/80">{NOMBRE_TIPO[e.tipo]}</span>{e.canal && <span>· {NOMBRE_CANAL[e.canal]}</span>}<span className="ml-auto">{fechaHora(e.fecha)}</span>
                          </div>
                          {e.texto && <div className="whitespace-pre-wrap leading-relaxed text-white/80">{e.texto}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
