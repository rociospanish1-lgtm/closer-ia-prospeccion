import React, { useEffect, useState } from 'react';
import App from './App.tsx';

export default function Gate() {
  const [estado, setEstado] = useState<'cargando'|'login'|'ok'>('cargando');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch('/api/login').then(r => setEstado(r.ok ? 'ok' : 'login')).catch(() => setEstado('login'));
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) { setEstado('ok'); return; }
      const d = await r.json().catch(() => ({}));
      setError(d?.error || 'Error al entrar');
    } catch {
      setError('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  if (estado === 'ok') return <App />;
  if (estado === 'cargando') return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white/[0.04] border border-white/10 p-6 space-y-4">
        <div className="text-lg font-bold">CLOSER</div>
        <input type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full bg-black border border-white/15 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#c6ff00]" />
        {error && <div className="text-[12px] text-red-400">{error}</div>}
        <button disabled={enviando || !password} className="w-full disabled:opacity-40 bg-[#c6ff00] text-black font-black py-3 rounded-xl text-sm">{enviando ? 'ENTRANDO...' : 'ENTRAR'}</button>
      </form>
    </div>
  );
}
