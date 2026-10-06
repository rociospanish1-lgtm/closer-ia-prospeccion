import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Trash2, Edit3, Check, Copy, Mail, MessageSquare, Phone, X,
  MapPin, Globe, Star, Zap, Target, Brain, DollarSign, Link2, Clock, AlertTriangle,
  ChevronRight, Building2, FileText, Mic, Send, CheckCircle2, Ban, Eye, Settings,
  User, Sparkles, Flame
} from 'lucide-react';
import { Ficha, ganchos, construirMensajes, lineaPositiva, tratamientoPorDefecto } from './personalizacion';

// Planes de la agencia (rociopinedaia.es). Precios sin IVA.
const PLANES = [
  { id: 'esencial', nombre: 'Esencial', cuota: 149, alta: 390, para: 'clínicas de 1–2 profesionales', plazo: '5–7 días laborables',
    incluye: ['Agente de WhatsApp 24/7 (dudas, precios, tratamientos, horarios)', 'Capta los datos del cliente y avisa a la clínica', 'Hasta 300 conversaciones al mes', 'Ajuste fino 2 semanas'] },
  { id: 'pro', nombre: 'Pro', cuota: 279, alta: 790, para: 'clínicas de 2–5 profesionales', plazo: '7–10 días laborables',
    incluye: ['Todo lo del Esencial', 'Agenda citas sola en su calendario', 'Recordatorios para reducir ausencias', 'Instagram (mensajes directos)', 'Panel de contactos · hasta 600 conversaciones/mes'] },
  { id: 'premium', nombre: 'Premium', cuota: 590, alta: 1490, para: 'clínicas grandes o con varias sedes', plazo: '2–3 semanas',
    incluye: ['Todo lo del Pro', 'Agente de voz para llamadas perdidas y fuera de horario', 'Conexión con su programa de gestión', 'Campaña mensual de reactivación', 'Informe mensual · 1.200 conversaciones + 300 min'] },
] as const;
type PlanId = typeof PLANES[number]['id'];
const conIva = (n: number) => Math.round(n * 1.21 * 100) / 100;
const euro = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

// CONSTANTE EXACTA REQUERIDA
const OBJECIONES_V4 = [
  {key:'Prefiero humanos', estrategia:'Validar → explicar modelo híbrido → comprobar si ese enfoque encaja', queEvitar:'No intentar convencer de que la IA sustituye a las personas', ejemplo:'Entiendo perfectamente. La idea no es sustituir a vuestro equipo. El agente puede encargarse de las consultas repetitivas y pasar a una persona los casos que necesitan atención humana. Así el equipo se centra en lo importante.'},
  {key:'Ya tengo WhatsApp', estrategia:'Diferenciar canal de comunicación frente a automatización → explicar qué añade el agente', queEvitar:'No decir que su WhatsApp no sirve ni minimizar su sistema actual', ejemplo:'Perfecto. WhatsApp seguiría siendo vuestro canal. La diferencia es que el agente puede responder automáticamente a las consultas habituales, informar sobre servicios y horarios y, cuando haga falta, derivar la conversación a vuestro equipo.'},
  {key:'Es caro', estrategia:'Validar → entender qué está comparando → explicar el alcance si aporta valor → no defender el precio automáticamente', queEvitar:'No preguntar directamente por su presupuesto salvo que tenga sentido en el contexto. No inventar un retorno económico.', ejemplo:'Lo entiendo. Para valorar si realmente os compensa, lo importante es ver qué problema concreto queremos resolver y qué parte del trabajo puede automatizarse. Si quieres, te explico exactamente qué incluye y puedes valorar si encaja.'},
  {key:'Me lo pienso', estrategia:'Clasificar como SEGUIMIENTO → aportar valor relacionado con la conversación → dejar espacio', queEvitar:'No preguntar "¿lo has pensado?", "¿te has decidido?" ni crear urgencia falsa', ejemplo:'Claro, sin problema. En vuestro caso, lo importante sería que el agente se encargara de [problema concreto] y derivara al equipo los casos que necesitan atención humana. Así podéis valorarlo con calma.'},
  {key:'No me interesa', estrategia:'Clasificar como NO_INTERESADO → cerrar cordialmente → detener el proceso comercial', queEvitar:'No intentar darle la vuelta automáticamente ni presentar otra oferta', ejemplo:'Sin problema, gracias por decírmelo claro. Cierro aquí el tema. Que vaya todo genial con el negocio.'},
  {key:'No me contactes más', estrategia:'Clasificar inmediatamente como NO_CONTACTAR → detener cualquier seguimiento o contacto comercial', queEvitar:'No hacer preguntas, no ofrecer alternativas y no intentar recuperar la venta', ejemplo:'Entendido. Cierro el tema y no volveré a contactarte por esto. Gracias por decírmelo.'},
  {key:'¿Cuánto cuesta?', estrategia:'Si existe problema + encaje + contexto suficiente, responder directamente con el precio del servicio adecuado y explicar brevemente qué incluye', queEvitar:'No ocultar el precio innecesariamente ni enviar el enlace de pago a un prospecto que todavía está frío', ejemplo:'Por lo que hemos hablado, os encaja el plan [plan]: [cuota] €/mes + IVA y [alta] € + IVA de alta, que incluye montarlo, probarlo con vosotros y ajustarlo dos semanas. [retorno]Si quieres avanzar, te explico el siguiente paso.'},
  {key:'No necesito IA', estrategia:'No discutir → entender si realmente no existe una necesidad o si simplemente no quiere utilizar IA → si no hay necesidad, cerrar', queEvitar:'No intentar convencer de que necesita IA', ejemplo:'Perfecto, lo entiendo. Al final lo importante no es utilizar IA por utilizarla, sino que resuelva un problema real. Si ahora mismo no tenéis esa necesidad, no tendría sentido añadir nada.'},
  {key:'Ya tengo a alguien', estrategia:'Validar → diferenciar sustitución de apoyo → comprobar si existe alguna tarea repetitiva que actualmente recaiga sobre esa persona', queEvitar:'No cuestionar al empleado ni plantear la IA como sustitución automática', ejemplo:'Perfecto. De hecho, puede complementar perfectamente ese trabajo. La idea sería quitarle las consultas repetitivas y dejarle los casos que realmente necesitan intervención.'},
  {key:'Ahora no', estrategia:'No presionar → identificar si es un problema de momento o falta de interés → si pide retomarlo más adelante, clasificar como SEGUIMIENTO', queEvitar:'No crear urgencia artificial', ejemplo:'Entendido, ningún problema. Si ahora no es el momento, lo dejamos aquí. Si más adelante quieres retomarlo, seguimos desde donde lo dejamos.'},
  {key:'No quiero cambiar nada', estrategia:'Validar → no intentar imponer un cambio → explicar únicamente si existe una mejora que pueda integrarse sin alterar la operativa actual', queEvitar:'No presentar el cambio como obligatorio', ejemplo:'Lo entiendo. Precisamente por eso, si algún día lo valoráis, la idea sería integrarlo en vuestra forma de trabajar sin tener que cambiar todo el sistema.'}
];

type EstadoLead = 'NUEVO' | 'CONTACTADO' | 'CALIENTE' | 'NO_INTERESADO';
type EstadoCloser = 'FRIO' | 'INTERACCION' | 'PROBLEMA_DETECTADO' | 'INTERES' | 'CUALIFICADO' | 'INTENCION_COMPRA' | 'OFERTA_PRESENTADA' | 'PAGO' | 'NO_INTERESADO' | 'SEGUIMIENTO' | 'NO_CONTACTAR';

interface Lead {
  id: string;
  nombre: string;
  web: string;
  telefono: string;
  direccion: string;
  rating: string;
  reviews: string;
  estado: EstadoLead;
  nicho: string;
  ciudad: string;
  huecos?: string[];
  seoScore?: number;
  velocidad?: string;
  analisisEstado?: 'ok' | 'error';
  analisisError?: string;
  ultimoContacto?: string;
  seguimientos?: number;
  ficha?: Ficha;
}

interface Analisis {
  observaciones: string;
  checks: string[];
  seoScore: number;
  velocidad: string;
  trafico: string;
  oportunidad: string;
  angulo: string;
}

const ESTADOS_ORDEN: Record<string, number> = {
  FRIO: 0, INTERACCION: 1, PROBLEMA_DETECTADO: 2, INTERES: 3, CUALIFICADO: 4, INTENCION_COMPRA: 5, OFERTA_PRESENTADA: 6, PAGO: 7
};

const CHECKLIST_ITEMS = [
  { id: 'sin_reservas', label: 'Sin reservas online', impact: 'Pierde citas fuera de horario' },
  { id: 'sin_pixel', label: 'Sin píxel / sin medición', impact: 'No hace retargeting' },
  { id: 'lenta', label: 'Web lenta (>3s)', impact: 'Carga lenta en móvil' },
  { id: 'sin_whatsapp', label: 'Sin WhatsApp visible', impact: 'Fricción para contactar' },
  { id: 'sin_schema', label: 'Sin schema / SEO local', impact: 'Invisible en Maps' },
  { id: 'imagenes', label: 'Imágenes pesadas', impact: 'Experiencia móvil pobre' },
];

const ACTIVACION_CHECKS = [
  'Problema concreto identificado en web',
  'Prospecto interactuó / respondió',
  'Encaje claro con agente WhatsApp IA',
  'Volumen de consultas repetitivas',
  'Decisor contactado',
  'Presupuesto / timing hablado'
];

