import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Wrench, Cpu, User, Calendar, ChevronRight, SlidersHorizontal, KeyRound, Copy, Check, Trash2, Pencil } from 'lucide-react';
import type { Project, Task, GpuAlloc } from './TaskDetailPage';

const ALL_GPU_LABELS: Record<string, string> = {
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`H200-${i}`, `H200 GPU-${i}`])),
  ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`L40-${i}`, `L40 GPU-${i}`])),
};

interface Props {
  project: Project;
  onBack: () => void;
  onTaskMaintain: (taskId: number) => void;
  onAddTask: () => void;
  onUpdateProject: (updated: Project) => void;
  onUpdateTask: (updated: Task) => void;
}

function getUsed(project: Project) {
  const cpuUsed = project.tasks.reduce((s, t) => s + t.cpuThreads, 0);
  const ramUsed = project.tasks.reduce((s, t) => s + t.ramGB, 0);
  const gpuUsed: Record<string, number> = {};
  for (const t of project.tasks) for (const g of t.gpuAllocs) gpuUsed[g.gpuId] = (gpuUsed[g.gpuId] ?? 0) + g.memGiB;
  return { cpuUsed, ramUsed, gpuUsed };
}

const statusColor = (s: string) => ({ Active: 'var(--color-success)', Pending: 'var(--color-warning)', Stopped: 'var(--color-danger)' }[s] ?? 'var(--color-gray-400)');
const statusLabel = (s: string) => ({ Active: '運行中', Pending: '待命', Stopped: '已停止', Running: '運行中', Queued: '等待中' }[s] ?? s);
const taskStatusBadge = (s: string) => ({ Running: 'badge-success', Queued: 'badge-warning', Stopped: 'badge-danger' }[s] ?? 'badge-info');
const APPROVED_NOT_ACTIVATED_REQUESTS = [
  { id: 'A2026-004', name: '文件分類研究實驗', resource: 'NVIDIA H200 ×1｜80 GB VRAM' },
  { id: 'A2026-006', name: '知識庫語意檢索服務', resource: 'NVIDIA L40 ×2｜96 GB VRAM' },
];

function useLiveMetrics(tasks: Task[]) {
  const baseRef = useRef<Record<number, { tpm: number; rpm: number }>>({});
  const [metrics, setMetrics] = useState<Record<number, { tpm: number; rpm: number }>>({});

  useEffect(() => {
    tasks.forEach(t => {
      if (!baseRef.current[t.id]) {
        const factor = t.status === 'Running' ? (0.4 + Math.random() * 0.4) : 0;
        baseRef.current[t.id] = {
          tpm: Math.round(t.tpmLimit * factor),
          rpm: Math.round(t.rpmLimit * factor),
        };
      }
    });
    setMetrics({ ...baseRef.current });

    const interval = setInterval(() => {
      tasks.forEach(t => {
        if (t.status !== 'Running') { baseRef.current[t.id] = { tpm: 0, rpm: 0 }; return; }
        const base = baseRef.current[t.id] ?? { tpm: 0, rpm: 0 };
        baseRef.current[t.id] = {
          tpm: Math.max(0, Math.min(t.tpmLimit, Math.round(base.tpm + (Math.random() - 0.5) * t.tpmLimit * 0.08))),
          rpm: Math.max(0, Math.min(t.rpmLimit, Math.round(base.rpm + (Math.random() - 0.5) * t.rpmLimit * 0.08))),
        };
      });
      setMetrics({ ...baseRef.current });
    }, 3000);
    return () => clearInterval(interval);
  }, [tasks.map(t => t.id).join(','), tasks.map(t => t.status).join(',')]);

  return metrics;
}

function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n); }

