import React, { useState } from 'react';
import { AlertTriangle, CalendarClock, Clock, ChevronRight } from 'lucide-react';
import { CanalEnvio, CANALES_CONTROL, NOMBRE_CANAL, LeadConHistorial, FilaPendiente, ultimoMensaje, fechaHora, hoyISO, diasDesde, calcularPendientes } from './historial';

export type CamposControl = Pick<LeadConHistorial, 'ultimoMensajeDe' | 'ultimoMensajeFecha' | 'ultimoMensajeCanal' | 'proximoTexto' | 'proximoFecha'>;
export interface LeadP extends LeadConHistorial { nombre: string; telefono: string }

const aInputLocal = (iso?: string) => {
  if (!iso || !isFinite(Date.parse(iso))) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const cuando = (dias: number) => (dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`);

// Los dos botones rápidos: rellenan solos quién escribió y la fecha y hora
export function BotonesMensaje<T extends LeadP>({ lead, marcar, bloqueada }: { lead: T; marcar: (l: T, de: 'yo' | 'clinica', canal: CanalEnvio) => void; bloqueada?: boolean }) {
  const [canal, setCanal] = useState<CanalEnvio>(ultimoMensaje(lead)?.canal && CANALES_CONTROL.includes(ultimoMensaje(lead)!.canal!) ? ultimoMensaje(lead)!.canal! : 'whatsapp');
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select value={canal} onChange={(e) => setCanal(e.target.value as CanalEnvio)} className="bg-black border border-white/15 rounded-lg px-2 py-1.5 text-[11px]" title="Canal del mensaje">
        {CANALES_CONTROL.map((c) => <option key={c} value={c}>{NOMBRE_CANAL[c]}</option>)}
      </select>
      <button disabled={bloqueada} onClick={() => marcar(lead, 'yo', canal)} className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-[11px] disabled:opacity-40">Le he escrito yo</button>
      <button disabled={bloqueada} onClick={() => marcar(lead, 'clinica', canal)} className="px-3 py-1.5 rounded-lg bg-[#c6ff00] text-black font-bold text-[11px] disabled:opacity-40">Me ha contestado</button>
    </div>
  );
}

// Tarjeta de la ficha: último mensaje (de, fecha y hora, canal) + próximo paso con fecha
export function ControlConversacion<T extends LeadP>({ lead, marcar, actualizar, bloqueada }: {
  lead: T;
  marcar: (l: T, de: 'yo' | 'clinica', canal: CanalEnvio) => void;
  actualizar: (id: string, cambios: Partial<CamposControl>) => void;
  bloqueada?: boolean;
}) {
  const u = ultimoMensaje(lead);
  const campo = 'mt-1 w-full bg-black border border-white/15 rounded-lg px-2 py-1.5 text-[12px]';
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
      <div className="font-bold text-[11px] tracking-widest text-white/60 flex items-center gap-2"><Clock size={14} className="text-[#c6ff00]" />CONTROL DE CONVERSACIÓN</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-white/40">ÚLTIMO MENSAJE DE</label>
          <select value={u?.de || ''} onChange={(e) => {
            const v = e.target.value as '' | 'yo' | 'clinica';
            if (!v) actualizar(lead.id, { ultimoMensajeDe: undefined, ultimoMensajeFecha: undefined, ultimoMensajeCanal: undefined });
            else actualizar(lead.id, { ultimoMensajeDe: v, ultimoMensajeFecha: u?.fecha || new Date().toISOString(), ultimoMensajeCanal: u?.canal || 'whatsapp' });
          }} className={campo}>
            <option value="">—</option><option value="yo">Yo</option><option value="clinica">La clínica</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/40">FECHA Y HORA</label>
          <input type="datetime-local" value={aInputLocal(u?.fecha)} disabled={!u} onChange={(e) => { if (e.target.value && u) actualizar(lead.id, { ultimoMensajeDe: u.de, ultimoMensajeCanal: u.canal, ultimoMensajeFecha: new Date(e.target.value).toISOString() }); }} className={campo} />
        </div>
        <div>
          <label className="text-[10px] text-white/40">CANAL</label>
          <select value={u?.canal && CANALES_CONTROL.includes(u.canal) ? u.canal : ''} disabled={!u} onChange={(e) => u && actualizar(lead.id, { ultimoMensajeDe: u.de, ultimoMensajeFecha: u.fecha, ultimoMensajeCanal: (e.target.value || undefined) as CanalEnvio | undefined })} className={campo}>
            <option value="">—</option>
            {CANALES_CONTROL.map((c) => <option key={c} value={c}>{NOMBRE_CANAL[c]}</option>)}
          </select>
        </div>
      </div>
      <BotonesMensaje lead={lead} marcar={marcar} bloqueada={bloqueada} />
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
        <div className="col-span-2">
          <label className="text-[10px] text-white/40">PRÓXIMO PASO</label>
          <input value={lead.proximoTexto || ''} onChange={(e) => actualizar(lead.id, { proximoTexto: e.target.value })} placeholder="Ej.: Llamar a Belén" className={campo} />
        </div>
        <div>
          <label className="text-[10px] text-white/40">FECHA</label>
          <input type="date" value={lead.proximoFecha || ''} onChange={(e) => actualizar(lead.id, { proximoFecha: e.target.value || undefined })} className={campo} />
        </div>
      </div>
      {lead.proximoFecha && <button onClick={() => actualizar(lead.id, { proximoTexto: undefined, proximoFecha: undefined })} className="text-[10px] text-white/40 underline">Quitar próximo paso (hecho)</button>}
    </div>
  );
}

function Fila<T extends LeadP>({ f, rojo, marcar, onAbrir }: { f: FilaPendiente<T>; rojo?: boolean; marcar: (l: T, de: 'yo' | 'clinica', canal: CanalEnvio) => void; onAbrir: (l: T) => void }) {
  const { lead, ultimo } = f;
  return (
    <div className={`p-3 rounded-xl border text-[12px] space-y-2 ${rojo ? 'bg-red-500/15 border-red-500/60' : 'bg-black border-white/10'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold">{lead.nombre}{lead.telefono ? <span className="font-normal text-white/50"> · {lead.telefono}</span> : null}</div>
          {ultimo && <div className={rojo ? 'text-red-200' : 'text-white/60'}>
            {ultimo.de === 'clinica' ? 'Te escribió' : 'Le escribiste'}{ultimo.canal ? ` por ${NOMBRE_CANAL[ultimo.canal]}` : ''} {cuando(f.dias)} · {fechaHora(ultimo.fecha)}
          </div>}
          {lead.proximoFecha && <div className="text-[#c6ff00] flex items-center gap-1"><CalendarClock size={11} />{lead.proximoTexto || 'Próximo paso'} · {lead.proximoFecha.split('-').reverse().join('/')}{lead.proximoFecha < hoyISO() ? ` (atrasado ${diasDesde(lead.proximoFecha + 'T12:00:00')} d)` : ''}</div>}
          {f.canalPropuesto && <div className="text-amber-300">Propuesta: {NOMBRE_CANAL[f.canalPropuesto.canal].toUpperCase()}. {f.canalPropuesto.motivo}</div>}
        </div>
        <button onClick={() => onAbrir(lead)} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[11px] font-bold flex items-center gap-1">Abrir ficha <ChevronRight size={12} /></button>
      </div>
      <BotonesMensaje lead={lead} marcar={marcar} />
    </div>
  );
}

function Seccion<T extends LeadP>({ titulo, vacio, filas, rojo, marcar, onAbrir }: { titulo: string; vacio: string; filas: FilaPendiente<T>[]; rojo?: boolean; marcar: (l: T, de: 'yo' | 'clinica', canal: CanalEnvio) => void; onAbrir: (l: T) => void }) {
  return (
    <div className="space-y-2">
      <div className={`font-bold text-[11px] tracking-widest flex items-center gap-2 ${rojo ? 'text-red-300' : 'text-white/60'}`}>{rojo && <AlertTriangle size={13} />}{titulo} · {filas.length}</div>
      {filas.length === 0 ? <div className="text-[11px] text-white/30 px-1">{vacio}</div> : filas.map((f) => <Fila key={f.lead.id} f={f} rojo={rojo} marcar={marcar} onAbrir={onAbrir} />)}
    </div>
  );
}

export function PanelPendientes<T extends LeadP>({ leads, marcar, onAbrir }: { leads: T[]; marcar: (l: T, de: 'yo' | 'clinica', canal: CanalEnvio) => void; onAbrir: (l: T) => void }) {
  const p = calcularPendientes(leads);
  return (
    <div className="p-4 space-y-6">
      <Seccion titulo="TE HAN CONTESTADO Y NO HAS RESPONDIDO" vacio="Nadie esperando respuesta tuya." filas={p.contestaron} rojo marcar={marcar} onAbrir={onAbrir} />
      <Seccion titulo="SEGUIMIENTOS QUE TOCAN HOY O ESTÁN ATRASADOS" vacio="Ningún próximo paso con fecha de hoy o anterior." filas={p.hoy} marcar={marcar} onAbrir={onAbrir} />
      <Seccion titulo="LES ESCRIBISTE HACE 3 DÍAS O MÁS Y NO HAN CONTESTADO" vacio="Ninguna lleva 3 días o más sin respuesta." filas={p.sinRespuesta} marcar={marcar} onAbrir={onAbrir} />
    </div>
  );
}
