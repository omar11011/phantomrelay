'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send, Mail, Eye, EyeOff, Shield, CheckCircle2, AlertCircle,
  RefreshCw, Lock, Timer, Trash2, ExternalLink, Server, Info,
  User, Settings, Plus, X,
  Save, Star, Globe, Key, ChevronDown, Check, Shuffle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SentEmail {
  id: string; to: string; subject: string; sentAtDate: string;
  previewUrl: string | null; autoDeleteAt: string; messageAvailable: boolean;
}

interface ResendConfig {
  id: string; name: string; apiKey: string; senderEmail: string;
  senderName: string; isDefault: boolean; createdAt: string; updatedAt: string;
}

export default function Home() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean; message: string; previewUrl?: string | null;
    mode?: 'smtp' | 'api' | 'simulated'; usedSender?: string;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [resendConfigs, setResendConfigs] = useState<ResendConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [useRandomSender, setUseRandomSender] = useState(true);
  const [editingConfig, setEditingConfig] = useState<ResendConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    name: '', apiKey: '', senderEmail: '', senderName: 'PhantomRelay', isDefault: false,
  });
  const [configError, setConfigError] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const loadConfigs = useCallback(async () => {
    setIsLoadingConfigs(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setResendConfigs(data.configs || []);
        const def = (data.configs || []).find((c: ResendConfig) => c.isDefault);
        if (def) setSelectedConfigId(def.id);
      }
    } catch { /* */ } finally { setIsLoadingConfigs(false); }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const resetConfigForm = () => {
    setConfigForm({ name: '', apiKey: '', senderEmail: '', senderName: 'PhantomRelay', isDefault: false });
    setEditingConfig(null); setConfigError('');
  };

  const saveConfig = async () => {
    setConfigError('');
    if (!configForm.name || !configForm.apiKey || !configForm.senderEmail) {
      setConfigError('Nombre, API key y correo son obligatorios'); return;
    }
    if (!configForm.apiKey.startsWith('re_')) { setConfigError('API key debe empezar con re_'); return; }
    setIsSavingConfig(true);
    try {
      const body: Record<string, unknown> = {
        action: editingConfig ? 'update' : 'create', name: configForm.name,
        senderEmail: configForm.senderEmail, senderName: configForm.senderName, isDefault: configForm.isDefault,
      };
      if (editingConfig) { body.id = editingConfig.id; if (configForm.apiKey) body.apiKey = configForm.apiKey; }
      else { body.apiKey = configForm.apiKey; }
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { resetConfigForm(); loadConfigs(); }
      else { const data = await res.json(); setConfigError(data.error || 'Error'); }
    } catch { setConfigError('Error de conexion'); } finally { setIsSavingConfig(false); }
  };

  const deleteConfig = async (id: string) => {
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
      if (selectedConfigId === id) setSelectedConfigId(null);
      loadConfigs();
    } catch { /* */ }
  };

  const setDefaultConfig = async (id: string) => {
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_default', id }) });
      loadConfigs(); setSelectedConfigId(id);
    } catch { /* */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSending(true); setSendResult(null);
    try {
      const body: Record<string, unknown> = { to, subject, message };
      if (selectedConfigId) body.configId = selectedConfigId;
      body.useRandomSender = useRandomSender;
      const res = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        const ml = data.mode === 'api' ? '(Entregado)' : data.mode === 'smtp' ? '(SMTP)' : '(Simulado)';
        setSendResult({ success: true, message: `Email procesado! ${ml}`, previewUrl: data.previewUrl, mode: data.mode, usedSender: data.usedSender });
        setTo(''); setSubject(''); setMessage('');
      } else { setSendResult({ success: false, message: data.error || 'Error' }); }
    } catch { setSendResult({ success: false, message: 'Error de conexion' }); } finally { setIsSending(false); }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try { const res = await fetch('/api'); const data = await res.json(); setSentEmails(data.emails || []); }
    catch { /* */ } finally { setIsLoadingHistory(false); }
  };

  const getSelectedConfigName = () => {
    if (!selectedConfigId) return 'Env vars (.env)';
    return resendConfigs.find(c => c.id === selectedConfigId)?.name || 'Desconocido';
  };


  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <header className="py-4 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-mono">PhantomRelay</h1>
              <p className="text-xs text-slate-400">Secure routing node</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { setShowSettings(!showSettings); setShowPrivacyInfo(false); }}
              className={`gap-1 ${showSettings ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white'}`}>
              <Settings className="w-4 h-4" /><span className="hidden sm:inline">Config</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowPrivacyInfo(!showPrivacyInfo); setShowSettings(false); }}
              className={`gap-1 ${showPrivacyInfo ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white'}`}>
              <Lock className="w-4 h-4" /><span className="hidden sm:inline">Privacidad</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { if (!showHistory) loadHistory(); setShowHistory(!showHistory); }}
              className={`gap-1 ${showHistory ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white'}`}>
              {showHistory ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{showHistory ? 'Ocultar' : 'Historial'}</span>
            </Button>
            {/* No logout button — local mode */}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-8">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3 font-mono">
              <Shield className="w-3 h-3" />E2E · AES-256 · TTL-24h
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent font-mono">
              Secure Message Relay
            </h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Escribe tu mensaje, elige el destinatario y envialo sin dejar rastro.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {[
              { icon: Shield, title: 'No-IP', desc: 'Zero IP logging' },
              { icon: Lock, title: 'AES-256', desc: 'E2E encrypted' },
              { icon: Timer, title: 'TTL-24h', desc: 'Auto-purge' },
              { icon: Trash2, title: 'Zero-log', desc: 'No traces' },
            ].map((f, i) => (
              <div key={i} className="text-center p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 font-mono">
                <f.icon className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-white">{f.title}</p>
                <p className="text-[10px] text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <Card className="bg-slate-800/80 border-violet-500/30 mb-5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-violet-300 font-mono">
                    <Settings className="w-4 h-4" />Configuracion de Resend
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadConfigs} disabled={isLoadingConfigs} className="text-slate-400 hover:text-white">
                    <RefreshCw className={`w-4 h-4 ${isLoadingConfigs ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <CardDescription className="text-slate-400 text-xs">Gestiona tus API keys y dominios de Resend.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {resendConfigs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Configuraciones guardadas</p>
                    {resendConfigs.map((config) => (
                      <div key={config.id}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedConfigId === config.id ? 'bg-violet-500/10 border-violet-500/30' : 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600/50'}`}
                        onClick={() => setSelectedConfigId(config.id)}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {selectedConfigId === config.id ? <Check className="w-3.5 h-3.5 text-violet-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />}
                            <span className="text-sm font-medium text-white">{config.name}</span>
                            {config.isDefault && <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20"><Star className="w-2.5 h-2.5 mr-0.5" />Default</Badge>}
                          </div>
                          <div className="flex items-center gap-0.5">
                            {!config.isDefault && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDefaultConfig(config.id); }} className="h-6 w-6 p-0 text-slate-500 hover:text-amber-400"><Star className="w-3 h-3" /></Button>}
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingConfig(config); setConfigForm({ name: config.name, apiKey: '', senderEmail: config.senderEmail, senderName: config.senderName, isDefault: config.isDefault }); setConfigError(''); }} className="h-6 w-6 p-0 text-slate-500 hover:text-blue-400"><Settings className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteConfig(config.id); }} className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1"><Key className="w-2.5 h-2.5" />{config.apiKey}</span>
                          <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{config.senderEmail}</span>
                        </div>
                      </div>
                    ))}
                    <div className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedConfigId === null ? 'bg-violet-500/10 border-violet-500/30' : 'bg-slate-900/50 border-slate-700/30'}`}
                      onClick={() => setSelectedConfigId(null)}>
                      <div className="flex items-center gap-2">
                        {selectedConfigId === null ? <Check className="w-3.5 h-3.5 text-violet-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />}
                        <span className="text-sm text-slate-400">Usar variables de entorno (.env)</span>
                        <Badge variant="secondary" className="text-[9px] bg-slate-500/10 text-slate-400 border-slate-500/20 ml-auto">Fallback</Badge>
                      </div>
                    </div>
                  </div>
                )}
                <Separator className="bg-slate-700/50" />
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      {editingConfig ? <><Settings className="w-3.5 h-3.5" />Editando: {editingConfig.name}</> : <><Plus className="w-3.5 h-3.5" />Nueva configuracion</>}
                    </p>
                    {editingConfig && <Button variant="ghost" size="sm" onClick={resetConfigForm} className="h-6 text-[11px] text-slate-500 hover:text-white"><X className="w-3 h-3 mr-1" />Cancelar</Button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 flex items-center gap-1"><Globe className="w-3 h-3" />Nombre</label>
                      <Input placeholder="Mi cuenta Resend" value={configForm.name} onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                        className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 text-sm h-9 focus:border-violet-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 flex items-center gap-1"><Key className="w-3 h-3" />API Key</label>
                      <Input type="password" placeholder="re_xxxxxxxxxxxx" value={configForm.apiKey} onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                        className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 text-sm h-9 focus:border-violet-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />Correo remitente</label>
                      <Input placeholder="noreply@siuny.xyz" value={configForm.senderEmail} onChange={(e) => setConfigForm({ ...configForm, senderEmail: e.target.value })}
                        className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 text-sm h-9 focus:border-violet-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />Nombre remitente</label>
                      <Input placeholder="PhantomRelay" value={configForm.senderName} onChange={(e) => setConfigForm({ ...configForm, senderName: e.target.value })}
                        className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 text-sm h-9 focus:border-violet-500/50" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setConfigForm({ ...configForm, isDefault: !configForm.isDefault })}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${configForm.isDefault ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>
                      {configForm.isDefault && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                    <span className="text-[11px] text-slate-400">Establecer como predeterminada</span>
                  </div>
                  {configError && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{configError}</div>}
                  <Button onClick={saveConfig} disabled={isSavingConfig || !configForm.name || (!editingConfig && !configForm.apiKey) || !configForm.senderEmail}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 text-sm">
                    {isSavingConfig ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {isSavingConfig ? 'Guardando...' : editingConfig ? 'Actualizar' : 'Guardar Config'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Privacy Info */}
          {showPrivacyInfo && (
            <Card className="bg-emerald-950/30 border-emerald-800/30 mb-5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-emerald-300 font-mono"><Info className="w-4 h-4" />Privacy & Anonymity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 space-y-1.5">
                {[
                  { icon: Shield, text: 'Zero IP logging: No IPs stored or logged at any point.' },
                  { icon: Lock, text: 'AES-256 encryption: Messages encrypted before database storage.' },
                  { icon: Timer, text: 'Approximate timestamps: Only date stored, no exact time.' },
                  { icon: Trash2, text: 'Auto-purge: All records destroyed after 24h TTL.' },
                  { icon: Server, text: 'Anti-tracking headers: Emails include headers that disable tracking.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <item.icon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p><strong>{item.text.split(':')[0]}:</strong>{item.text.split(':').slice(1).join(':')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Email Form */}
          <Card className="bg-slate-800/80 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-mono"><Mail className="w-5 h-5 text-emerald-400" />New Relay Message</CardTitle>
              <CardDescription className="text-slate-400">Completa los campos y envia tu mensaje</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {resendConfigs.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-violet-400" />Enviar via</label>
                    <div className="relative">
                      <select value={selectedConfigId || ''} onChange={(e) => setSelectedConfigId(e.target.value || null)}
                        className="w-full h-9 px-3 rounded-lg bg-slate-900/50 border border-slate-600/50 text-white text-sm appearance-none cursor-pointer focus:border-violet-500/50 focus:outline-none">
                        <option value="">Variables de entorno (.env)</option>
                        {resendConfigs.map((c) => <option key={c.id} value={c.id}>{c.name} {c.isDefault ? '(Default)' : ''} — {c.senderEmail}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Random Sender Toggle */}
                <div className={`p-3 rounded-lg border ${useRandomSender ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-900/30 border-slate-700/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shuffle className={`w-4 h-4 ${useRandomSender ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <div>
                        <p className={`text-xs font-medium ${useRandomSender ? 'text-cyan-300' : 'text-slate-400'}`}>Remitente aleatorio</p>
                        <p className="text-[10px] text-slate-500">{useRandomSender ? 'Cada email desde una direccion unica' : 'Usa correo fijo configurado'}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setUseRandomSender(!useRandomSender)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${useRandomSender ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useRandomSender ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  {useRandomSender && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-cyan-500" />
                      <p className="text-[10px] text-cyan-400/70 font-mono">Ej: {Date.now().toString(36)}-a7f3@siuny.xyz</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Destinatario</label>
                  <Input type="email" placeholder="correo@ejemplo.com" value={to} onChange={(e) => setTo(e.target.value)} required
                    className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-emerald-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Asunto</label>
                  <Input type="text" placeholder="Escribe el asunto..." value={subject} onChange={(e) => setSubject(e.target.value)} required
                    className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-emerald-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    Mensaje
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ml-auto"><Lock className="w-2.5 h-2.5 mr-1" />Cifrado</Badge>
                  </label>
                  <Textarea placeholder="Escribe tu mensaje anonimo..." value={message} onChange={(e) => setMessage(e.target.value)} required rows={5}
                    className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-600 focus:border-emerald-500/50 resize-none" />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3" />AES-256</p>
                    <p className="text-[11px] text-slate-500">{message.length}/5000</p>
                  </div>
                </div>
                <Button type="submit" disabled={isSending || !to || !subject || !message}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-5 rounded-xl disabled:opacity-50">
                  {isSending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {isSending ? 'Transmitting...' : 'Relay Message'}
                </Button>
              </form>

              {sendResult && (
                <div className="mt-3 space-y-2">
                  <div className={`p-2.5 rounded-lg flex items-center gap-2 text-sm ${sendResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {sendResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {sendResult.message}
                  </div>
                  {sendResult.success && sendResult.mode === 'api' && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <div className="flex items-center gap-2 mb-0.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium font-mono">Message relayed successfully</span>
                      </div>
                      <p className="text-xs text-emerald-400/70">Sender appears as generic relay.</p>
                      {sendResult.usedSender && <p className="text-[11px] text-cyan-400/80 font-mono mt-0.5">Desde: {sendResult.usedSender}</p>}
                    </div>
                  )}
                  {sendResult.success && sendResult.mode === 'simulated' && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Server className="w-4 h-4 shrink-0" /><span className="text-sm font-medium">Modo simulado</span>
                      </div>
                      <p className="text-xs text-amber-400/70">Email cifrado y almacenado, pero no entregado al buzon real.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relay Info */}
          <div className="mt-3">
            <Card className="bg-emerald-900/20 border-emerald-800/30">
              <CardContent className="p-3.5">
                <div className="flex items-start gap-3">
                  <Server className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-emerald-300 mb-0.5 font-mono">Relay node active</p>
                    <p className="text-[11px] text-slate-400">Messages routed through encrypted relay. Sender identity is fully masked.</p>
                    {selectedConfigId && <p className="text-[11px] text-violet-400 mt-0.5 font-mono">Via: {getSelectedConfigName()}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* History */}
          {showHistory && (
            <Card className="bg-slate-800/80 border-slate-700/50 mt-5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg"><Eye className="w-5 h-5 text-emerald-400" />Emails Enviados</CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadHistory} disabled={isLoadingHistory} className="text-slate-400 hover:text-white">
                    <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sentEmails.length === 0 ? (
                  <div className="text-center py-6">
                    <Mail className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Aun no has enviado ningun email</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {sentEmails.map((email) => (
                      <div key={email.id} className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-emerald-400 font-medium">Para: {email.to}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Enviado</Badge>
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20"><Lock className="w-2.5 h-2.5 mr-0.5" />Cifrado</Badge>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-white mb-0.5">{email.subject}</p>
                        <Separator className="my-1.5 bg-slate-700/50" />
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-slate-600 flex items-center gap-1"><Timer className="w-2.5 h-2.5" />Auto-delete: {new Date(email.autoDeleteAt).toLocaleDateString('es-PE')}</p>
                          {email.previewUrl && <a href={email.previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><ExternalLink className="w-2.5 h-2.5" />Ver</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="mt-6 text-center"><p className="text-[11px] text-slate-600">Solo con fines educativos. Usalo responsablemente.</p></div>
        </div>
      </main>

      <footer className="py-3 px-4 border-t border-slate-800/50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-[11px] text-slate-600 font-mono">PR-Node v3.2 &copy; {new Date().getFullYear()}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-slate-600">Local mode</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