export function ProjectDetailPage({ project, onBack, onTaskMaintain, onAddTask, onUpdateProject, onUpdateTask }: Props) {
  const used = getUsed(project);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [nodeCpu, setNodeCpu] = useState(project.cpuThreads);
  const [nodeRam, setNodeRam] = useState(project.ramGB);
  const saveNodeResources = () => { onUpdateProject({ ...project, cpuThreads: nodeCpu, ramGB: nodeRam }); setShowNodeEditor(false); };
  const [modelLimitTask, setModelLimitTask] = useState<Task | null>(null);
  const [modelTpmLimit, setModelTpmLimit] = useState(10000);
  const [modelRpmLimit, setModelRpmLimit] = useState(200);
  const openModelLimitModal = (task: Task) => { setModelLimitTask(task); setModelTpmLimit(task.tpmLimit); setModelRpmLimit(task.rpmLimit); };
  const saveModelLimits = () => { if (!modelLimitTask) return; onUpdateTask({ ...modelLimitTask, tpmLimit: modelTpmLimit, rpmLimit: modelRpmLimit }); setModelLimitTask(null); };
  const [limitTask, setLimitTask] = useState<Task | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentTpm, setAgentTpm] = useState(10000);
  const [agentRpm, setAgentRpm] = useState(100);
  const [agentRequestId, setAgentRequestId] = useState('');
  const [agentBackupService, setAgentBackupService] = useState('');
  const [agentTemperature, setAgentTemperature] = useState(0.7);
  const [agentMaxTokens, setAgentMaxTokens] = useState(4096);
  const [agentContextWindow, setAgentContextWindow] = useState('32K');
  const [agentAutoScaling, setAgentAutoScaling] = useState(false);
  const [agentDetailedLogging, setAgentDetailedLogging] = useState(true);
  const [agentsByTask, setAgentsByTask] = useState<Record<number, { id: number; name: string; tpm: number; rpm: number; requestId: string; backupService: string; temperature: number; maxTokens: number; contextWindow: string; autoScaling: boolean; detailedLogging: boolean; active: boolean; key: string }[]>>({});
  const [copiedKey, setCopiedKey] = useState('');
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  const [editTpm, setEditTpm] = useState(10000);
  const [editRpm, setEditRpm] = useState(100);
  const startAgentEdit = (agent: { id: number; tpm: number; rpm: number }) => { setEditingAgentId(agent.id); setEditTpm(agent.tpm); setEditRpm(agent.rpm); };
  const saveAgentLimits = () => {
    if (!limitTask || editingAgentId === null) return;
    setAgentsByTask(prev => ({ ...prev, [limitTask.id]: (prev[limitTask.id] ?? []).map(agent => agent.id === editingAgentId ? { ...agent, tpm: editTpm, rpm: editRpm } : agent) }));
    setEditingAgentId(null);
  };
  const serviceEndpoint = (task: Task) => `https://api.ai-platform.company.com/v1/tasks/${task.id}/inference`;
  const openLimitModal = (task: Task) => { setLimitTask(task); setAgentName(''); setAgentTpm(10000); setAgentRpm(100); setAgentRequestId(''); setAgentBackupService(''); setAgentTemperature(0.7); setAgentMaxTokens(4096); setAgentContextWindow('32K'); setAgentAutoScaling(false); setAgentDetailedLogging(true); };
  const addAgent = () => {
    if (!limitTask || !agentName.trim() || !agentRequestId || !agentBackupService) return;
    const newAgent = { id: Date.now(), name: agentName.trim(), tpm: agentTpm, rpm: agentRpm, requestId: agentRequestId, backupService: agentBackupService, temperature: agentTemperature, maxTokens: agentMaxTokens, contextWindow: agentContextWindow, autoScaling: agentAutoScaling, detailedLogging: agentDetailedLogging, active: true, key: `sk-live-${crypto.randomUUID().replace(/-/g, '').slice(0, 28)}` };
    setAgentsByTask(prev => ({ ...prev, [limitTask.id]: [...(prev[limitTask.id] ?? []), newAgent] }));
    setAgentName('');
  };
  const liveMetrics = useLiveMetrics(project.tasks);

  const gpuGroups = [
    { cluster: 'NVIDIA H200 叢集', allocs: project.gpuAllocs.filter(a => a.gpuId.startsWith('H200')) },
    { cluster: 'NVIDIA L40 叢集', allocs: project.gpuAllocs.filter(a => a.gpuId.startsWith('L40')) },
  ].filter(g => g.allocs.length > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm transition-all hover:opacity-70" style={{ color: 'var(--color-primary-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft className="w-4 h-4" />
          返回工作負載
        </button>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-gray-300)' }} />
        <span className="font-medium" style={{ color: 'var(--color-gray-900)' }}>{project.name}</span>
        <span className="px-2.5 py-0.5 rounded text-xs font-medium" style={{ background: statusColor(project.status) + '18', color: statusColor(project.status), border: `1px solid ${statusColor(project.status)}44` }}>{statusLabel(project.status)}</span>
      </div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Basic Info */}
        <div className="card col-span-2">
          <div className="card-header"><h4 style={{ color: 'var(--color-gray-900)' }}>專案資訊</h4></div>
          <div className="card-body grid grid-cols-2 gap-5">
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>專案名稱</div>
              <div className="font-medium" style={{ color: 'var(--color-gray-900)' }}>{project.name}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>狀態</div>
              <span className="px-2.5 py-0.5 rounded text-xs font-medium" style={{ background: statusColor(project.status) + '18', color: statusColor(project.status), border: `1px solid ${statusColor(project.status)}44` }}>{statusLabel(project.status)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
              <div>
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>專案管理員</div>
                <div className="text-sm mt-0.5" style={{ color: 'var(--color-gray-700)' }}>{project.manager}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
              <div>
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>建立時間</div>
                <div className="text-sm mt-0.5 font-mono" style={{ color: 'var(--color-gray-700)' }}>{project.createdAt}</div>
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>專案描述</div>
              <div className="text-sm" style={{ color: 'var(--color-gray-700)' }}>{project.desc || '—'}</div>
            </div>
          </div>
        </div>

        {/* Resource Summary */}
        <div className="card">
          <div className="card-header"><h4 style={{ color: 'var(--color-gray-900)' }}>資源使用</h4></div>
          <div className="card-body space-y-4">
            {[
              { label: 'CPU', used: used.cpuUsed, total: project.cpuThreads, unit: '線程', color: 'var(--color-teal)' },
              { label: 'RAM', used: used.ramUsed, total: project.ramGB, unit: 'GB', color: 'var(--color-warning)' },
            ].map(bar => (
              <div key={bar.label}>
                <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-gray-600)' }}>
                  <span>{bar.label}</span>
                  <span className="font-mono">{bar.used}/{bar.total} {bar.unit}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--color-gray-200)' }}>
                  <div className="h-2 rounded-full" style={{ width: `${bar.total > 0 ? Math.min(100, (bar.used / bar.total) * 100) : 0}%`, background: bar.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Node Resource Section */}
      <div className="card">
        <div className="card-header"><div className="flex items-center justify-between"><h4 style={{ color: 'var(--color-gray-900)' }}>節點配置</h4><button onClick={() => { setNodeCpu(project.cpuThreads); setNodeRam(project.ramGB); setShowNodeEditor(true); }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}><Pencil className="h-3.5 w-3.5" />編輯資源</button></div></div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-5">
            <div className="p-4 rounded-lg" style={{ background: 'rgba(0,184,217,0.04)', border: '1px solid rgba(0,184,217,0.2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>CPU 配額</div>
              <div className="text-2xl font-mono font-semibold" style={{ color: 'var(--color-teal)' }}>{project.cpuThreads}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>線程</div>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'rgba(255,139,0,0.04)', border: '1px solid rgba(255,139,0,0.2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>RAM 配額</div>
              <div className="text-2xl font-mono font-semibold" style={{ color: 'var(--color-warning)' }}>{project.ramGB}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>GB</div>
            </div>
          </div>

          {/* GPU Allocations */}
          {gpuGroups.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-700)' }}>GPU 配置</div>
              <div className="space-y-3">
                {gpuGroups.map(group => (
                  <div key={group.cluster}>
                    <div className="text-xs mb-2" style={{ color: 'var(--color-gray-400)' }}>{group.cluster}</div>
                    <div className="flex flex-wrap gap-2">
                      {group.allocs.map(alloc => {
                        const usedMem = used.gpuUsed[alloc.gpuId] ?? 0;
                        const pct = alloc.memGiB > 0 ? (usedMem / alloc.memGiB) * 100 : 0;
                        return (
                          <div key={alloc.gpuId} className="px-3 py-2 rounded-lg" style={{ background: 'rgba(0,82,204,0.05)', border: '1px solid rgba(0,82,204,0.15)', minWidth: 120 }}>
                            <div className="text-xs font-mono font-medium" style={{ color: 'var(--color-primary-blue)' }}>{ALL_GPU_LABELS[alloc.gpuId]}</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>{usedMem}/{alloc.memGiB} GiB</div>
                            <div className="h-1 rounded-full mt-1.5" style={{ background: 'rgba(0,82,204,0.15)' }}>
                              <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: 'var(--color-primary-blue)' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h4 style={{ color: 'var(--color-gray-900)' }}>模型服務列表</h4>
            <button
              onClick={onAddTask}
              className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 font-medium hover:shadow-sm transition-all"
              style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              <Plus className="w-3.5 h-3.5" />
              建立模型服務
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          {project.tasks.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--color-gray-400)' }}>此專案尚無模型服務，點擊「建立模型服務」開始</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>模型服務名稱</th>
                    <th>描述</th>
                    <th>類型</th>
                    <th>CPU</th>
                    <th>RAM</th>
                    <th>GPU</th>
                    <th>狀態</th>
                    <th>開始時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map(task => {
                    const m = liveMetrics[task.id] ?? { tpm: 0, rpm: 0 };
                    const tpmPct = task.tpmLimit > 0 ? m.tpm / task.tpmLimit : 0;
                    const rpmPct = task.rpmLimit > 0 ? m.rpm / task.rpmLimit : 0;
                    const usageColor = (pct: number) => pct > 0.85 ? 'var(--color-danger)' : pct > 0.6 ? 'var(--color-warning)' : 'var(--color-success)';
                    return (
                    <tr key={task.id} onContextMenu={event => { event.preventDefault(); openLimitModal(task); }}>
                      <td style={{ color: 'var(--color-gray-900)', fontWeight: 500 }}>{task.name}</td>
                      <td style={{ color: 'var(--color-gray-500)', fontSize: 12 }}>{task.desc || '—'}</td>
                      <td><span className="badge badge-info" style={{ fontSize: '11px' }}>{task.jobType === 'Training' ? '推論服務' : task.jobType}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{task.cpuThreads} 線</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{task.ramGB} GB</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-teal)' }}>
                        {task.gpuAllocs.length > 0 ? `${task.gpuAllocs.length} 張` : '—'}
                      </td>
                      <td><span className={`badge ${taskStatusBadge(task.status)}`} style={{ fontSize: '11px' }}>{statusLabel(task.status)}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-gray-400)' }}>{task.startTime}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onTaskMaintain(task.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:shadow-sm transition-all"
                            style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}
                          >
                            <Wrench className="w-3 h-3" />
                            維護
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNodeEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.4)' }} onClick={() => setShowNodeEditor(false)}>
          <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: 'white' }} onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-5" style={{ borderColor: 'var(--color-gray-200)' }}><div><h3 style={{ color: 'var(--color-gray-900)' }}>編輯節點配置</h3><p className="mt-1 text-xs" style={{ color: 'var(--color-gray-400)' }}>調整此專案可使用的 CPU 與 RAM 資源上限</p></div><button onClick={() => setShowNodeEditor(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-400)' }}>×</button></div>
            <div className="space-y-5 p-5"><label><span className="mb-2 flex justify-between text-sm" style={{ color: 'var(--color-gray-700)' }}>CPU 配額 <b className="font-mono" style={{ color: 'var(--color-teal)' }}>{nodeCpu} 線程</b></span><input type="range" min="1" max="128" step="1" value={nodeCpu} onChange={e => setNodeCpu(Number(e.target.value))} className="w-full accent-[#00b8d9]" /></label><label><span className="mb-2 flex justify-between text-sm" style={{ color: 'var(--color-gray-700)' }}>RAM 配額 <b className="font-mono" style={{ color: 'var(--color-warning)' }}>{nodeRam} GB</b></span><input type="range" min="16" max="1024" step="16" value={nodeRam} onChange={e => setNodeRam(Number(e.target.value))} className="w-full accent-[#ff8b00]" /></label><div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)' }}>GPU 配置會依模型服務配置與專案配額顯示於本頁。</div></div>
            <div className="flex justify-end gap-3 border-t p-5" style={{ borderColor: 'var(--color-gray-200)' }}><button onClick={() => setShowNodeEditor(false)} className="rounded-lg px-4 py-2 text-sm" style={{ background: 'var(--color-gray-100)', border: 'none', cursor: 'pointer' }}>取消</button><button onClick={saveNodeResources} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: 'var(--color-primary-blue)', border: 'none', cursor: 'pointer' }}>儲存配置</button></div>
          </div>
        </div>
      )}

      {limitTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.28)' }} onClick={() => setLimitTask(null)}>
          <div className="w-full max-w-[624px] overflow-hidden rounded-xl shadow-2xl" style={{ background: 'var(--color-bg-white)' }} onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-gray-200)' }}>
              <div>
                <h3 className="text-base font-medium" style={{ color: 'var(--color-gray-900)' }}>用量限制管理</h3>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--color-gray-500)' }}>服務：{limitTask.name}</p>
              </div>
              <button aria-label="關閉" onClick={() => setLimitTask(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-xl leading-none" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-500)', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
            <div className="space-y-5 px-4 py-6">
              <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(0,82,204,0.18)', background: 'rgba(0,82,204,0.045)' }}>
                <div className="mb-2 text-xs" style={{ color: 'var(--color-gray-500)' }}>服務 API Endpoint（所有 Agent 共用）</div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs" style={{ background: 'var(--color-gray-50)', borderColor: 'var(--color-gray-200)', color: 'var(--color-primary-blue)' }}>{serviceEndpoint(limitTask)}</div>
                  <button onClick={() => { navigator.clipboard?.writeText(serviceEndpoint(limitTask)); setCopiedKey('endpoint'); }} className="flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-xs font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>{copiedKey === 'endpoint' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}複製</button>
                </div>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-gray-200)', background: '#fafbfd' }}>
                <div className="mb-3 text-sm" style={{ color: 'var(--color-gray-700)' }}>新增 Agent</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label><span className="mb-1.5 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Agent 名稱</span><input value={agentName} onChange={event => setAgentName(event.target.value)} placeholder="e.g. 前台機器人" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--color-gray-300)', background: 'white' }} /></label>
                  <label><span className="mb-1.5 block text-xs" style={{ color: 'var(--color-gray-500)' }}>勾稽算力申請（已核定、未開通）</span><select value={agentRequestId} onChange={event => setAgentRequestId(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'white' }}><option value="">請選擇核定申請</option>{APPROVED_NOT_ACTIVATED_REQUESTS.map(request => <option key={request.id} value={request.id}>{request.id}｜{request.name}</option>)}</select></label>
                  <label><span className="mb-1.5 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>TPM 上限</span><b className="font-mono font-medium" style={{ color: 'var(--color-primary-blue)' }}>{agentTpm.toLocaleString()}</b></span><input type="range" min="1000" max="500000" step="1000" value={agentTpm} onChange={event => setAgentTpm(Number(event.target.value))} className="w-full accent-[#0052cc]" /><span className="flex justify-between text-[10px]" style={{ color: 'var(--color-gray-400)' }}><span>1K</span><span>500K</span></span></label>
                  <label><span className="mb-1.5 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>RPM 上限</span><b className="font-mono font-medium" style={{ color: 'var(--color-teal)' }}>{agentRpm.toLocaleString()}</b></span><input type="range" min="10" max="10000" step="10" value={agentRpm} onChange={event => setAgentRpm(Number(event.target.value))} className="w-full accent-[#00b8d9]" /><span className="flex justify-between text-[10px]" style={{ color: 'var(--color-gray-400)' }}><span>10</span><span>10K</span></span></label>
                  <label className="sm:col-span-2"><span className="mb-1.5 block text-xs" style={{ color: 'var(--color-gray-500)' }}>備用模型服務</span><select value={agentBackupService} onChange={event => setAgentBackupService(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'white' }}><option value="">請選擇已建立的模型服務</option>{project.tasks.map(service => <option key={service.id} value={service.name}>{service.name}</option>)}</select><p className="mt-1.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>當流量暴增超過設定用量時，系統將自動切換至備用模型。</p></label>
                  <div className="sm:col-span-2 rounded-lg border p-3" style={{ borderColor: 'rgba(0,82,204,0.16)', background: 'rgba(0,82,204,0.025)' }}>
                    <div className="mb-3 text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>模型效能與進階配置</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label><span className="mb-1 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>Temperature</span><b className="font-mono" style={{ color: 'var(--color-primary-blue)' }}>{agentTemperature.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" value={agentTemperature} onChange={event => setAgentTemperature(Number(event.target.value))} className="w-full accent-[#0052cc]" /></label><label><span className="mb-1 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Max Tokens</span><input type="number" min="256" step="256" value={agentMaxTokens} onChange={event => setAgentMaxTokens(Number(event.target.value))} className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'white' }} /></label><label><span className="mb-1 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Context Window</span><select value={agentContextWindow} onChange={event => setAgentContextWindow(event.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'white' }}>{['4K','8K','16K','32K','64K','128K'].map(size => <option key={size}>{size}</option>)}</select></label></div>
                    <div className="mt-3 flex flex-wrap gap-5 text-xs" style={{ color: 'var(--color-gray-700)' }}><label className="flex items-center gap-2"><input type="checkbox" checked={agentAutoScaling} onChange={event => setAgentAutoScaling(event.target.checked)} />啟用自動擴展</label><label className="flex items-center gap-2"><input type="checkbox" checked={agentDetailedLogging} onChange={event => setAgentDetailedLogging(event.target.checked)} />啟用詳細日誌</label></div>
                  </div>
                </div>
                <button onClick={addAgent} disabled={!agentName.trim() || !agentRequestId || !agentBackupService} className="mt-3 flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}><span className="text-lg leading-none">＋</span>新增 Agent</button>
              </div>
              {(agentsByTask[limitTask.id] ?? []).length === 0 ? (
                <p className="py-7 text-center text-sm" style={{ color: 'var(--color-gray-400)' }}>尚未建立任何 Agent，請在上方表單填寫後新增</p>
              ) : (
                <div>
                  <div className="mb-3 text-sm" style={{ color: 'var(--color-gray-700)' }}>已建立的 Agent（{agentsByTask[limitTask.id].length} 個）</div>
                  <div className="space-y-3">
                    {agentsByTask[limitTask.id].map(agent => {
                      const isEditing = editingAgentId === agent.id;
                      return <div key={agent.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-gray-200)', background: 'white' }}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium" style={{ background: '#f0edff', color: '#6554c0' }}>{agent.name.slice(0, 1).toUpperCase()}</span><div><div className="flex items-center gap-1.5"><span className="block text-sm font-medium" style={{ color: 'var(--color-gray-800)' }}>{agent.name}</span><span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: agent.active ? 'rgba(54,179,126,0.12)' : 'var(--color-gray-100)', color: agent.active ? 'var(--color-success)' : 'var(--color-gray-500)' }}>{agent.active ? '啟用中' : '已停用'}</span></div><span className="text-[10px]" style={{ color: 'var(--color-gray-400)' }}>申請：{agent.requestId}｜備用：{agent.backupService}</span></div></div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => isEditing ? setEditingAgentId(null) : startAgentEdit(agent)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium" style={{ background: 'rgba(0,82,204,0.08)', color: 'var(--color-primary-blue)', border: '1px solid rgba(0,82,204,0.16)', cursor: 'pointer' }}><Pencil className="h-3 w-3" />{isEditing ? '取消' : '編輯'}</button>
                            <button onClick={() => setAgentsByTask(prev => ({ ...prev, [limitTask.id]: (prev[limitTask.id] ?? []).map(item => item.id === agent.id ? { ...item, active: !item.active } : item) }))} className="flex h-7 items-center rounded-lg px-2 text-xs font-medium" style={{ background: agent.active ? 'rgba(222,53,11,0.09)' : 'rgba(54,179,126,0.12)', color: agent.active ? 'var(--color-danger)' : 'var(--color-success)', border: 'none', cursor: 'pointer' }}>{agent.active ? '停用' : '啟用'}</button>
                            <button aria-label={`刪除 ${agent.name}`} onClick={() => setAgentsByTask(prev => ({ ...prev, [limitTask.id]: (prev[limitTask.id] ?? []).filter(item => item.id !== agent.id) }))} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(222,53,11,0.09)', color: 'var(--color-danger)', border: 'none', cursor: 'pointer' }}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="mb-3 rounded-lg border p-3" style={{ borderColor: 'rgba(0,82,204,0.16)', background: 'rgba(0,82,204,0.025)' }}>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <label><span className="mb-1 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>TPM 上限</span><b className="font-mono" style={{ color: 'var(--color-primary-blue)' }}>{editTpm.toLocaleString()}</b></span><input type="range" min="1000" max="500000" step="1000" value={editTpm} onChange={event => setEditTpm(Number(event.target.value))} className="w-full accent-[#0052cc]" /></label>
                              <label><span className="mb-1 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>RPM 上限</span><b className="font-mono" style={{ color: 'var(--color-teal)' }}>{editRpm.toLocaleString()}</b></span><input type="range" min="10" max="10000" step="10" value={editRpm} onChange={event => setEditRpm(Number(event.target.value))} className="w-full accent-[#00b8d9]" /></label>
                            </div>
                            <div className="mt-3 flex justify-end gap-2"><button onClick={() => setEditingAgentId(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>取消</button><button onClick={saveAgentLimits} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}>儲存限制</button></div>
                          </div>
                        ) : <div className="mb-3 grid grid-cols-2 gap-3"><div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-gray-50)', color: 'var(--color-gray-500)' }}>TPM 上限：<b className="ml-1 font-mono font-medium" style={{ color: 'var(--color-primary-blue)' }}>{agent.tpm.toLocaleString()}</b></div><div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-gray-50)', color: 'var(--color-gray-500)' }}>RPM 上限：<b className="ml-1 font-mono font-medium" style={{ color: 'var(--color-teal)' }}>{agent.rpm.toLocaleString()}</b></div></div>}
                        <div className="mb-1.5 text-xs" style={{ color: 'var(--color-gray-500)' }}>⌘ API Key（專屬此 Agent）</div>
                        <div className="flex items-center gap-2"><div className="min-w-0 flex-1 truncate rounded-md border px-3 py-2 font-mono text-xs" style={{ borderColor: '#d8d2f5', background: '#faf9ff', color: '#6554c0' }}>{agent.key}</div><button onClick={() => { navigator.clipboard?.writeText(agent.key); setCopiedKey(agent.key); }} className="flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-xs font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>{copiedKey === agent.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}複製</button></div>
                      </div>;
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t px-4 py-4" style={{ borderColor: 'var(--color-gray-200)' }}><button onClick={() => setLimitTask(null)} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>關閉</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