export default function App() {
  const [step, setStep] = useState(1);
  const [miNombre, setMiNombre] = useState(() => { try { return localStorage.getItem('closer_nombre') || 'Rocío'; } catch { return 'Rocío'; } });
  const [miAgencia, setMiAgencia] = useState(() => { try { return (()=>{ const v = localStorage.getItem('closer_agencia'); return !v || v === 'Agencia de Agentes IA' ? 'Agencia de automatización' : v; })(); } catch { return 'Agencia de automatización'; } });
  const [miTelefono, setMiTelefono] = useState(() => { try { return localStorage.getItem('closer_telefono') || ''; } catch { return ''; } });
  const [miEmail, setMiEmail] = useState(() => { try { return localStorage.getItem('closer_email') || ''; } catch { return ''; } });
  useEffect(()=>{ try { localStorage.setItem('closer_nombre', miNombre); localStorage.setItem('closer_agencia', miAgencia); localStorage.setItem('closer_telefono', miTelefono); localStorage.setItem('closer_email', miEmail); } catch {} },[miNombre, miAgencia, miTelefono, miEmail]);


  const [nicho, setNicho] = useState('Clínica Dental');
  const [ciudad, setCiudad] = useState('Sevilla');
  const [keyword, setKeyword] = useState('');
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem('closer_leads');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [newLead, setNewLead] = useState<Partial<Lead>>({ nombre: '', web: '', telefono: '', direccion: '', rating: '4.5', reviews: '12', estado: 'NUEVO' });
  const [bulk, setBulk] = useState('');
  const [analisis, setAnalisis] = useState<Analisis>({
    observaciones: '',
    checks: [],
    seoScore: 4,
    velocidad: '4.2s',
    trafico: '~1.2k / mes',
    oportunidad: '',
    angulo: ''
  });
  const [prospectTab, setProspectTab] = useState<'email'|'whatsapp'|'llamada'>('email');
  const [emailTpl, setEmailTpl] = useState('');
  const [waTpl, setWaTpl] = useState('');
  const [callTpl, setCallTpl] = useState('');
  const [vozNombre, setVozNombre] = useState('');
  const [vozEmpresa, setVozEmpresa] = useState('');
  const [vozFallo, setVozFallo] = useState('');
  const [vozTab, setVozTab] = useState<'inicial'|'seguimiento'|'cierre'>('inicial');
  const [closerChecks, setCloserChecks] = useState<string[]>([]);
  const [estadoCloser, setEstadoCloser] = useState<EstadoCloser>('FRIO');
  const [chatInput, setChatInput] = useState('');
  const [chatHist, setChatHist] = useState<{role:'prospecto'|'ia', text:string, objecion?: typeof OBJECIONES_V4[0], estado?: EstadoCloser}[]>([]);
  const [problemaConcreto, setProblemaConcreto] = useState('gestión de citas fuera de horario');
  const [planId, setPlanId] = useState<PlanId>('pro');
  const [fasePago, setFasePago] = useState<'firma'|'activacion'>('firma');
  const plan = PLANES.find(p=>p.id===planId)!;
  const [importe, setImporte] = useState(String(conIva(790/2)));
  const [concepto, setConcepto] = useState('Agente IA plan Pro — 50 % del alta (al firmar)');
  const [stripeLink, setStripeLink] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [linkGenerado, setLinkGenerado] = useState('');
  const [tratamiento, setTratamiento] = useState('');
  const [contacto, setContacto] = useState('');
  const [frase2, setFrase2] = useState('');
  const [seg1Tpl, setSeg1Tpl] = useState('');
  const [seg2Tpl, setSeg2Tpl] = useState('');
  const [calidad, setCalidad] = useState<{ok:boolean; texto:string}[]>([]);

  useEffect(()=>{
    try { localStorage.setItem('closer_leads', JSON.stringify(leads)); } catch {}
  },[leads]);

  const selectedLead = useMemo(() => leads.find(l=>l.id===selectedId) || null, [leads, selectedId]);

  // Auto rellenar voz
  useEffect(()=>{
    if(selectedLead){
      setVozNombre('');
      setVozEmpresa(selectedLead.nombre);
      if(analisis.oportunidad) setVozFallo(analisis.oportunidad);
    }
  },[selectedLead?.id, analisis.oportunidad]);

  // Al cambiar de lead: tratamiento principal sacado de su web
  useEffect(()=>{
    setTratamiento(selectedLead?.ficha?.tratamientos?.[0] || '');
    setContacto('');
  },[selectedLead?.id, selectedLead?.ficha]);

  const tratamientoMsg = tratamiento.trim() || tratamientoPorDefecto(selectedLead?.nicho || nicho);

  // Gancho principal + segundo dato, a partir de lo que se ha visto en SU web
  useEffect(()=>{
    if(!selectedLead) return;
    if(!selectedLead.ficha && analisis.checks.length===0) return;
    const lista = ganchos(selectedLead, analisis.checks, tratamientoMsg);
    const positivo = lineaPositiva(selectedLead);
    setAnalisis(prev=>({...prev, oportunidad: lista[0].frase, angulo: lista[0].id }));
    void positivo;
    // Segundo fallo: solo si sale de su web. Nunca rellenar con frases genéricas ni con la línea positiva.
    setFrase2(lista[1]?.concreto ? lista[1].frase : '');
  },[analisis.checks, selectedLead?.id, selectedLead?.ficha, tratamientoMsg]);

  // Mensajes personalizados (email, DM, llamada, seguimientos y voz)
  const mensajes = useMemo(()=>{
    if(!selectedLead) return null;
    return construirMensajes({
      lead: selectedLead,
      frase: analisis.oportunidad || `me gustaría saber qué pasa con las consultas sobre ${tratamientoMsg} que os llegan fuera de horario`,
      frase2,
      tratamiento: tratamientoMsg,
      tratamientoPropio: tratamiento.trim() !== '',
      contacto: contacto.trim() || vozNombre.trim(),
      firma: { nombre: miNombre, agencia: miAgencia, telefono: miTelefono, email: miEmail },
    });
  },[selectedLead, analisis.oportunidad, frase2, tratamientoMsg, tratamiento, contacto, vozNombre, miNombre, miAgencia, miTelefono, miEmail]);

  useEffect(()=>{
    if(!mensajes) return;
    setEmailTpl(mensajes.email);
    setWaTpl(mensajes.dm);
    setCallTpl(mensajes.llamada);
    setSeg1Tpl(mensajes.seguimiento1);
    setSeg2Tpl(mensajes.seguimiento2);
    setCalidad(mensajes.calidad);
  },[mensajes]);

  const vozScripts = useMemo(()=>({
    inicial: mensajes?.vozInicial || '',
    seguimiento: mensajes?.vozSeguimiento || '',
    cierre: mensajes?.vozCierre || '',
  }),[mensajes]);

  const currentScript = vozScripts[vozTab];
  const wordCount = currentScript.split(/\s+/).filter(Boolean).length;
  const timeEst = Math.round((wordCount / 165) * 60); // seg

  const handleAddLead = () => {
    if(!newLead.nombre) return;
    const l: Lead = {
      id: Date.now().toString(),
      nombre: newLead.nombre || '',
      web: newLead.web || '',
      telefono: newLead.telefono || '',
      direccion: newLead.direccion || '',
      rating: newLead.rating || '4.5',
      reviews: newLead.reviews || '0',
      estado: (newLead.estado as EstadoLead) || 'NUEVO',
      nicho, ciudad
    };
    setLeads(prev=>[l, ...prev]);
    setNewLead({ nombre:'', web:'', telefono:'', direccion:'', rating:'4.5', reviews:'12', estado:'NUEVO' });
    setShowAdd(false);
  };

  const handleBulkAdd = () => {
    if(!bulk.trim()) return;
    const lines = bulk.split('\n').filter(l=>l.trim());
    const newOnes: Lead[] = lines.map((line, i)=>{
      const parts = line.split(/[,;|]\s*/);
      return {
        id: (Date.now()+i).toString(),
        nombre: parts[0] || `Lead ${i+1}`,
        web: parts[1] || '',
        telefono: parts[2] || '',
        direccion: parts[3] || '',
        rating: parts[4] || '4.5',
        reviews: parts[5] || '0',
        estado: 'NUEVO' as EstadoLead,
        nicho, ciudad
      };
    });
    setLeads(prev=>[...newOnes, ...prev]);
    setBulk('');
  };

  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState('');

  const handleAnalizarWeb = async () => {
    if(!selectedLead || analizando) return;
    if(!selectedLead.web){ setErrorAnalisis('Este lead no tiene web. Es un hueco en sí mismo: ofrécele web + agente.'); return; }
    setAnalizando(true);
    setErrorAnalisis('');
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: selectedLead.web }),
      });
      const data = await r.json();
      if(!r.ok) throw new Error(data?.error || 'Error analizando la web');
      if(data.ficha) setLeads(prev=>prev.map(x=>x.id===selectedLead.id ? {...x, ficha: data.ficha, huecos: data.checks, seoScore: data.seoScore, velocidad: data.velocidad, analisisEstado:'ok', analisisError:''} : x));
      setAnalisis(prev=>({
        ...prev,
        checks: data.checks,
        seoScore: data.seoScore,
        velocidad: data.velocidad,
        observaciones: `Análisis automático: WhatsApp ${data.detalle.tieneWhatsapp?'sí':'no'}, reservas online ${data.detalle.tieneReservas?'sí':'no'}, píxel/analítica ${data.detalle.tienePixel?'sí':'no'}, schema local ${data.detalle.tieneSchema?'sí':'no'}, ${data.detalle.imagenes} imágenes.`
      }));
    } catch(e: any) {
      setErrorAnalisis(e.message || 'Error de conexión');
    } finally {
      setAnalizando(false);
    }
  };

  const [analizandoTodos, setAnalizandoTodos] = useState(false);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  type Pestana = 'todos' | 'prioritarios' | 'web' | 'sinhuecos' | 'pendientes' | 'seguimiento';
  const [pestana, setPestana] = useState<Pestana>('todos');

  const HUECOS_CLAVE = ['sin_whatsapp', 'sin_reservas'];
  const puntosHuecos = (l: Lead) => (l.huecos || []).filter(h => HUECOS_CLAVE.includes(h)).length;

  const handleAnalizarTodos = async () => {
    if(analizandoTodos) return;
    const pendientes = leads.filter(l => l.web && l.analisisEstado !== 'ok');
    if(pendientes.length === 0) return;
    setAnalizandoTodos(true);
    setProgreso({ hecho: 0, total: pendientes.length });
    let i = 0;
    const worker = async () => {
      while(i < pendientes.length){
        const l = pendientes[i++];
        let cambio: Partial<Lead>;
        try {
          const r = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: l.web }),
          });
          const d = await r.json();
          cambio = r.ok
            ? { huecos: d.checks, seoScore: d.seoScore, velocidad: d.velocidad, ficha: d.ficha, analisisEstado: 'ok', analisisError: '' }
            : { analisisEstado: 'error', analisisError: d?.error || 'Error' };
        } catch {
          cambio = { analisisEstado: 'error', analisisError: 'Error de conexión' };
        }
        setLeads(prev => prev.map(x => x.id === l.id ? { ...x, ...cambio } : x));
        setProgreso(pr => ({ ...pr, hecho: pr.hecho + 1 }));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setAnalizandoTodos(false);
  };

  const handleBuscarReal = async () => {
    if(!nicho || !ciudad || buscando) return;
    setBuscando(true);
    setErrorBusqueda('');
    try {
      const r = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicho, ciudad, keyword }),
      });
      const data = await r.json();
      if(!r.ok) throw new Error(data?.error || 'Error en la búsqueda');
      const nuevos: Lead[] = (data.leads || []).map((p: any) => ({
        id: `g-${p.id}`,
        nombre: p.name,
        web: p.web,
        telefono: p.phone,
        direccion: p.address,
        rating: String(p.rating || 0),
        reviews: String(p.reviews || 0),
        estado: 'NUEVO' as EstadoLead,
        nicho, ciudad
      }));
      setLeads(prev => {
        const ids = new Set(prev.map(l => l.id));
        return [...nuevos.filter(l => !ids.has(l.id)), ...prev];
      });
      if(nuevos.length === 0) setErrorBusqueda('Sin resultados para esa búsqueda.');
    } catch(e: any) {
      setErrorBusqueda(e.message || 'Error de conexión');
    } finally {
      setBuscando(false);
    }
  };

  const detectObjection = (text: string) => {
    const lower = text.toLowerCase();
    // orden especifico para matching
    if(lower.includes('no me contact') || lower.includes('no contactes')) return OBJECIONES_V4.find(o=>o.key==='No me contactes más')!;
    if(lower.includes('no me interesa')) return OBJECIONES_V4.find(o=>o.key==='No me interesa')!;
    if(lower.includes('me lo pienso') || lower.includes('lo pienso')) return OBJECIONES_V4.find(o=>o.key==='Me lo pienso')!;
    if(lower.includes('cuanto cuesta') || lower.includes('cuánto cuesta') || lower.includes('precio') || lower.includes('coste') || lower.includes('cuesta')) return OBJECIONES_V4.find(o=>o.key==='¿Cuánto cuesta?')!;
    if(lower.includes('prefiero human') || lower.includes('persona real')) return OBJECIONES_V4.find(o=>o.key==='Prefiero humanos')!;
    if(lower.includes('ya tengo whatsapp') || lower.includes('ya tenemos whatsapp')) return OBJECIONES_V4.find(o=>o.key==='Ya tengo WhatsApp')!;
    if(lower.includes('es caro') || lower.includes('muy caro') || lower.includes('carísimo')) return OBJECIONES_V4.find(o=>o.key==='Es caro')!;
    if(lower.includes('no necesito ia') || lower.includes('no necesitamos ia')) return OBJECIONES_V4.find(o=>o.key==='No necesito IA')!;
    if(lower.includes('ya tengo a alguien') || lower.includes('ya tengo equipo') || lower.includes('tenemos persona')) return OBJECIONES_V4.find(o=>o.key==='Ya tengo a alguien')!;
    if(lower.includes('ahora no') || lower.includes('ahora mismo no') || lower.includes('más adelante')) return OBJECIONES_V4.find(o=>o.key==='Ahora no')!;
    if(lower.includes('no quiero cambiar')) return OBJECIONES_V4.find(o=>o.key==='No quiero cambiar nada')!;
    return null;
  };

  const handleProspectChat = () => {
    if(!chatInput.trim()) return;
    const obj = detectObjection(chatInput);
    let newEstado: EstadoCloser = estadoCloser;
    if(obj){
      if(obj.key==='Me lo pienso') newEstado='SEGUIMIENTO';
      else if(obj.key==='No me interesa') newEstado='NO_INTERESADO';
      else if(obj.key==='No me contactes más') newEstado='NO_CONTACTAR';
      else if(obj.key==='¿Cuánto cuesta?') newEstado='INTENCION_COMPRA';
      else if(['Es caro'].includes(obj.key)) newEstado='CUALIFICADO';
      else if(estadoCloser==='FRIO') newEstado='INTERACCION';
      else if(ESTADOS_ORDEN[estadoCloser] !== undefined && ESTADOS_ORDEN[estadoCloser] < 2) newEstado='PROBLEMA_DETECTADO';
    } else {
      // heuristic
      const low = chatInput.toLowerCase();
      if(low.includes('interesa') || low.includes('cuéntame') || low.includes('más info')) newEstado='INTERES';
      else if(low.includes('ok') || low.includes('vale')) newEstado='INTERACCION';
    }
    const precioVisto = selectedLead?.ficha?.precio;
    const retorno = precioVisto ? `Con ${precioVisto.tratamiento} a ${precioVisto.euros} €, se paga con ${Math.ceil(plan.cuota / precioVisto.euros)} citas al mes. ` : '';
    const ejemploConProblema = obj ? obj.ejemplo.replace(/\[problema concreto\]/g, problemaConcreto).replace(/\[resumen de lo incluido\]/g, concepto).replace(/\[plan\]/g, plan.nombre).replace(/\[cuota\]/g, euro(plan.cuota)).replace(/\[alta\]/g, euro(plan.alta)).replace(/\[retorno\]/g, retorno) : `Perfecto, gracias por compartirlo. En vuestro caso con ${problemaConcreto}, ¿tiene sentido que veamos cómo encajaría?`;

    setChatHist(prev=>[
      ...prev,
      { role:'prospecto', text: chatInput, objecion: obj || undefined, estado: newEstado },
      { role:'ia', text: ejemploConProblema, objecion: obj || undefined, estado: newEstado }
    ]);
    setEstadoCloser(newEstado);
    setChatInput('');
  };

  const copy = async (txt: string) => {
    try{ await navigator.clipboard.writeText(txt); } catch{ /* fallback */ }
  };

  const filteredLeads = useMemo(()=>{
    return leads.filter(l=>{
      const mNicho = nicho ? l.nicho.toLowerCase().includes(nicho.toLowerCase()) || l.nombre.toLowerCase().includes(nicho.toLowerCase()) : true;
      const mCiudad = ciudad ? l.ciudad.toLowerCase().includes(ciudad.toLowerCase()) : true;
      const mKw = keyword ? (l.nombre+l.web+l.direccion).toLowerCase().includes(keyword.toLowerCase()) : true;
      return mNicho && mCiudad && mKw;
    });
  },[leads, nicho, ciudad, keyword]);

  const diasDesdeContacto = (l: Lead) => l.ultimoContacto ? Math.floor((Date.now() - new Date(l.ultimoContacto).getTime()) / 86400000) : null;
  // 1.er seguimiento a los 3 días del contacto; 2.º a los 4 días del primero (7 en total)
  const tocaSeguimiento = (l: Lead) => {
    if(l.estado !== 'CONTACTADO') return false;
    const d = diasDesdeContacto(l);
    if(d === null) return false;
    const n = l.seguimientos || 0;
    return n < 2 && d >= (n === 0 ? 3 : 4);
  };
  const categoria = (l: Lead): Exclude<Pestana,'todos'|'seguimiento'> => {
    if(!l.web || l.analisisEstado !== 'ok') return 'pendientes';
    if(puntosHuecos(l) > 0) return 'prioritarios';
    return (l.huecos || []).length > 0 ? 'web' : 'sinhuecos';
  };
  const conteos = useMemo(()=>{
    const c = { todos: filteredLeads.length, prioritarios: 0, web: 0, sinhuecos: 0, pendientes: 0, seguimiento: 0 };
    filteredLeads.forEach(l => { c[categoria(l)]++; if(tocaSeguimiento(l)) c.seguimiento++; });
    return c;
  },[filteredLeads]);

  const visibleLeads = useMemo(()=>{
    if(pestana === 'todos') return filteredLeads;
    if(pestana === 'seguimiento') return filteredLeads.filter(tocaSeguimiento);
    const lista = filteredLeads.filter(l => categoria(l) === pestana);
    if(pestana === 'prioritarios') {
      return lista.sort((a,b) => Number(!!b.telefono) - Number(!!a.telefono) || puntosHuecos(b) - puntosHuecos(a) || Number(b.reviews) - Number(a.reviews));
    }
    return lista;
  },[filteredLeads, pestana]);

  const isCloserActive = closerChecks.length >= 2;
  const puedePagar = ESTADOS_ORDEN[estadoCloser] !== undefined && ESTADOS_ORDEN[estadoCloser] >= 5;

  const [generando, setGenerando] = useState(false);
  const [errorPago, setErrorPago] = useState('');
  const [mensualidad, setMensualidad] = useState('0');
  // Plan + fase rellenan importe, cuota y concepto (IVA incluido en lo que paga la clínica)
  useEffect(()=>{
    setImporte(String(conIva(plan.alta/2)));
    setMensualidad(fasePago==='firma' ? '0' : String(conIva(plan.cuota)));
    setConcepto(`Agente IA plan ${plan.nombre} — ${fasePago==='firma' ? '50 % del alta (al firmar)' : '50 % del alta + cuota mensual (al activar)'}`);
  },[planId, fasePago]);
  const mensajePago = fasePago==='firma'
    ? `Perfecto${contacto ? ' ' + contacto : ''}. Os confirmo el plan ${plan.nombre} para ${selectedLead?.nombre || 'la clínica'}: ${euro(plan.cuota)} €/mes + IVA y ${euro(plan.alta)} € + IVA de alta, con permanencia mínima de 3 meses. El consumo de WhatsApp lo factura Meta directamente a la clínica.

Para empezar, este es el enlace del 50 % del alta (${euro(Number(importe))} € con IVA):
${linkGenerado || '[ENLACE DE PAGO]'}

En cuanto esté pagado, os mando el contrato y fijamos la reunión de 45 minutos para recoger tratamientos, precios y horarios. Lo tendréis funcionando en ${plan.plazo}.`
    : `${contacto ? contacto + ', el' : 'El'} agente ya está funcionando en ${selectedLead?.nombre || 'la clínica'}. Este es el enlace del 50 % restante del alta junto con la primera cuota del plan ${plan.nombre} (${euro(conIva(plan.cuota))} €/mes con IVA, que se renueva cada mes):
${linkGenerado || '[ENLACE DE PAGO]'}

Las dos próximas semanas reviso las conversaciones y ajusto lo que haga falta.`;

  const generarLink = async () => {
    setErrorPago('');
    if(stripeLink){
      let base = stripeLink.trim();
      if(!base.startsWith('http')) base = 'https://' + base;
      try{
        const url = new URL(base);
        if(emailCliente) url.searchParams.set('prefilled_email', emailCliente);
        url.searchParams.set('client_reference_id', concepto.slice(0,80));
        setLinkGenerado(url.toString());
      }catch{
        setLinkGenerado(base);
      }
      return;
    }
    setGenerando(true);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importe, concepto, email: emailCliente, mensualidad, leadId: selectedLead?.id }),
      });
      const data = await r.json();
      if(!r.ok) throw new Error(data?.error || 'Error creando el pago');
      setLinkGenerado(data.url);
      if(selectedLead) setLeads(prev=>prev.map(l=>l.id===selectedLead.id ? {...l, estado:'CALIENTE'}:l));
    } catch(e: any) {
      setErrorPago((e.message || 'Error de conexión') + ' — puedes pegar un payment link propio abajo o usar Bizum.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono selection:bg-[#c6ff00] selection:text-black">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Space+Grotesk:wght@500;700&display=swap'); .font-display{font-family:'Space Grotesk',sans-serif} .font-mono{font-family:'JetBrains Mono',monospace}`}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c6ff00] flex items-center justify-center text-black font-black shadow-[0_0_20px_rgba(198,255,0,0.35)]"><Flame size={22}/></div>
            <div>
              <div className="font-display font-black tracking-[0.14em] text-[28px] md:text-[34px] leading-none">CLOSER</div>
              <div className="text-[10px] tracking-[0.25em] text-white/50 -mt-1 font-bold">V4.1 • OPERATIVA REAL</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
              <div className="w-2 h-2 rounded-full bg-[#c6ff00] animate-pulse" />
              {leads.length} LEADS • {selectedLead?.nombre ? `SEL: ${selectedLead.nombre.slice(0,18)}` : 'SIN SELECCIÓN'} • {estadoCloser}
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16}/></div>
          </div>
        </div>
        {/* STEPS */}
        <div className="max-w-[1600px] mx-auto px-2 md:px-6 pb-3">
          <div className="grid grid-cols-5 gap-1 md:gap-2">
            {[
              {n:1, label:'BUSCADOR', sub:'Leads reales'},
              {n:2, label:'ANALIZADOR', sub:'Web + oportunidad'},
              {n:3, label:'PROSPECCIÓN', sub:'Email/WA/Voz'},
              {n:4, label:'CLOSER V4', sub:'Objeciones IA'},
              {n:5, label:'PAGO', sub:'Stripe real'},
            ].map(s=>(
              <button key={s.n} onClick={()=>setStep(s.n)} className={`group text-left px-3 py-2.5 rounded-xl border transition-all ${step===s.n ? 'bg-[#c6ff00] text-black border-[#c6ff00]' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step===s.n ? 'bg-black text-[#c6ff00]' : 'bg-white/10'}`}>{s.n}</span>
                  <span className="font-display font-bold text-[12px] md:text-[13px] tracking-wide hidden md:inline">{s.label}</span>
                  <span className="font-display font-bold text-[11px] md:hidden">{s.label.slice(0,4)}</span>
                </div>
                <div className={`text-[10px] mt-1 tracking-wide ${step===s.n ? 'text-black/60' : 'text-white/40'}`}>{s.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        {/* STEP 1 */}
        {step===1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={16} className="text-[#c6ff00]"/><span className="font-display font-bold text-sm">BUSCADOR OPERATIVO</span>
                    <span className="ml-auto text-[10px] px-2 py-1 rounded bg-[#c6ff00] text-black font-bold">REAL</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-white/50">NICHO *</label>
                      <input value={nicho} onChange={e=>setNicho(e.target.value)} placeholder="Clínica Dental" className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c6ff00]"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/50">CIUDAD *</label>
                        <input value={ciudad} onChange={e=>setCiudad(e.target.value)} placeholder="Sevilla" className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c6ff00]"/>
                      </div>
                      <div>
                        <label className="text-[11px] text-white/50">KEYWORD (opcional)</label>
                        <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="implantes" className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c6ff00]"/>
                      </div>
                    </div>
                    {errorBusqueda && <div className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={12}/> {errorBusqueda}</div>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleBuscarReal} disabled={buscando} className="flex-1 disabled:opacity-50 bg-white text-black font-bold text-[12px] py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-white/90">
                        <Search size={14}/> {buscando ? 'BUSCANDO...' : 'BUSCAR EN GOOGLE MAPS'}
                      </button>
                      <button onClick={()=>setShowAdd(!showAdd)} className="px-4 bg-[#c6ff00] text-black font-bold text-[12px] rounded-lg flex items-center gap-1">
                        <Plus size={14}/> MANUAL
                      </button>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">• Si tienes Google Places API, puedes pegar resultados abajo. Si no, usa manual. El sistema NO bloquea por falta de API.</p>
                  </div>
                </div>

                {showAdd && (
                  <div className="rounded-2xl bg-[#c6ff00]/10 border border-[#c6ff00]/30 p-4 space-y-3">
                    <div className="flex justify-between items-center"><span className="font-bold text-sm">Añadir Lead Manual</span><button onClick={()=>setShowAdd(false)} className="p-1"><X size={14}/></button></div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={newLead.nombre} onChange={e=>setNewLead({...newLead, nombre:e.target.value})} placeholder="Nombre *" className="col-span-2 bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                      <input value={newLead.web} onChange={e=>setNewLead({...newLead, web:e.target.value})} placeholder="Web https://" className="col-span-2 bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                      <input value={newLead.telefono} onChange={e=>setNewLead({...newLead, telefono:e.target.value})} placeholder="Teléfono" className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                      <input value={newLead.direccion} onChange={e=>setNewLead({...newLead, direccion:e.target.value})} placeholder="Dirección" className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                      <input value={newLead.rating} onChange={e=>setNewLead({...newLead, rating:e.target.value})} placeholder="Rating 4.5" className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                      <input value={newLead.reviews} onChange={e=>setNewLead({...newLead, reviews:e.target.value})} placeholder="Reviews 42" className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                    </div>
                    <button onClick={handleAddLead} className="w-full bg-[#c6ff00] text-black font-bold py-2.5 rounded-lg text-sm">AÑADIR A LISTA PRINCIPAL</button>
                  </div>
                )}

                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                  <div className="font-bold text-[11px] tracking-widest text-white/60 mb-2">PEGAR LISTA RÁPIDA (CSV)</div>
                  <textarea value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="Formato por línea: Nombre, Web, Tel, Dirección, Rating, Reviews&#10;Ej: Clínica Sonrisa, https://..., 954..., C/ Feria 12, 4.5, 38" className="w-full h-24 bg-black border border-white/10 rounded-lg p-2.5 text-[12px] outline-none focus:border-white/20"/>
                  <button onClick={handleBulkAdd} className="mt-2 w-full bg-white/10 hover:bg-white/15 border border-white/10 py-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2"><Plus size={12}/> AÑADIR {bulk.split('\n').filter(Boolean).length} LEADS</button>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-8">
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                  <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
                    <div className="flex items-center gap-2"><Building2 size={16} className="text-[#c6ff00]"/><span className="font-display font-bold text-sm">LEADS OPERATIVOS • {visibleLeads.length}</span></div>
                    <button onClick={handleAnalizarTodos} disabled={analizandoTodos} className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-[11px] disabled:opacity-50">{analizandoTodos ? `ANALIZANDO ${progreso.hecho}/${progreso.total}...` : 'ANALIZAR TODOS'}</button>
                  </div>
                  <div className="px-4 py-2 flex flex-wrap gap-1 border-b border-white/10">
                    {([
                      ['todos','TODOS'],
                      ['prioritarios','PRIORITARIOS'],
                      ['seguimiento','TOCA SEGUIMIENTO'],
                      ['web','SOLO WEB / SEO'],
                      ['sinhuecos','SIN HUECOS'],
                      ['pendientes','SIN ANALIZAR'],
                    ] as [Pestana,string][]).map(([id,label])=>(
                      <button key={id} onClick={()=>setPestana(id)} className={`px-3 py-1.5 rounded-lg font-bold text-[10px] border ${pestana===id ? 'bg-[#c6ff00] text-black border-[#c6ff00]' : 'bg-black text-white/70 border-white/15 hover:border-white/30'}`}>{label} · {conteos[id]}</button>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead className="text-[10px] text-white/40 border-b border-white/10">
                        <tr><th className="text-left p-3 font-normal">NOMBRE</th><th className="text-left p-3 font-normal">WEB</th><th className="text-left p-3 font-normal hidden md:table-cell">TEL</th><th className="text-left p-3 font-normal">ESTADO</th><th className="p-3"></th></tr>
                      </thead>
                      <tbody>
                        {visibleLeads.map(l=>(
                          <tr key={l.id} className={`border-b border-white/[0.05] hover:bg-white/[0.03] ${selectedId===l.id ? 'bg-[#c6ff00]/10' : ''}`}>
                            <td className="p-3">
                              <input value={l.nombre} onChange={e=>setLeads(prev=>prev.map(x=>x.id===l.id ? {...x, nombre:e.target.value}:x))} className="bg-transparent border border-transparent hover:border-white/20 rounded px-2 py-1 w-full outline-none"/>
                              <div className="text-[10px] text-white/30 px-2 flex items-center gap-1"><MapPin size={10}/>{l.direccion.slice(0,28)} • {l.rating}★ ({l.reviews})</div>
                              <div className="px-2 pt-1 flex flex-wrap gap-1">
                                {l.analisisEstado==='ok' && puntosHuecos(l)===0 && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/50">Sin huecos clave</span>}
                                {l.huecos?.includes('sin_whatsapp') && <span className="px-1.5 py-0.5 rounded bg-[#c6ff00]/20 text-[#c6ff00] text-[10px]">Sin WhatsApp</span>}
                                {l.huecos?.includes('sin_reservas') && <span className="px-1.5 py-0.5 rounded bg-[#c6ff00]/20 text-[#c6ff00] text-[10px]">Sin reservas</span>}
                                {l.analisisEstado==='error' && <span title={l.analisisError} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px]">No analizado</span>}
                                {!l.web && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/50">Sin web</span>}
                                {!l.telefono && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/50">Sin teléfono</span>}
                                {l.analisisEstado==='ok' && puntosHuecos(l)===0 && (l.huecos||[]).length>0 && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/50">Solo web / SEO</span>}
                                {l.estado==='CONTACTADO' && diasDesdeContacto(l)!==null && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/60">Contactado hace {diasDesdeContacto(l)} d</span>}
                                {tocaSeguimiento(l) && <button onClick={()=>setLeads(prev=>prev.map(x=>x.id===l.id ? {...x, ultimoContacto:new Date().toISOString(), seguimientos:(x.seguimientos||0)+1}:x))} className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[10px] font-bold">TOCA SEGUIMIENTO · HECHO</button>}
                                {l.estado==='CONTACTADO' && (l.seguimientos||0)>=2 && diasDesdeContacto(l)!==null && diasDesdeContacto(l)!>=4 && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px]">Sin respuesta: cerrar</span>}
                              </div>
                            </td>
                            <td className="p-3"><input value={l.web} onChange={e=>setLeads(prev=>prev.map(x=>x.id===l.id ? {...x, web:e.target.value}:x))} className="bg-transparent border border-transparent hover:border-white/20 rounded px-2 py-1 w-full outline-none text-[11px] text-[#c6ff00]"/></td>
                            <td className="p-3 hidden md:table-cell"><input value={l.telefono} onChange={e=>setLeads(prev=>prev.map(x=>x.id===l.id ? {...x, telefono:e.target.value}:x))} className="bg-transparent border border-transparent hover:border-white/20 rounded px-2 py-1 w-full outline-none"/></td>
                            <td className="p-3">
                              <select value={l.estado} onChange={e=>setLeads(prev=>prev.map(x=>x.id===l.id ? {...x, estado:e.target.value as EstadoLead, ...(e.target.value==='CONTACTADO' && !x.ultimoContacto ? {ultimoContacto:new Date().toISOString(), seguimientos:0} : {})}:x))} className="bg-black border border-white/15 rounded px-2 py-1 text-[11px]">
                                <option>NUEVO</option><option>CONTACTADO</option><option>CALIENTE</option><option>NO_INTERESADO</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <button onClick={()=>{setSelectedId(l.id); if(l.analisisEstado==='ok'){ setAnalisis(prev=>({...prev, checks: l.huecos || [], seoScore: l.seoScore ?? prev.seoScore, velocidad: l.velocidad ?? prev.velocidad})); } setStep(2);}} className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 ${selectedId===l.id ? 'bg-[#c6ff00] text-black' : 'bg-white text-black hover:bg-white/90'}`}><Eye size={12}/> SEL</button>
                                <button onClick={()=>setLeads(prev=>prev.filter(x=>x.id!==l.id))} className="p-1.5 rounded bg-white/10 hover:bg-red-500/20"><Trash2 size={12}/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleLeads.length===0 && <div className="p-12 text-center text-white/30 text-sm">{pestana==='todos' ? 'Sin leads. Busca en Google Maps o añade uno manualmente para empezar.' : pestana==='seguimiento' ? 'Nadie toca seguimiento ahora mismo.' : 'No hay leads en esta pestaña. Pulsa ANALIZAR TODOS para clasificarlos.'}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step===2 && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-4 space-y-4">
              {selectedLead ? (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-3"><Globe size={14} className="text-[#c6ff00]"/><span className="font-bold text-sm">LEAD SELECCIONADO</span><span className="ml-auto text-[10px] px-2 py-1 bg-[#c6ff00] text-black rounded font-bold">EN ANÁLISIS</span></div>
                  <div className="space-y-2 text-sm">
                    <div className="font-display font-bold text-lg">{selectedLead.nombre}</div>
                    <div className="text-[#c6ff00] text-xs break-all">{selectedLead.web}</div>
                    <div className="flex gap-2 text-[11px] text-white/50"><span className="flex items-center gap-1"><Phone size={10}/>{selectedLead.telefono}</span><span className="flex items-center gap-1"><MapPin size={10}/>{selectedLead.direccion}</span></div>
                    <div className="flex gap-2 pt-2">
                      <span className="px-2 py-1 bg-white/10 rounded text-[10px]">{selectedLead.nicho}</span>
                      <span className="px-2 py-1 bg-white/10 rounded text-[10px]">{selectedLead.ciudad}</span>
                      <span className="px-2 py-1 bg-[#c6ff00]/20 text-[#c6ff00] rounded text-[10px]">{selectedLead.rating}★ • {selectedLead.reviews} rev</span>
                    </div>
                  </div>
                </div>
              ) : <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm">Selecciona un lead en PASO 1</div>}

              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <div className="font-bold text-[12px] tracking-widest text-white/60 mb-3">OBSERVACIONES REALES (PEGA LO QUE VES)</div>
                <textarea value={analisis.observaciones} onChange={e=>setAnalisis({...analisis, observaciones:e.target.value})} placeholder="Ej: No tiene reservas online, formulario roto, no hay WhatsApp, imágenes pesan 3MB, no aparece en Maps..." className="w-full h-28 bg-black border border-white/10 rounded-xl p-3 text-[12px] outline-none focus:border-[#c6ff00]"/>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8 space-y-4">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
                <div className="flex items-center gap-2 mb-4"><Zap size={16} className="text-[#c6ff00]"/><span className="font-display font-bold">ANÁLISIS RÁPIDO • CHECKLIST OPERATIVO</span></div>
                <button onClick={handleAnalizarWeb} disabled={!selectedLead || analizando} className="mb-4 w-full disabled:opacity-40 bg-white text-black font-bold text-[12px] py-2.5 rounded-lg flex items-center justify-center gap-2"><Globe size={14}/> {analizando ? 'ANALIZANDO WEB...' : 'ANALIZAR WEB AUTOMÁTICAMENTE'}</button>
                {errorAnalisis && <div className="mb-3 text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={12}/> {errorAnalisis}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {CHECKLIST_ITEMS.map(item=>{
                    const active = analisis.checks.includes(item.id);
                    return (
                      <button key={item.id} onClick={()=>setAnalisis(prev=>({...prev, checks: active ? prev.checks.filter(c=>c!==item.id) : [...prev.checks, item.id]}))} className={`text-left p-3 rounded-xl border flex items-start gap-3 transition-all ${active ? 'bg-[#c6ff00]/15 border-[#c6ff00]/40' : 'bg-black border-white/10 hover:border-white/20'}`}>
                        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${active ? 'bg-[#c6ff00] border-[#c6ff00] text-black' : 'border-white/20'}`}>{active && <Check size={12}/>}</div>
                        <div><div className="text-[12px] font-bold">{item.label}</div><div className="text-[11px] text-white/50">{item.impact}</div></div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div><label className="text-[11px] text-white/50">SEO SCORE (1-10)</label><input type="range" min={1} max={10} value={analisis.seoScore} onChange={e=>setAnalisis({...analisis, seoScore: Number(e.target.value)})} className="w-full mt-1 accent-[#c6ff00]"/><div className="text-center font-bold text-[#c6ff00]">{analisis.seoScore}/10</div></div>
                  <div><label className="text-[11px] text-white/50">VELOCIDAD</label><input value={analisis.velocidad} onChange={e=>setAnalisis({...analisis, velocidad:e.target.value})} className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
                  <div><label className="text-[11px] text-white/50">TRÁFICO EST.</label><input value={analisis.trafico} onChange={e=>setAnalisis({...analisis, trafico:e.target.value})} className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
                </div>

                {selectedLead?.ficha && (
                  <div className="mt-5 rounded-xl bg-black border border-white/10 p-3 text-[11px] space-y-1.5">
                    <div className="font-bold text-white/60 tracking-widest mb-1">LO QUE HAY EN SU WEB (PARA PERSONALIZAR)</div>
                    {selectedLead.ficha.pocoTexto && <div className="text-amber-300 flex items-center gap-1"><AlertTriangle size={12}/> La web carga casi todo con JavaScript: ábrela y comprueba a mano antes de enviar.</div>}
                    <div><span className="text-white/40">Tratamientos:</span> {selectedLead.ficha.tratamientos.length ? selectedLead.ficha.tratamientos.join(', ') : <span className="text-amber-300">no detectados (escríbelo tú abajo)</span>}</div>
                    {selectedLead.ficha.precio && <div><span className="text-white/40">Precio visto:</span> {selectedLead.ficha.precio.tratamiento} · {selectedLead.ficha.precio.euros} €</div>}
                    <div><span className="text-white/40">Cita:</span> {selectedLead.ficha.reservaTipo==='plataforma' ? `reserva online (${selectedLead.ficha.plataforma})` : selectedLead.ficha.reservaTipo==='formulario' ? 'formulario sin elegir día ni hora' : selectedLead.ficha.reservaTipo==='telefono' ? 'hay que llamar' : 'no se ve forma de pedir cita'}</div>
                    <div><span className="text-white/40">WhatsApp:</span> {selectedLead.ficha.whatsappTipo ? 'botón que abre su chat (sin agente detectado)' : 'no aparece'}{selectedLead.ficha.chat ? ` · chat: ${selectedLead.ficha.chat}` : ''}</div>
                    <div><span className="text-white/40">Horario:</span> {selectedLead.ficha.horario || 'no aparece en la web'}{selectedLead.ficha.horario ? ` · sábado ${selectedLead.ficha.abreSabado ? 'sí' : 'no'} · domingo ${selectedLead.ficha.abreDomingo ? 'sí' : 'no'}` : ''}</div>
                    {selectedLead.ficha.instagram && <div><span className="text-white/40">Instagram:</span> @{selectedLead.ficha.instagram}</div>}
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-[11px] text-white/50">TRATAMIENTO QUE SALE EN EL MENSAJE (uno que ofrezcan de verdad)</label>
                  <input value={tratamiento} onChange={e=>setTratamiento(e.target.value)} placeholder="Ej: depilación láser, limpieza facial, ortodoncia invisible..." className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/>
                  {!!selectedLead?.ficha?.tratamientos?.length && (
                    <div className="flex flex-wrap gap-1 mt-2">{selectedLead.ficha.tratamientos.map(t=>(
                      <button key={t} onClick={()=>setTratamiento(t)} className={`px-2 py-1 rounded text-[10px] ${tratamiento===t ? 'bg-[#c6ff00] text-black font-bold' : 'bg-white/10 text-white/70'}`}>{t}</button>
                    ))}</div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="text-[11px] text-white/50">GANCHO: DATO DE SU WEB + QUÉ LE PASA A SU CLIENTE (auto + editable; entra en el mensaje)</label>
                  <textarea value={analisis.oportunidad} onChange={e=>setAnalisis({...analisis, oportunidad:e.target.value})} className="mt-1 w-full h-24 bg-black border border-white/15 rounded-xl p-3 text-[12px] outline-none focus:border-[#c6ff00]"/>
                </div>

                <div className="mt-3">
                  <label className="text-[11px] text-white/50">SEGUNDO FALLO DE SU WEB (auto + editable; ej.: un enlace que lleva a otra página)</label>
                  <textarea value={frase2} onChange={e=>setFrase2(e.target.value)} placeholder="Escribe aquí otro fallo concreto que hayas visto en su web" className="mt-1 w-full h-20 bg-black border border-white/15 rounded-xl p-3 text-[12px] outline-none focus:border-[#c6ff00]"/>
                </div>

                <button onClick={()=>{ if(selectedLead && analisis.oportunidad){ setStep(3);} }} disabled={!analisis.oportunidad} className="mt-5 w-full bg-[#c6ff00] disabled:opacity-30 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm tracking-wide">
                  GUARDAR ANÁLISIS Y PASAR A PROSPECCIÓN <ChevronRight size={16}/>
                </button>
                {!analisis.oportunidad && <div className="text-[11px] text-amber-300/70 mt-2 flex items-center gap-1"><AlertTriangle size={12}/> Marca al menos 1 check para generar oportunidad automáticamente</div>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step===3 && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7 space-y-4">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-white/50">TU NOMBRE (firma)</label><input value={miNombre} onChange={e=>setMiNombre(e.target.value)} className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
                <div><label className="text-[11px] text-white/50">TU AGENCIA</label><input value={miAgencia} onChange={e=>setMiAgencia(e.target.value)} className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
                <div><label className="text-[11px] text-white/50">TU TELÉFONO (firma del email)</label><input value={miTelefono} onChange={e=>setMiTelefono(e.target.value)} placeholder="Opcional" className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
                <div><label className="text-[11px] text-white/50">TU EMAIL (firma del email)</label><input value={miEmail} onChange={e=>setMiEmail(e.target.value)} placeholder="Opcional" className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
                <div className="col-span-2"><label className="text-[11px] text-white/50">NOMBRE DE LA PERSONA A LA QUE ESCRIBES (dueña, gerente...)</label><input value={contacto} onChange={e=>setContacto(e.target.value)} placeholder="Opcional, pero sube mucho la respuesta: búscalo en su web, Instagram o Google" className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"/></div>
              </div>

              {calidad.length > 0 && (
                <div className={`rounded-2xl border p-4 ${calidad.every(c=>c.ok) ? 'bg-[#c6ff00]/10 border-[#c6ff00]/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <div className="font-bold text-[11px] tracking-widest mb-2">{calidad.every(c=>c.ok) ? 'MENSAJE PERSONALIZADO ✓' : 'MENSAJE POCO PERSONALIZADO: CORRÍGELO ANTES DE ENVIAR'}</div>
                  <div className="space-y-1">{calidad.map(c=>(
                    <div key={c.texto} className="text-[11px] flex items-center gap-2">{c.ok ? <Check size={12} className="text-[#c6ff00]"/> : <AlertTriangle size={12} className="text-amber-300"/>}{c.texto}</div>
                  ))}</div>
                  <div className="text-[10px] text-white/40 mt-2">Prueba final: si cambiando solo el nombre sirviera para otra clínica, reescribe el gancho en el paso 2.</div>
                </div>
              )}
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                <div className="flex border-b border-white/10">
                  {[
                    {id:'email', label:'EMAIL', icon: Mail},
                    {id:'whatsapp', label:'DM / WHATSAPP', icon: MessageSquare},
                    {id:'llamada', label:'LLAMADA', icon: Phone},
                  ].map(t=>{
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={()=>setProspectTab(t.id as any)} className={`flex-1 py-3 flex items-center justify-center gap-2 text-[12px] font-bold tracking-wide ${prospectTab===t.id ? 'bg-[#c6ff00] text-black' : 'bg-transparent text-white/50 hover:text-white'}`}>
                        <Icon size={14}/> {t.label}
                      </button>
                    );
                  })}
                </div>
                <div className="p-4">
                  {prospectTab==='email' && (
                    <div className="space-y-3">
                      <textarea value={emailTpl} onChange={e=>setEmailTpl(e.target.value)} className="w-full h-[320px] bg-black border border-white/10 rounded-xl p-4 text-[12px] leading-relaxed outline-none focus:border-white/20"/>
                      <button onClick={()=>copy(emailTpl)} className="w-full bg-white text-black font-black py-3 rounded-xl flex items-center justify-center gap-2"><Copy size={14}/> COPIAR EMAIL</button>
                    </div>
                  )}
                  {prospectTab==='whatsapp' && (
                    <div className="space-y-3">
                      <textarea value={waTpl} onChange={e=>setWaTpl(e.target.value)} className="w-full h-[200px] bg-black border border-white/10 rounded-xl p-4 text-[13px] leading-relaxed outline-none focus:border-white/20"/>
                      <button onClick={()=>copy(waTpl)} className="w-full bg-[#25D366] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2"><Copy size={14}/> COPIAR DM ({waTpl.length} caracteres)</button>
                    </div>
                  )}
                  {prospectTab==='llamada' && (
                    <div className="space-y-3">
                      <textarea value={callTpl} onChange={e=>setCallTpl(e.target.value)} className="w-full h-[260px] bg-black border border-white/10 rounded-xl p-4 text-[12px] leading-relaxed outline-none focus:border-white/20"/>
                      <button onClick={()=>copy(callTpl)} className="w-full bg-[#c6ff00] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2"><Copy size={14}/> COPIAR GUION LLAMADA</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
                <div className="font-bold text-[11px] tracking-widest text-white/60">SEGUIMIENTOS (aportan algo nuevo, no "¿viste mi mensaje?")</div>
                <div>
                  <div className="text-[10px] text-white/40 mb-1">A LOS 3 DÍAS · otro dato de su web</div>
                  <textarea value={seg1Tpl} onChange={e=>setSeg1Tpl(e.target.value)} className="w-full h-32 bg-black border border-white/10 rounded-xl p-3 text-[12px] outline-none"/>
                  <button onClick={()=>copy(seg1Tpl)} className="mt-1 w-full bg-white/10 font-bold py-2 rounded-lg text-[11px] flex items-center justify-center gap-2"><Copy size={12}/> COPIAR SEGUIMIENTO 1</button>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 mb-1">A LOS 7 DÍAS · el último: cierra sin insistir</div>
                  <textarea value={seg2Tpl} onChange={e=>setSeg2Tpl(e.target.value)} className="w-full h-32 bg-black border border-white/10 rounded-xl p-3 text-[12px] outline-none"/>
                  <button onClick={()=>copy(seg2Tpl)} className="mt-1 w-full bg-white/10 font-bold py-2 rounded-lg text-[11px] flex items-center justify-center gap-2"><Copy size={12}/> COPIAR SEGUIMIENTO 2</button>
                </div>
              </div>

              <div className="rounded-2xl bg-[#c6ff00]/10 border border-[#c6ff00]/30 p-4">
                <div className="flex items-center gap-2 mb-3"><Mic size={16} className="text-black bg-[#c6ff00] rounded-full p-0.5"/><span className="font-display font-bold text-sm text-[#c6ff00]">MÓDULO VOZ CLONADA CORTASIA</span><span className="ml-auto text-[10px] px-2 py-1 bg-black text-[#c6ff00] rounded font-bold">OPERATIVO</span></div>
                <input value={contacto} onChange={e=>setContacto(e.target.value)} placeholder="Nombre de la persona (opcional)" className="mb-3 w-full bg-black border border-white/15 rounded-lg px-2 py-2 text-[11px]"/>
                <div className="flex gap-1 mb-3">
                  {[
                    {id:'inicial', label:'INICIAL 27s'},
                    {id:'seguimiento', label:'SEGUIMIENTO'},
                    {id:'cierre', label:'CIERRE'},
                  ].map(t=>(
                    <button key={t.id} onClick={()=>setVozTab(t.id as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold ${vozTab===t.id ? 'bg-[#c6ff00] text-black' : 'bg-black border border-white/10 text-white/60'}`}>{t.label}</button>
                  ))}
                </div>
                <div className="bg-black rounded-xl p-3 border border-white/10">
                  <div className="text-[11px] leading-relaxed whitespace-pre-wrap">{currentScript}</div>
                  <div className="mt-3 flex items-center gap-3 text-[10px]">
                    <span className={`px-2 py-1 rounded font-bold ${wordCount>=75 && wordCount<=90 ? 'bg-[#c6ff00] text-black' : 'bg-amber-500/20 text-amber-300'}`}>{wordCount} palabras {wordCount>=75 && wordCount<=90 ? '✓ ÓPTIMO' : '• objetivo 75-90'}</span>
                    <span className="flex items-center gap-1 text-white/50"><Clock size={10}/>~{timeEst}s estimado</span>
                    <span className="text-white/30">[pausa] [respiración] incluidos</span>
                  </div>
                </div>
                <button onClick={()=>copy(currentScript)} className="mt-3 w-full bg-[#c6ff00] text-black font-black py-2.5 rounded-xl text-[12px] flex items-center justify-center gap-2"><Copy size={14}/> COPIAR PARA CORTASIA</button>
              </div>

              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <button onClick={()=>{
                  if(selectedLead) setLeads(prev=>prev.map(l=>l.id===selectedLead.id ? {...l, estado:'CONTACTADO', ultimoContacto:new Date().toISOString(), seguimientos:0}:l));
                }} className="w-full bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                  <CheckCircle2 size={16}/> MARCAR COMO CONTACTADO
                </button>
                <div className="mt-3 text-[11px] text-white/40">Al copiar, pégalo directo en Cortasia / ElevenLabs con voz clonada. Los marcadores [pausa] mejoran entonación.</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step===4 && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <div className="font-bold text-[11px] tracking-widest text-white/60 mb-2">PLAN QUE VAS A PROPONER (sale en «¿cuánto cuesta?»)</div>
                <div className="grid grid-cols-3 gap-2">
                  {PLANES.map(p=>(
                    <button key={p.id} onClick={()=>setPlanId(p.id)} className={`p-2 rounded-lg border text-left ${planId===p.id ? 'bg-[#c6ff00]/15 border-[#c6ff00]/50' : 'bg-black border-white/10'}`}>
                      <div className="font-bold text-[11px]">{p.nombre}</div>
                      <div className="text-[10px] text-white/60">{p.cuota} €/mes</div>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-white/40 mt-2">{plan.para}. Por defecto, Pro.</div>
              </div>
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-3"><Brain size={16} className="text-[#c6ff00]"/><span className="font-display font-bold text-sm">CLOSER IA V4 • ACTIVACIÓN</span></div>
                <div className="text-[11px] text-white/40 mb-3">Marca ≥2 para activar lógica consultiva. Actual: {closerChecks.length}/6</div>
                <div className="space-y-2">
                  {ACTIVACION_CHECKS.map(c=>{
                    const active = closerChecks.includes(c);
                    return (
                      <button key={c} onClick={()=>setCloserChecks(prev=> active ? prev.filter(x=>x!==c) : [...prev, c])} className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2 text-[11px] ${active ? 'bg-[#c6ff00]/15 border-[#c6ff00]/30' : 'bg-black border-white/10'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${active ? 'bg-[#c6ff00] border-[#c6ff00] text-black' : 'border-white/20'}`}>{active && <Check size={10}/>}</div>{c}
                      </button>
                    );
                  })}
                </div>
                <div className={`mt-4 p-3 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${isCloserActive ? 'bg-[#c6ff00] text-black border-[#c6ff00]' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
                  <Zap size={12}/>{isCloserActive ? 'CLOSER ACTIVO • IA CONSULTIVA LISTA' : 'NECESITAS ≥2 CHECKS PARA ACTIVAR'}
                </div>
                <div className="mt-4">
                  <label className="text-[11px] text-white/50">PROBLEMA CONCRETO (para personalizar ejemplos)</label>
                  <input value={problemaConcreto} onChange={e=>setProblemaConcreto(e.target.value)} className="mt-1 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-[12px]"/>
                </div>
                <div className="mt-4">
                  <div className="text-[11px] text-white/50 mb-2">ESTADO ACTUAL</div>
                  <div className="flex flex-wrap gap-1">
                    {(["FRIO","INTERACCION","PROBLEMA_DETECTADO","INTERES","CUALIFICADO","INTENCION_COMPRA","OFERTA_PRESENTADA","PAGO","NO_INTERESADO","SEGUIMIENTO","NO_CONTACTAR"] as EstadoCloser[]).map(e=>(
                      <button key={e} onClick={()=>setEstadoCloser(e)} className={`px-2 py-1 rounded text-[10px] font-bold border ${estadoCloser===e ? 'bg-[#c6ff00] text-black border-[#c6ff00]' : 'bg-black border-white/10 text-white/40'}`}>{e}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8 space-y-4">
              <div className={`rounded-2xl border p-4 ${isCloserActive ? 'bg-white/[0.04] border-white/10' : 'bg-black border-white/5 opacity-60 pointer-events-none'}`}>
                <div className="flex items-center gap-2 mb-3"><MessageSquare size={16} className="text-[#c6ff00]"/><span className="font-display font-bold text-sm">CHAT PROSPECTO → DETECCIÓN AUTOMÁTICA</span></div>
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleProspectChat()} placeholder="Pega mensaje del prospecto: 'me lo pienso', 'cuánto cuesta', 'prefiero humanos'..." className="flex-1 bg-black border border-white/15 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#c6ff00]"/>
                  <button onClick={handleProspectChat} className="px-5 bg-[#c6ff00] text-black font-bold rounded-xl flex items-center gap-2"><Send size={14}/> ANALIZAR</button>
                </div>

                <div className="mt-4 space-y-3 max-h-[420px] overflow-auto pr-1">
                  {chatHist.length===0 && <div className="p-8 text-center text-white/30 text-[12px]">Pega un mensaje real del prospecto y la IA detectará estado + objeción + respuesta consultiva exacta V4.</div>}
                  {chatHist.map((m,i)=>(
                    <div key={i} className={`p-3 rounded-xl border ${m.role==='prospecto' ? 'bg-white/5 border-white/10' : 'bg-[#c6ff00]/10 border-[#c6ff00]/20'}`}>
                      <div className="flex items-center gap-2 mb-1"><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${m.role==='prospecto' ? 'bg-white/10' : 'bg-[#c6ff00] text-black'}`}>{m.role==='prospecto' ? 'PROSPECTO' : 'RESPUESTA IA V4'}</span>{m.estado && <span className="text-[10px] px-2 py-0.5 bg-black rounded border border-white/10">{m.estado}</span>}{m.objecion && <span className="text-[10px] px-2 py-0.5 bg-[#c6ff00]/20 text-[#c6ff00] rounded">{m.objecion.key}</span>}</div>
                      <div className="text-[12px] leading-relaxed">{m.text}</div>
                      {m.objecion && m.role==='ia' && (
                        <div className="mt-2 grid md:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 bg-black rounded border border-white/10"><div className="text-white/40 text-[10px]">ESTRATEGIA</div>{m.objecion.estrategia}</div>
                          <div className="p-2 bg-red-500/10 rounded border border-red-500/20"><div className="text-red-300 text-[10px]">QUE EVITAR</div>{m.objecion.queEvitar}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={()=>{setChatInput('Me lo pienso');}} className="py-2 bg-white/10 border border-white/10 rounded-lg text-[11px]">Me lo pienso → SEGUIMIENTO</button>
                  <button onClick={()=>{setChatInput('No me interesa');}} className="py-2 bg-white/10 border border-white/10 rounded-lg text-[11px]">No me interesa → NO_INT</button>
                  <button onClick={()=>{setChatInput('No me contactes más');}} className="py-2 bg-red-500/20 border border-red-500/20 text-red-300 rounded-lg text-[11px]">No contactes → NO_CONTACTAR</button>
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                <div className="font-bold text-[11px] tracking-widest text-white/50 mb-3">OBJECIONES V4 • REFERENCIA RÁPIDA</div>
                <div className="grid md:grid-cols-2 gap-2 max-h-[260px] overflow-auto">
                  {OBJECIONES_V4.map(o=>(
                    <div key={o.key} className="p-2.5 bg-black rounded-xl border border-white/10">
                      <div className="font-bold text-[11px] text-[#c6ff00]">{o.key}</div>
                      <div className="text-[10px] text-white/60 mt-1">{o.estrategia.slice(0,90)}...</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step===5 && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <div className={`rounded-2xl border p-5 relative overflow-hidden ${puedePagar ? 'bg-white/[0.04] border-white/10' : 'bg-black border-white/10'}`}>
                {!puedePagar && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] z-10 flex items-center justify-center p-6">
                    <div className="bg-[#0a0a0a] border border-amber-500/30 rounded-2xl p-5 max-w-md text-center">
                      <Ban size={24} className="mx-auto text-amber-400 mb-2"/>
                      <div className="font-display font-bold">BLOQUEADO • ESTADO {estadoCloser}</div>
                      <div className="text-[12px] text-white/60 mt-2">Necesitas llegar a INTENCION_COMPRA en el Closer V4 para generar link de pago. Ve al paso 4 y trabaja objeciones hasta que pregunte precio.</div>
                      <button onClick={()=>setStep(4)} className="mt-4 px-4 py-2 bg-[#c6ff00] text-black font-bold rounded-lg text-[12px]">IR A CLOSER V4</button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-5"><DollarSign size={18} className="text-[#c6ff00]"/><span className="font-display font-bold">PAGO OPERATIVO REAL</span><span className="ml-auto text-[10px] px-2 py-1 bg-[#c6ff00] text-black rounded font-bold">STRIPE / BIZUM</span></div>

                <div className="mb-4">
                  <div className="text-[11px] text-white/50 mb-2">PLAN QUE CONTRATA</div>
                  <div className="grid grid-cols-3 gap-2">
                  {PLANES.map(p=>(
                    <button key={p.id} onClick={()=>setPlanId(p.id)} className={`text-left p-3 rounded-xl border ${planId===p.id ? 'bg-[#c6ff00]/15 border-[#c6ff00]/50' : 'bg-black border-white/10'}`}>
                      <div className="font-bold text-[12px]">{p.nombre}{p.id==='pro' ? ' ★' : ''}</div>
                      <div className="text-[11px] text-white/70">{p.cuota} €/mes · alta {euro(p.alta)} €</div>
                      <div className="text-[10px] text-white/40">+ IVA · {p.para}</div>
                    </button>
                  ))}
                </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={()=>setFasePago('firma')} className={`py-2 rounded-lg text-[11px] font-bold ${fasePago==='firma' ? 'bg-white text-black' : 'bg-black border border-white/10 text-white/60'}`}>1.º PAGO · AL FIRMAR (50 % alta)</button>
                    <button onClick={()=>setFasePago('activacion')} className={`py-2 rounded-lg text-[11px] font-bold ${fasePago==='activacion' ? 'bg-white text-black' : 'bg-black border border-white/10 text-white/60'}`}>2.º PAGO · AL ACTIVAR (50 % + cuota)</button>
                  </div>
                  <div className="text-[10px] text-white/40 mt-2">Importes con IVA incluido (21 %). {fasePago==='firma' ? 'La cuota mensual empieza en el 2.º pago, cuando el agente ya funciona.' : 'Desde este pago, Stripe cobra la cuota cada mes.'} El consumo de WhatsApp lo paga la clínica a Meta.</div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="text-[11px] text-white/50">IMPORTE (€) * editable</label><input value={importe} onChange={e=>setImporte(e.target.value)} className="mt-1 w-full bg-black border border-white/15 rounded-xl px-3 py-3 text-sm font-bold"/></div>
                  <div><label className="text-[11px] text-white/50">EMAIL CLIENTE</label><input value={emailCliente} onChange={e=>setEmailCliente(e.target.value)} placeholder="cliente@empresa.com" className="mt-1 w-full bg-black border border-white/15 rounded-xl px-3 py-3 text-sm"/></div>
                  <div className="md:col-span-2"><label className="text-[11px] text-white/50">CONCEPTO * editable</label><input value={concepto} onChange={e=>setConcepto(e.target.value)} className="mt-1 w-full bg-black border border-[#c6ff00]/30 rounded-xl px-3 py-3 text-sm"/></div>
                  <div className="md:col-span-2"><label className="text-[11px] text-white/50">LINK STRIPE PROPIO (opcional — si lo dejas vacío se crea un pago automático)</label><div className="mt-1 flex gap-2"><div className="flex items-center px-3 bg-white/10 rounded-xl border border-white/10"><Link2 size={14}/></div><input value={stripeLink} onChange={e=>setStripeLink(e.target.value)} placeholder="https://buy.stripe.com/..." className="flex-1 bg-black border border-white/15 rounded-xl px-3 py-3 text-sm"/></div><div className="text-[10px] text-white/40 mt-1">Vacío = checkout automático con STRIPE_SECRET_KEY</div></div>
                </div>

                <div className="mt-3"><label className="text-[11px] text-white/50">MENSUALIDAD € (0 = solo pago único)</label><input value={mensualidad} onChange={e=>setMensualidad(e.target.value)} className="mt-1 w-full bg-black border border-white/15 rounded-xl px-3 py-3 text-sm"/></div>
                <button onClick={generarLink} disabled={generando} className="mt-5 w-full disabled:opacity-50 bg-[#c6ff00] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2"><Zap size={16}/> {generando ? 'CREANDO PAGO...' : 'GENERAR LINK DE PAGO STRIPE'}</button>
                {errorPago && <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={12}/> {errorPago}</div>}

                {linkGenerado && (
                  <div className="mt-4 p-4 rounded-xl bg-black border border-[#c6ff00]/30">
                    <div className="text-[11px] text-white/50 mb-2 flex items-center gap-2"><CheckCircle2 size={12} className="text-[#c6ff00]"/>LINK GENERADO • COPIAR Y ENVIAR</div>
                    <div className="p-3 bg-white/[0.04] rounded-lg text-[12px] break-all font-mono">{linkGenerado}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={()=>copy(linkGenerado)} className="flex-1 bg-white text-black font-bold py-2.5 rounded-lg text-[12px] flex items-center justify-center gap-2"><Copy size={12}/> COPIAR LINK</button>
                      {linkGenerado.startsWith('http') && <a href={linkGenerado} target="_blank" rel="noopener" className="flex-1 bg-[#c6ff00] text-black font-bold py-2.5 rounded-lg text-[12px] flex items-center justify-center gap-2"><Eye size={12}/> ABRIR LINK</a>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <div className="font-bold text-sm mb-3">QUÉ INCLUYE EL PLAN {plan.nombre.toUpperCase()} ({plan.plazo})</div>
                <div className="space-y-2 text-[12px]">
                  {[...plan.incluye, 'Permanencia mínima 3 meses'].map(i=>(
                    <div key={i} className="flex gap-2"><CheckCircle2 size={14} className="text-[#c6ff00] mt-0.5"/><span>{i}</span></div>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-xl bg-[#c6ff00]/10 border border-[#c6ff00]/20 text-[11px]">
                  <div className="font-bold text-[#c6ff00]">QUÉ PASA DESPUÉS DEL PAGO</div>
                  <div className="mt-1 text-white/70 leading-relaxed">1. Paga el 50 % del alta → contrato + encargo de tratamiento de datos (RGPD)<br/>2. Reunión de información (45 min) y alta en Meta de su WhatsApp<br/>3. Montaje y pruebas: {plan.plazo}<br/>4. Al activar: 50 % restante + cuota de {plan.cuota} €/mes + IVA ({euro(conIva(plan.cuota))} €), cada mes<br/>5. Dos semanas de ajuste fino</div>
                </div>
              </div>

              <div className="rounded-2xl bg-black border border-white/10 p-4">
                <div className="font-bold text-[11px] tracking-widest text-white/40 mb-2">MENSAJE PAGO PARA ENVIAR</div>
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap bg-white/[0.03] p-3 rounded-xl border border-white/10">
{mensajePago}
                </div>
                <button onClick={()=>copy(mensajePago)} className="mt-3 w-full bg-white text-black font-bold py-2.5 rounded-xl text-[12px] flex items-center justify-center gap-2"><Copy size={12}/> COPIAR MENSAJE PAGO</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between text-[10px] text-white/20 border-t border-white/5 pt-4">
          <span className="flex items-center gap-2"><Flame size={12} className="text-[#c6ff00]"/>CLOSER V4.1 • OPERATIVA REAL • SIN MOCKS BLOQUEANTES • 100% EDITABLE</span>
          <span className="hidden md:flex items-center gap-2"><Settings size={10}/> Dark #0a0a0a + Lima #c6ff00 • Glass • Mono</span>
        </div>
      </main>
    </div>
  );
}
