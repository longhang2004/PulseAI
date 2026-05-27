'use client';

import React, { useState, useEffect } from 'react';
import { 
  getSocket, 
  disconnectSocket 
} from '../lib/socket';
import { 
  LatencyChart, 
  ErrorRateChart 
} from './svg-charts';
import { 
  Layers, 
  Key, 
  Activity, 
  AlertTriangle, 
  Settings, 
  LogOut, 
  Plus, 
  Copy, 
  Check, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown, 
  User, 
  Bell,
  Clock,
  Terminal,
  Cpu,
  Trash2
} from 'lucide-react';

interface DashboardViewProps {
  token: string;
  user: { email: string };
  onLogout: () => void;
}

export default function DashboardView({ token, user, onLogout }: DashboardViewProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'metrics' | 'incidents' | 'rules'>('metrics');

  // Master Data State
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [alertRules, setAlertRules] = useState<any[]>([]);

  // Chart Analytics Data
  const [latencyData, setLatencyData] = useState<any[]>([]);
  const [errorData, setErrorData] = useState<any[]>([]);

  // UI Modals / Intermediaries
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    incidentType: '',
    minSeverity: 'HIGH',
    streamId: '',
    slackWebhook: '',
    emailTo: '',
    webhookUrl: ''
  });

  // Toasts
  const [toasts, setToasts] = useState<any[]>([]);

  // Clipboard copies
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

  // Helper fetcher wrapper
  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    return fetch(API_URL + endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
  };

  // Add a real-time toast notification
  const addToast = (title: string, message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // 1. Initial Load: Fetch Projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetchWithAuth('/projects');
        const json = await res.json();
        if (json.success && json.data) {
          setProjects(json.data);
          if (json.data.length > 0) {
            setActiveProject(json.data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load projects', err);
      }
    };
    loadProjects();
  }, []);

  // 2. Load Project-specific Data
  useEffect(() => {
    if (!activeProject) return;

    const loadProjectData = async () => {
      try {
        // Fetch API Keys
        const keysRes = await fetchWithAuth(`/projects/${activeProject.id}/keys`);
        const keysJson = await keysRes.json();
        if (keysJson.success) setApiKeys(keysJson.data || []);

        // Fetch Streams
        const streamsRes = await fetchWithAuth(`/streams/project/${activeProject.id}`);
        const streamsJson = await streamsRes.json();
        if (streamsJson.success) setStreams(streamsJson.data || []);

        // Fetch Incidents
        const incidentsRes = await fetchWithAuth(`/incidents/project/${activeProject.id}`);
        const incidentsJson = await incidentsRes.json();
        if (incidentsJson.success) setIncidents(incidentsJson.data || []);

        // Fetch Alert Rules
        const rulesRes = await fetchWithAuth(`/alerts/rules/project/${activeProject.id}`);
        const rulesJson = await rulesRes.json();
        if (rulesJson.success) setAlertRules(rulesJson.data || []);

        // Fetch Analytics
        const end = new Date();
        const start = new Date(end.getTime() - 4 * 60 * 60 * 1000); // last 4 hours
        
        const latRes = await fetchWithAuth(`/analytics/project/${activeProject.id}/latency?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
        const latJson = await latRes.json();
        if (latJson.success) setLatencyData(latJson.data || []);

        const errRes = await fetchWithAuth(`/analytics/project/${activeProject.id}/errors?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
        const errJson = await errRes.json();
        if (errJson.success) setErrorData(errJson.data || []);

      } catch (err) {
        console.error('Failed to fetch project data', err);
      }
    };

    loadProjectData();

    // Set up Socket.io connection for real-time incidents
    const socket = getSocket(token);
    socket.connect();

    socket.emit('join_project', { projectId: activeProject.id });

    socket.on('incident_created', (data: any) => {
      if (data.projectId === activeProject.id) {
        addToast('🚨 New Incident Detected', `${data.data.title || 'Anomaly'} on stream ${data.data.streamId}`, 'error');
        setIncidents((prev) => [data.data, ...prev]);
        // Refresh streams
        fetchWithAuth(`/streams/project/${activeProject.id}`)
          .then(res => res.json())
          .then(json => { if (json.success) setStreams(json.data); });
      }
    });

    socket.on('incident_updated', (data: any) => {
      if (data.projectId === activeProject.id) {
        setIncidents((prev) => prev.map((inc) => inc.id === data.incidentId ? { ...inc, ...data.data } : inc));
        // If current selected incident is updated, reload diagnosis or info
        if (selectedIncident && selectedIncident.id === data.incidentId) {
          setSelectedIncident((prev: any) => ({ ...prev, ...data.data }));
          loadDiagnosis(data.incidentId);
        }
      }
    });

    socket.on('incident_resolved', (data: any) => {
      if (data.projectId === activeProject.id) {
        addToast('✅ Incident Resolved', `Incident ${data.incidentId.slice(0, 8)} marked resolved`, 'info');
        setIncidents((prev) => prev.map((inc) => inc.id === data.incidentId ? { ...inc, status: 'RESOLVED', resolvedAt: data.resolvedAt } : inc));
        if (selectedIncident && selectedIncident.id === data.incidentId) {
          setSelectedIncident((prev: any) => ({ ...prev, status: 'RESOLVED', resolvedAt: data.resolvedAt }));
        }
      }
    });

    return () => {
      socket.off('incident_created');
      socket.off('incident_updated');
      socket.off('incident_resolved');
    };
  }, [activeProject]);

  // Load Diagnosis details
  const loadDiagnosis = async (incidentId: string) => {
    setDiagnosisLoading(true);
    setDiagnosis(null);
    setDiagnosisFeedback(null);
    setFeedbackSubmitted(false);
    setFeedbackNote('');
    try {
      const res = await fetchWithAuth(`/incidents/${incidentId}/diagnosis`);
      const json = await res.json();
      if (json.success && json.data) {
        setDiagnosis(json.data);
      }
    } catch (err) {
      console.warn('Diagnosis not ready yet');
    } finally {
      setDiagnosisLoading(false);
    }
  };

  // Regenerate Diagnosis
  const handleRegenerateDiagnosis = async () => {
    if (!selectedIncident) return;
    setDiagnosisLoading(true);
    try {
      const res = await fetch(API_URL + `/diagnosis/${selectedIncident.id}/regenerate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setDiagnosis(json.data);
        addToast('🤖 Diagnosis Regenerated', 'AI playbook analysis has refreshed.', 'info');
      } else {
        addToast('⚠️ Rate Limit Alert', json.error || 'Failed to regenerate.', 'warn');
      }
    } catch (err) {
      addToast('❌ Action Failed', 'Backend LLM model unreachable.', 'error');
    } finally {
      setDiagnosisLoading(false);
    }
  };

  // Submit Feedback
  const handleSubmitFeedback = async (helpful: boolean) => {
    if (!diagnosis) return;
    try {
      const res = await fetch(API_URL + `/diagnosis/${diagnosis.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful, notes: feedbackNote }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackSubmitted(true);
        addToast('👍 Thank You', 'Your SRE feedback has been recorded.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve Incident
  const handleResolveIncident = async (incidentId: string) => {
    try {
      const res = await fetchWithAuth(`/incidents/${incidentId}/resolve`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        addToast('✅ Resolved', 'Incident status set to RESOLVED.', 'info');
        setIncidents((prev) => prev.map((inc) => inc.id === incidentId ? { ...inc, status: 'RESOLVED', resolvedAt: new Date() } : inc));
        if (selectedIncident && selectedIncident.id === incidentId) {
          setSelectedIncident((prev: any) => ({ ...prev, status: 'RESOLVED', resolvedAt: new Date() }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetchWithAuth('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProjectName }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setProjects((prev) => [json.data, ...prev]);
        setActiveProject(json.data);
        setShowNewProjectModal(false);
        setNewProjectName('');
        addToast('📁 Project Created', `Project "${json.data.name}" is ready.`, 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Generate API Key
  const handleGenerateKey = async () => {
    if (!activeProject) return;
    try {
      const res = await fetchWithAuth(`/projects/${activeProject.id}/keys`, { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data) {
        setApiKeys((prev) => [json.data, ...prev]);
        addToast('🔑 Key Generated', 'A new API credentials key was created.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Alert Rule
  const handleCreateRule = async () => {
    if (!newRule.name.trim() || !activeProject) return;
    
    const rulePayload = {
      projectId: activeProject.id,
      name: newRule.name,
      enabled: true,
      condition: {
        ...(newRule.incidentType ? { incidentType: newRule.incidentType } : {}),
        minSeverity: newRule.minSeverity,
        ...(newRule.streamId ? { streamId: newRule.streamId } : {}),
      },
      channels: {
        ...(newRule.slackWebhook ? { slack: { webhookUrl: newRule.slackWebhook } } : {}),
        ...(newRule.emailTo ? { email: { to: newRule.emailTo.split(',').map(s => s.trim()) } } : {}),
        ...(newRule.webhookUrl ? { webhook: { url: newRule.webhookUrl } } : {}),
      }
    };

    try {
      const res = await fetchWithAuth('/alerts/rules', {
        method: 'POST',
        body: JSON.stringify(rulePayload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAlertRules((prev) => [json.data, ...prev]);
        setShowNewRuleModal(false);
        setNewRule({
          name: '',
          incidentType: '',
          minSeverity: 'HIGH',
          streamId: '',
          slackWebhook: '',
          emailTo: '',
          webhookUrl: ''
        });
        addToast('📢 Rule Added', 'Alert rule created successfully.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Alert Rule Enable/Disable
  const handleToggleRule = async (rule: any) => {
    try {
      const res = await fetchWithAuth(`/alerts/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAlertRules((prev) => prev.map((r) => r.id === rule.id ? json.data : r));
        addToast('🔔 Rule Updated', `Rule is now ${json.data.enabled ? 'enabled' : 'disabled'}.`, 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Alert Rule
  const handleDeleteRule = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/alerts/rules/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setAlertRules((prev) => prev.filter((r) => r.id !== id));
        addToast('🗑️ Rule Removed', 'Alert rule has been deleted.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex flex-1 bg-[#0b0c0f] text-zinc-200 font-sans overflow-hidden">
      
      {/* 1. SIDEBAR */}
      <aside className="w-80 border-r border-zinc-900 bg-zinc-950/80 p-5 flex flex-col justify-between">
        <div className="space-y-6 flex-1 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-zinc-100">PulseAI</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Observability</p>
            </div>
          </div>

          {/* Project Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Active Project</span>
              <button 
                onClick={() => setShowNewProjectModal(true)}
                className="p-1 hover:bg-zinc-900 rounded text-cyan-400 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            
            {projects.length === 0 ? (
              <div className="text-xs text-zinc-600 italic">No projects created yet</div>
            ) : (
              <div className="relative">
                <select 
                  value={activeProject?.id || ''}
                  onChange={(e) => {
                    const proj = projects.find(p => p.id === e.target.value);
                    if (proj) setActiveProject(proj);
                  }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500 text-xs">▼</div>
              </div>
            )}
          </div>

          {/* API Keys Manager */}
          <div>
            <div className="flex items-center justify-between mb-2 border-t border-zinc-900 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">API Access Keys</span>
              <button 
                onClick={handleGenerateKey}
                className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                <Key className="h-3 w-3" /> Generate
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-[11px] text-zinc-600 italic">No access keys configured. Generate one to ingest telemetry.</div>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-lg border border-zinc-900/60 bg-zinc-900/20 px-2.5 py-1.5 text-xs">
                    <span className="font-mono text-zinc-500 text-[10px]">{key.key.slice(0, 5)}•••••{key.key.slice(-4)}</span>
                    <button 
                      onClick={() => copyToClipboard(key.key, key.id)}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 cursor-pointer"
                    >
                      {copiedKey === key.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Telemetry Streams */}
          <div>
            <div className="flex items-center justify-between mb-2 border-t border-zinc-900 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Connected Streams</span>
            </div>

            {streams.length === 0 ? (
              <div className="text-[11px] text-zinc-600 italic">No streams active. Send signals via SDK.</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {streams.map((stream) => {
                  const silent = new Date().getTime() - new Date(stream.lastSignalAt).getTime() > 5 * 60 * 1000;
                  return (
                    <div key={stream.id} className="flex items-center justify-between rounded-lg bg-zinc-900/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${silent ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <span className="font-mono text-zinc-300 text-[11px]">{stream.name}</span>
                      </div>
                      <span className="text-[10px] text-[#52525b] font-medium">{stream.signalCount} signals</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User profile footer */}
        <div className="border-t border-zinc-900 pt-4 mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
              <User className="h-4 w-4" />
            </div>
            <div className="w-36 overflow-hidden">
              <p className="text-xs font-medium text-zinc-300 truncate">{user.email}</p>
              <p className="text-[9px] text-zinc-500 uppercase">Administrator</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0d12] overflow-hidden">
        {/* Navigation Tabs Header */}
        <header className="h-14 border-b border-zinc-900 px-8 flex items-center justify-between">
          <div className="flex gap-6">
            {(['metrics', 'incidents', 'rules'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-semibold uppercase tracking-wider h-14 border-b-2 px-1 cursor-pointer transition-all ${
                  activeTab === tab
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab === 'metrics' ? 'Live Metrics' : tab === 'incidents' ? 'Incidents Feed' : 'Alert Rules'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] text-zinc-600 bg-zinc-950 px-2.5 py-1 rounded font-mono border border-zinc-900">
              API GATEWAY STATUS: ONLINE
            </span>
          </div>
        </header>

        {/* Tab Viewport */}
        <div className="flex-1 p-8 overflow-y-auto min-w-0">
          
          {/* TAB 1: METRICS */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LatencyChart data={latencyData} />
                <ErrorRateChart data={errorData} />
              </div>
              
              {/* Aggregated Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-4">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Incidents</p>
                  <p className="text-xl font-bold text-red-500 mt-1">{incidents.filter(i => i.status !== 'RESOLVED').length}</p>
                </div>
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-4">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Resolved Today</p>
                  <p className="text-xl font-bold text-green-500 mt-1">{incidents.filter(i => i.status === 'RESOLVED').length}</p>
                </div>
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-4">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Telemetry Streams</p>
                  <p className="text-xl font-bold text-zinc-200 mt-1">{streams.length}</p>
                </div>
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-4">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Alert Rules</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">{alertRules.filter(r => r.enabled).length}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INCIDENTS FEED */}
          {activeTab === 'incidents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Anomalies Log</h3>
                <span className="text-[10px] text-zinc-500">{incidents.length} events logged</span>
              </div>

              {incidents.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-900/60 bg-zinc-950/10 text-zinc-500">
                  <Activity className="h-8 w-8 mb-2 opacity-30 text-cyan-400" />
                  <span>No incidents reported yet for this project</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {incidents.map((incident) => (
                    <div 
                      key={incident.id} 
                      onClick={() => {
                        setSelectedIncident(incident);
                        loadDiagnosis(incident.id);
                      }}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedIncident?.id === incident.id
                          ? 'border-cyan-500 bg-cyan-950/10'
                          : 'border-zinc-900/80 bg-zinc-950/30 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${
                          incident.severity === 'CRITICAL' ? 'text-red-500' :
                          incident.severity === 'HIGH' ? 'text-amber-500' : 'text-yellow-400'
                        }`} />
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-200">{incident.title}</h4>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500 mt-1 font-mono">
                            <span>ID: {incident.id.slice(0, 8)}</span>
                            <span>Stream: {incident.streamId}</span>
                            <span>Type: {incident.type}</span>
                            <span>Val: {incident.triggerValue} (Thresh: {incident.triggerThreshold})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3 md:mt-0 justify-end">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-mono font-bold ${
                            incident.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            incident.severity === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {incident.severity}
                          </span>

                          <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-mono font-bold ${
                            incident.status === 'RESOLVED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            incident.status === 'OPEN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}>
                            {incident.status}
                          </span>
                        </div>

                        {incident.status !== 'RESOLVED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveIncident(incident.id);
                            }}
                            className="text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold px-2.5 py-1 rounded border border-zinc-800 cursor-pointer"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ALERT RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Alert Configurations</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Route notifications to Slack, Email, and custom Webhooks on incident triggers.</p>
                </div>
                <button
                  onClick={() => setShowNewRuleModal(true)}
                  className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow shadow-cyan-500/10"
                >
                  <Plus className="h-3.5 w-3.5" /> New Rule
                </button>
              </div>

              {alertRules.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-900/60 bg-zinc-950/10 text-zinc-500">
                  <Bell className="h-8 w-8 mb-2 opacity-30 text-cyan-400" />
                  <span>No alert notification channels set up</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alertRules.map((rule) => (
                    <div key={rule.id} className="p-4 rounded-xl border border-zinc-900/80 bg-zinc-950/40 space-y-3.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-200">{rule.name}</h4>
                          <span className="text-[9px] font-mono text-zinc-500">UUID: {rule.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={rule.enabled} 
                              onChange={() => handleToggleRule(rule)}
                              className="sr-only peer" 
                            />
                            <div className="w-7 h-4 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-zinc-950 peer-checked:after:border-cyan-500" />
                          </label>

                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 hover:bg-zinc-900 rounded text-zinc-600 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Rule criteria */}
                      <div className="p-2.5 rounded-lg bg-zinc-900/40 text-[10px] space-y-1 border border-zinc-900">
                        <p className="font-bold text-zinc-500 uppercase tracking-wider text-[9px] mb-1">Trigger Criteria</p>
                        {rule.condition.incidentType && <p><span className="text-zinc-400">Type:</span> <span className="font-mono text-cyan-400">{rule.condition.incidentType}</span></p>}
                        {rule.condition.streamId && <p><span className="text-zinc-400">Stream:</span> <span className="font-mono text-cyan-400">{rule.condition.streamId}</span></p>}
                        <p><span className="text-zinc-400">Min Severity:</span> <span className="font-mono text-amber-500">{rule.condition.minSeverity || 'LOW'}</span></p>
                      </div>

                      {/* Dispatch channels */}
                      <div className="space-y-1">
                        <p className="font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Notification Channels</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {rule.channels.slack && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400" title={rule.channels.slack.webhookUrl}>
                              Slack Webhook
                            </span>
                          )}
                          {rule.channels.email && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400" title={rule.channels.email.to.join(', ')}>
                              Email Notification
                            </span>
                          )}
                          {rule.channels.webhook && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400" title={rule.channels.webhook.url}>
                              JSON Webhook
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 3. AI DIAGNOSIS DRAWER (collapsible right side panel) */}
      {selectedIncident && (
        <aside className="w-96 border-l border-zinc-900 bg-zinc-950/60 flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/80">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">Incident Analysis</h3>
              <p className="text-[10px] text-zinc-500">ID: {selectedIncident.id.slice(0, 8)}</p>
            </div>
            <button 
              onClick={() => setSelectedIncident(null)}
              className="text-xs hover:text-white px-2 py-1 rounded bg-zinc-900 text-zinc-400 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Meta status panel */}
            <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-zinc-900 space-y-2">
              <h4 className="text-xs font-bold text-zinc-300">{selectedIncident.title}</h4>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Clock className="h-3 w-3" />
                <span>Detected: {new Date(selectedIncident.detectedAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Diagnosis Core Body */}
            {diagnosisLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-xs gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
                <span>Interrogating LLM & SRE Playbooks...</span>
              </div>
            ) : diagnosis ? (
              <div className="space-y-5">
                {/* Confidence Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">AI Confidence</span>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                    diagnosis.confidence === 'HIGH' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                    diagnosis.confidence === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {diagnosis.confidence} (via {diagnosis.modelUsed})
                  </span>
                </div>

                {/* Root Cause Summary */}
                <div className="space-y-1.5">
                  <h5 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Root Cause Summary</h5>
                  <p className="text-xs text-zinc-300 leading-relaxed border-l-2 border-cyan-500 pl-3">
                    {diagnosis.llmResponse?.rootCauseSummary || 'N/A'}
                  </p>
                </div>

                {/* Technical Detail */}
                <div className="space-y-1.5">
                  <h5 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Root Cause Details</h5>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {diagnosis.llmResponse?.rootCauseDetail || 'N/A'}
                  </p>
                </div>

                {/* Immediate Remediation Actions */}
                <div className="space-y-1.5">
                  <h5 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Immediate Actions</h5>
                  <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                    {(diagnosis.llmResponse?.immediateActions || []).map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

                {/* Contributing Factors */}
                {diagnosis.llmResponse?.contributingFactors && diagnosis.llmResponse.contributingFactors.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Contributing Factors</h5>
                    <ul className="space-y-1 text-xs text-zinc-400 list-disc list-inside">
                      {diagnosis.llmResponse.contributingFactors.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prevention Recommendations */}
                {diagnosis.llmResponse?.preventionRecommendations && diagnosis.llmResponse.preventionRecommendations.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Prevention Recommendations</h5>
                    <ul className="space-y-1 text-xs text-zinc-400 list-disc list-inside">
                      {diagnosis.llmResponse.preventionRecommendations.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnostics actions footer */}
                <div className="border-t border-zinc-900 pt-4 flex gap-2">
                  <button
                    onClick={handleRegenerateDiagnosis}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" /> Regenerate Analysis
                  </button>
                </div>

                {/* Feedback Section */}
                <div className="border-t border-zinc-900 pt-4 space-y-3">
                  <h5 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Was this AI diagnosis helpful?</h5>
                  
                  {feedbackSubmitted ? (
                    <p className="text-xs text-green-400 italic">Thank you! Your feedback has been recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDiagnosisFeedback('yes')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs border cursor-pointer ${
                            diagnosisFeedback === 'yes'
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 font-semibold'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-300'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> Helpful
                        </button>
                        <button
                          onClick={() => setDiagnosisFeedback('no')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs border cursor-pointer ${
                            diagnosisFeedback === 'no'
                              ? 'bg-red-500/10 border-red-500/40 text-red-400 font-semibold'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-300'
                          }`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" /> Unhelpful
                        </button>
                      </div>

                      {diagnosisFeedback && (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Optional notes for LLM refinement..."
                            value={feedbackNote}
                            onChange={(e) => setFeedbackNote(e.target.value)}
                            className="w-full text-xs bg-zinc-950/60 border border-zinc-900 rounded p-2 focus:outline-none focus:border-cyan-500 placeholder-zinc-700 min-h-[50px]"
                          />
                          <button
                            onClick={() => handleSubmitFeedback(diagnosisFeedback === 'yes')}
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold py-1.5 rounded text-[11px] cursor-pointer"
                          >
                            Submit Feedback
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600 text-xs">
                <Cpu className="h-7 w-7 mb-2 opacity-25 text-cyan-400" />
                <span>AI diagnosis is not yet ready for this incident. Waiting for pipeline execution.</span>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 4. MODALS & TOASTS */}

      {/* Create Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Register New Project</h3>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Project Name</label>
              <input 
                type="text" 
                placeholder="e.g. backend-api-gateway"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2.5 justify-end">
              <button 
                onClick={() => setShowNewProjectModal(false)}
                className="text-xs px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateProject}
                className="text-xs px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Alert Rule Modal */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-zinc-200">Configure Alert Channel</h3>
            <p className="text-[11px] text-zinc-500">Specify incident filter criteria and target communication channels.</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Rule Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Slack Critical Alerts"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Incident Type Filter (Opt)</label>
                  <select 
                    value={newRule.incidentType}
                    onChange={(e) => setNewRule({ ...newRule, incidentType: e.target.value })}
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                  >
                    <option value="">ALL TYPES</option>
                    <option value="ERROR_BURST">ERROR_BURST</option>
                    <option value="LATENCY_DEGRADATION">LATENCY_DEGRADATION</option>
                    <option value="SILENCE">SILENCE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Min Severity Level</label>
                  <select 
                    value={newRule.minSeverity}
                    onChange={(e) => setNewRule({ ...newRule, minSeverity: e.target.value })}
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Stream ID Constraint (Opt)</label>
                <input 
                  type="text" 
                  placeholder="e.g. auth-service-prod (empty for all)"
                  value={newRule.streamId}
                  onChange={(e) => setNewRule({ ...newRule, streamId: e.target.value })}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="border-t border-zinc-900 pt-3 space-y-3">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">Destination Settings</span>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Slack Webhook URL</label>
                  <input 
                    type="text" 
                    placeholder="https://hooks.slack.com/services/..."
                    value={newRule.slackWebhook}
                    onChange={(e) => setNewRule({ ...newRule, slackWebhook: e.target.value })}
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Email Recipients (Comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="sre@company.com, alerts@company.com"
                    value={newRule.emailTo}
                    onChange={(e) => setNewRule({ ...newRule, emailTo: e.target.value })}
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Custom Webhook POST Target</label>
                  <input 
                    type="text" 
                    placeholder="https://api.mycompany.com/pagerduty-bridge"
                    value={newRule.webhookUrl}
                    onChange={(e) => setNewRule({ ...newRule, webhookUrl: e.target.value })}
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end border-t border-zinc-900 pt-3">
              <button 
                onClick={() => setShowNewRuleModal(false)}
                className="text-xs px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateRule}
                className="text-xs px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg cursor-pointer"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Toasts Container */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 w-80">
        {toasts.map((t) => (
          <div 
            key={t.id}
            className={`p-3.5 rounded-lg border shadow-xl flex items-start gap-2.5 backdrop-blur-md transition-all ${
              t.type === 'error' ? 'bg-red-950/60 border-red-800/40 text-red-100' :
              t.type === 'warn' ? 'bg-amber-950/60 border-amber-800/40 text-amber-100' :
              'bg-zinc-900/90 border-zinc-800 text-zinc-100'
            }`}
          >
            <Bell className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">{t.title}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{t.message}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
