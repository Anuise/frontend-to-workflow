import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Edit2, Check, X, Play, RotateCcw, Square, Trash2, AlertTriangle, ChevronRight, Power, KeyRound } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface GpuAlloc { gpuId: string; memGiB: number; }
export interface Task {
  id: number; name: string; desc: string;
  status: 'Running' | 'Queued' | 'Stopped';
  jobType: string; gpuAllocs: GpuAlloc[];
  cpuThreads: number; ramGB: number; startTime: string;
  tpmLimit: number; rpmLimit: number;
  modelConfig?: { temperature: number; maxTokens: number; contextWindow: string; autoScaling: boolean; detailedLogging: boolean };
}
export interface Project {
  id: number; name: string; status: 'Active' | 'Pending' | 'Stopped';
  cpuThreads: number; ramGB: number; gpuAllocs: GpuAlloc[];
  manager: string; createdAt: string; desc: string; tasks: Task[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TABS = ['資訊', '資源', 'API監控', '設定', '日誌', '描述'] as const;
type Tab = typeof TABS[number];

// ─── Terminal Component ───────────────────────────────────────────────────────
function Terminal({ lines, onCommand, readOnly = false }: { lines: string[]; onCommand?: (cmd: string) => void; readOnly?: boolean }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim() && onCommand) {
      onCommand(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden" style={{ background: '#0d1117', fontFamily: 'monospace', fontSize: 13 }}>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b" style={{ background: '#161b22', borderColor: '#30363d' }}>
        <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
        <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
        <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        <span className="ml-2 text-xs" style={{ color: '#8b949e' }}>bash</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5" style={{ minHeight: 0 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.startsWith('$') ? '#79c0ff' : line.startsWith('[ERROR]') ? '#f85149' : line.startsWith('[WARN]') ? '#e3b341' : '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {!readOnly && (
        <div className="flex items-center px-4 py-2 border-t" style={{ borderColor: '#30363d', background: '#161b22' }}>
          <span style={{ color: '#79c0ff' }}>$ </span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="輸入指令..."
            className="flex-1 ml-2 bg-transparent outline-none text-sm"
            style={{ color: '#c9d1d9', caretColor: '#c9d1d9' }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      )}
    </div>
  );
}

// ─── Resource Chart ───────────────────────────────────────────────────────────
type MetricPt = { time: string; v: number };

function MetricCard({ title, data, unit, color, domain }: { title: string; data: MetricPt[]; unit: string; color: string; domain?: [number, number] }) {
  return (
    <div className="card">
      <div className="card-body p-3">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>{title}</div>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#aaa' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#aaa' }} unit={unit} domain={domain ?? ['auto', 'auto']} width={48} />
            <Tooltip contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 4 }} formatter={(v: number) => [`${v.toFixed(1)}${unit}`, '']} labelStyle={{ display: 'none' }} />
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-xs mt-1 font-mono text-right" style={{ color }}>
          {data.length > 0 ? `${data[data.length - 1].v.toFixed(1)}${unit}` : '—'}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  task: Task;
  project: Project;
  onBack: () => void;
  onDelete: () => void;
  onUpdateTask: (updated: Task) => void;
}

const MAX_PTS = 30;

function initPts(base: number, variance: number): MetricPt[] {
  const now = Date.now();
  return Array.from({ length: MAX_PTS }, (_, i) => {
    const d = new Date(now - (MAX_PTS - i) * 2000);
    return { time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, v: Math.max(0, base + (Math.random() - 0.5) * 2 * variance) };
  });
}

function addPt(prev: MetricPt[], base: number, variance: number): MetricPt[] {
  const d = new Date();
  const pt = { time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, v: Math.max(0, base + (Math.random() - 0.5) * 2 * variance) };
  return [...prev.slice(-(MAX_PTS - 1)), pt];
}

export function TaskDetailPage({ task, project, onBack, onDelete, onUpdateTask }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('資訊');

  // ── 資訊 tab ──
  const [codeLines, setCodeLines] = useState<string[]>([
    '$ # 歡迎使用終端機，您可以在此輸入程式碼',
    '$ # 點擊「提交」按鈕將程式碼封裝為新模型版本',
    '$ ',
  ]);
  const [modelTag, setModelTag] = useState('v1.0');
  const [modelDesc, setModelDesc] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');

  const handleCodeCmd = useCallback((cmd: string) => {
    setCodeLines(prev => [...prev, `$ ${cmd}`, `> 指令已接收`]);
  }, []);

  const handleSubmit = () => {
    setCodeLines(prev => [...prev, `$ # 封裝模型版本: ${modelTag}`, `> [INFO] 正在打包... 完成`, `> [INFO] 新版本已上傳至模型庫`]);
    setSubmitMsg(`已提交新版本 ${modelTag}`);
    setTimeout(() => setSubmitMsg(''), 3000);
  };

  // ── 資源 tab ──
  const cpuBase = task.cpuThreads * 800;
  const ramBase = task.ramGB * 0.65 * 1024;

  const [cpuUtil, setCpuUtil] = useState(() => initPts(75, 15));
  const [cpuUsage, setCpuUsage] = useState(() => initPts(cpuBase, cpuBase * 0.1));
  const [ramLimitPct, setRamLimitPct] = useState(() => initPts(65, 10));
  const [ramUsed, setRamUsed] = useState(() => initPts(ramBase, ramBase * 0.05));
  const [memFaults, setMemFaults] = useState(() => initPts(12, 8));
  const [memUsage, setMemUsage] = useState(() => initPts(ramBase * 0.9, ramBase * 0.04));
  const [memWriteback, setMemWriteback] = useState(() => initPts(256, 128));
  const [ioOps, setIoOps] = useState(() => initPts(45, 20));
  const [ioBw, setIoBw] = useState(() => initPts(1024, 512));
  const [apiInputTokens, setApiInputTokens] = useState(() => initPts(8200, 1600));
  const [apiOutputTokens, setApiOutputTokens] = useState(() => initPts(2600, 600));
  const [apiLatency, setApiLatency] = useState(() => initPts(280, 55));
  const [apiErrorRate, setApiErrorRate] = useState(() => initPts(0.3, 0.18));
  const [apiKeyProjects, setApiKeyProjects] = useState(() => [
    { id: 'A2026-001', project: '行政智慧助理', key: 'sk-a1b2c3d4-e5f6…', tpm: 18420, rpm: 326, active: localStorage.getItem('api-key-A2026-001') !== 'disabled' },
    { id: 'A2026-006', project: '知識庫語意檢索服務', key: 'sk-c4d9e2f1-a667…', tpm: 8240, rpm: 142, active: localStorage.getItem('api-key-A2026-006') !== 'disabled' },
  ]);

  useEffect(() => {
    if (activeTab !== '資源') return;
    const t = setInterval(() => {
      setCpuUtil(p => addPt(p, 75, 15));
      setCpuUsage(p => addPt(p, cpuBase, cpuBase * 0.1));
      setRamLimitPct(p => addPt(p, 65, 10));
      setRamUsed(p => addPt(p, ramBase, ramBase * 0.05));
      setMemFaults(p => addPt(p, 12, 8));
      setMemUsage(p => addPt(p, ramBase * 0.9, ramBase * 0.04));
      setMemWriteback(p => addPt(p, 256, 128));
      setIoOps(p => addPt(p, 45, 20));
      setIoBw(p => addPt(p, 1024, 512));
    }, 2000);
    return () => clearInterval(t);
  }, [activeTab, cpuBase, ramBase]);

  useEffect(() => {
    if (activeTab !== 'API監控') return;
    const timer = setInterval(() => {
      setApiInputTokens(points => addPt(points, 8200, 1600));
      setApiOutputTokens(points => addPt(points, 2600, 600));
      setApiLatency(points => addPt(points, 280, 55));
      setApiErrorRate(points => addPt(points, 0.3, 0.18));
    }, 2000);
    return () => clearInterval(timer);
  }, [activeTab]);

  // ── 設定 tab ──
  const [editName, setEditName] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const [nameVal, setNameVal] = useState(task.name);
  const [descVal, setDescVal] = useState(task.desc);
  const [taskStatus, setTaskStatus] = useState<Task['status']>(task.status);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResModal, setShowResModal] = useState(false);
  const [resCpu, setResCpu] = useState(task.cpuThreads);
  const [resRam, setResRam] = useState(task.ramGB);
  const [modelTemperature, setModelTemperature] = useState(task.modelConfig?.temperature ?? 0.7);
  const [modelMaxTokens, setModelMaxTokens] = useState(task.modelConfig?.maxTokens ?? 4096);
  const [modelContextWindow, setModelContextWindow] = useState(task.modelConfig?.contextWindow ?? '32K');
  const [modelAutoScaling, setModelAutoScaling] = useState(task.modelConfig?.autoScaling ?? false);
  const [modelDetailedLogging, setModelDetailedLogging] = useState(task.modelConfig?.detailedLogging ?? true);
  const saveModelConfig = () => onUpdateTask({ ...task, modelConfig: { temperature: modelTemperature, maxTokens: modelMaxTokens, contextWindow: modelContextWindow, autoScaling: modelAutoScaling, detailedLogging: modelDetailedLogging } });

  const saveField = (field: 'name' | 'desc') => {
    onUpdateTask({ ...task, name: nameVal, desc: descVal, status: taskStatus });
    if (field === 'name') setEditName(false);
    else setEditDesc(false);
  };

  const handleStatus = (s: Task['status']) => {
    setTaskStatus(s);
    onUpdateTask({ ...task, status: s });
  };

  const saveResources = () => {
    onUpdateTask({ ...task, cpuThreads: resCpu, ramGB: resRam });
    setShowResModal(false);
  };

  // ── 日誌 tab ──
  const initLogs = [
    `[2026-07-07 ${task.startTime || '14:00'}:00] INFO  任務啟動中...`,
    `[2026-07-07 ${task.startTime || '14:00'}:01] INFO  容器初始化完成`,
    `[2026-07-07 ${task.startTime || '14:00'}:03] INFO  GPU ${task.gpuAllocs.map(g => g.gpuId).join(', ')} 已掛載`,
    `[2026-07-07 ${task.startTime || '14:00'}:05] INFO  模型載入中...`,
    `[2026-07-07 ${task.startTime || '14:00'}:12] INFO  模型載入完成`,
    `[2026-07-07 ${task.startTime || '14:00'}:13] INFO  訓練迴圈開始 (epoch 1/100)`,
    `[2026-07-07 14:05:00] INFO  epoch  1/100 - loss: 2.4312 - acc: 0.3214`,
    `[2026-07-07 14:10:00] INFO  epoch  5/100 - loss: 1.8721 - acc: 0.4876`,
    `[2026-07-07 14:20:00] INFO  epoch 10/100 - loss: 1.3204 - acc: 0.5932`,
    `[2026-07-07 14:30:00] INFO  epoch 20/100 - loss: 0.9871 - acc: 0.6744`,
    `[2026-07-07 14:31:00] WARN  記憶體使用率 87%，接近警戒值`,
    `[2026-07-07 14:35:00] INFO  checkpoint 儲存至 /models/ckpt-epoch20.pt`,
    `[2026-07-07 14:35:02] INFO  繼續訓練...`,
  ];
  const [logLines, setLogLines] = useState(initLogs);

  useEffect(() => {
    if (activeTab !== '日誌') return;
    const t = setInterval(() => {
      const d = new Date();
      const ts = `[${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}]`;
      const entries = [
        `${ts} INFO  batch ${Math.floor(Math.random()*1000+200)}/1250 - loss: ${(Math.random()*0.5+0.4).toFixed(4)}`,
        `${ts} INFO  GPU 利用率: ${Math.floor(Math.random()*20+75)}%`,
      ];
      setLogLines(prev => [...prev, ...entries].slice(-200));
    }, 3000);
    return () => clearInterval(t);
  }, [activeTab]);

  // ── 描述 tab ──
  const descLines = [
    '$ kubectl describe pod ' + task.name.toLowerCase().replace(/\s/g, '-'),
    '',
    `Name:         ${task.name.toLowerCase().replace(/\s/g, '-')}-${task.id}`,
    `Namespace:    project-${project.id}-ns`,
    `Node:         gpu-node-01`,
    `IP:           10.244.${project.id}.${task.id}`,
    `Start Time:   Mon, 07 Jul 2026 ${task.startTime || '14:00'}:00 +0800`,
    `Status:       ${task.status}`,
    `Restart Count: 0`,
    '',
    `Labels:`,
    `  app=${task.name.toLowerCase().replace(/\s/g, '-')}`,
    `  project=${project.name.toLowerCase().replace(/\s/g, '-')}`,
    `  job-type=${task.jobType}`,
    '',
    `Resource Requests:`,
    `  cpu:    ${task.cpuThreads * 1000}m`,
    `  memory: ${task.ramGB}Gi`,
    task.gpuAllocs.length > 0 ? `  nvidia.com/gpu: ${task.gpuAllocs.length}` : '',
    '',
    `Volumes:`,
    `  /workspace (ReadWriteMany)`,
    `  /models    (ReadWriteOnce)`,
    '',
    `Events:`,
    `  Normal  Scheduled   0s  default-scheduler  Successfully assigned to gpu-node-01`,
    `  Normal  Pulling     1s  kubelet            Pulling image "pytorch/pytorch:2.1-cuda12"`,
    `  Normal  Pulled      8s  kubelet            Successfully pulled image`,
    `  Normal  Created    10s  kubelet            Created container task-runner`,
    `  Normal  Started    11s  kubelet            Started container task-runner`,
  ].filter(l => l !== undefined);

  // ── Port & Mount display ──
  const portPairs = task.gpuAllocs.length > 0
    ? [{ internal: '8888', external: '30888' }, { internal: '6006', external: '30606' }]
    : [{ internal: '8080', external: '30080' }];
  const mounts = ['/workspace/data', '/models/output'];

  const statusColor = (s: string) => ({ Running: 'var(--color-success)', Queued: 'var(--color-warning)', Stopped: 'var(--color-danger)' }[s] ?? 'var(--color-gray-400)');
  const statusLabel = (s: string) => ({ Running: '運行中', Queued: '等待中', Stopped: '已停止' }[s] ?? s);

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm transition-all hover:opacity-70" style={{ color: 'var(--color-primary-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft className="w-4 h-4" />
          返回專案
        </button>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-gray-300)' }} />
        <span className="text-sm" style={{ color: 'var(--color-gray-500)' }}>{project.name}</span>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-gray-300)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>{nameVal}</span>
        <span className="badge" style={{ fontSize: '11px', background: statusColor(taskStatus) + '22', color: statusColor(taskStatus), border: `1px solid ${statusColor(taskStatus)}44` }}>{statusLabel(taskStatus)}</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b mb-5" style={{ borderColor: 'var(--color-gray-200)' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all"
            style={{ borderBottomColor: activeTab === tab ? 'var(--color-primary-blue)' : 'transparent', color: activeTab === tab ? 'var(--color-primary-blue)' : 'var(--color-gray-500)', background: 'transparent', cursor: 'pointer' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── 資訊 Tab ── */}
      {activeTab === '資訊' && (
        <div className="flex gap-5 flex-1" style={{ minHeight: 0 }}>
          {/* Left: Terminal */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 400 }}>
            <Terminal lines={codeLines} onCommand={handleCodeCmd} />
          </div>

          {/* Right: Model + Ports */}
          <div className="w-80 flex flex-col gap-4 flex-shrink-0">
            {/* Model Info */}
            <div className="card">
              <div className="card-header"><h4 style={{ color: 'var(--color-gray-900)' }}>模型資訊</h4></div>
              <div className="card-body space-y-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-gray-400)' }}>模型名稱</label>
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)', border: '1px solid var(--color-gray-200)' }}>{task.jobType === 'Training' ? 'LLaMA 3' : 'Mistral'}</div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-gray-400)' }}>模型標籤</label>
                  <input type="text" value={modelTag} onChange={e => setModelTag(e.target.value)} placeholder="e.g. v2.0-finetuned" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-gray-400)' }}>模型描述</label>
                  <textarea value={modelDesc} onChange={e => setModelDesc(e.target.value)} placeholder="描述此版本模型的改動..." rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                </div>
                {submitMsg && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(54,179,126,0.1)', color: 'var(--color-success)' }}>{submitMsg}</div>}
                <div className="flex gap-2">
                  <button onClick={handleSubmit} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}>提交</button>
                  <button onClick={() => { setModelTag('v1.0'); setModelDesc(''); }} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>取消</button>
                </div>
              </div>
            </div>

            {/* Port & Mounts */}
            <div className="card">
              <div className="card-header"><h4 style={{ color: 'var(--color-gray-900)' }}>連接埠 / 磁碟區</h4></div>
              <div className="card-body space-y-4">
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-500)' }}>連接埠</div>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)' }}>
                    <div className="grid grid-cols-2 px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)', borderBottom: '1px solid var(--color-gray-200)' }}>
                      <span>內部</span><span>外部</span>
                    </div>
                    {portPairs.map((p, i) => (
                      <div key={i} className="grid grid-cols-2 px-3 py-2 text-xs font-mono" style={{ borderBottom: i < portPairs.length - 1 ? '1px solid var(--color-gray-100)' : undefined, color: 'var(--color-gray-700)' }}>
                        <span>{p.internal}</span><span>{p.external}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-500)' }}>掛載磁碟區</div>
                  <div className="space-y-1">
                    {mounts.map((m, i) => (
                      <div key={i} className="px-3 py-2 rounded text-xs font-mono" style={{ background: 'var(--color-gray-50)', color: 'var(--color-teal)', border: '1px solid var(--color-gray-200)' }}>{m}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 資源 Tab ── */}
      {activeTab === '資源' && (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard title="CPU 利用率" data={cpuUtil} unit="%" color="#0052CC" domain={[0, 100]} />
          <MetricCard title="CPU 使用量" data={cpuUsage} unit="m" color="#00B8D9" />
          <MetricCard title="RAM 使用量 (限制內已用)" data={ramLimitPct} unit="%" color="#36B37E" domain={[0, 100]} />
          <MetricCard title="RAM 使用量 (已用記憶體)" data={ramUsed} unit=" MiB" color="#FF8B00" />
          <MetricCard title="記憶體頁面錯誤" data={memFaults} unit="/s" color="#DE350B" />
          <MetricCard title="記憶體使用量" data={memUsage} unit=" MiB" color="#6554C0" />
          <MetricCard title="回寫記憶體" data={memWriteback} unit=" KiB" color="#0065FF" />
          <MetricCard title="I/O 操作 (節流服務 OPS)" data={ioOps} unit=" OPS" color="#00875A" />
          <MetricCard title="I/O 吞吐量 (節流 I/O 頻寬)" data={ioBw} unit=" KiB/s" color="#FF5630" />
        </div>
      )}

      {/* ── API Monitoring Tab ── */}
      {activeTab === 'API監控' && (
        <div className="space-y-5">
          <div className="card">
            <div className="card-header flex items-center justify-between"><div><h4 style={{ color: 'var(--color-gray-900)' }}>統一 API 閘道監控</h4><p className="mt-0.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>模型服務 {nameVal} 的即時流量、延遲與錯誤監控</p></div><span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'rgba(54,179,126,0.12)', color: 'var(--color-success)' }}>服務正常</span></div>
            <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-4">
              {[{ label: '服務端點', value: `https://api.ai-platform.tw/v1/tasks/${task.id}/chat/completions`, mono: true, color: 'var(--color-primary-blue)' }, { label: '推論引擎', value: 'vLLM Engine', color: 'var(--color-gray-900)' }, { label: 'P95 延遲', value: `${Math.round(apiLatency[apiLatency.length - 1].value)} ms`, color: 'var(--color-teal)' }, { label: '錯誤率', value: `${Math.max(0, apiErrorRate[apiErrorRate.length - 1].value).toFixed(2)}%`, color: 'var(--color-success)' }].map(item => <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--color-gray-50)' }}><div className="mb-1 text-xs" style={{ color: 'var(--color-gray-400)' }}>{item.label}</div><div className={`text-sm font-medium ${item.mono ? 'truncate font-mono text-xs' : 'font-mono'}`} style={{ color: item.color }} title={item.value}>{item.value}</div></div>)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><MetricCard title="Input Tokens / 分鐘" data={apiInputTokens} unit="" color="#0052CC" /><MetricCard title="Output Tokens / 分鐘" data={apiOutputTokens} unit="" color="#00B8D9" /><MetricCard title="P95 API 延遲" data={apiLatency} unit=" ms" color="#6554C0" /><MetricCard title="API 錯誤率" data={apiErrorRate} unit="%" color="#DE350B" /></div>
          <div className="card"><div className="card-header"><div className="flex items-center justify-between"><div><h4 style={{ color: 'var(--color-gray-900)' }}>已開放 API Key 的專案列表</h4><p className="mt-0.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>個別專案 API Key 的即時使用量與服務狀態</p></div><KeyRound className="h-5 w-5" style={{ color: 'var(--color-primary-blue)' }} /></div></div><div className="overflow-x-auto"><table className="table"><thead><tr><th>案件</th><th>專案</th><th>API Key</th><th>TPM 使用量</th><th>RPM 使用量</th><th>狀態</th><th>操作</th></tr></thead><tbody>{apiKeyProjects.map(item => <tr key={item.id}><td className="font-mono text-xs">{item.id}</td><td>{item.project}</td><td className="font-mono text-xs" style={{ color: 'var(--color-primary-blue)' }}>{item.key}</td><td className="font-mono text-xs">{item.tpm.toLocaleString()}</td><td className="font-mono text-xs">{item.rpm.toLocaleString()}</td><td><span className="rounded-full px-2 py-1 text-xs" style={{ background: item.active ? '#E3FCEF' : '#EBECF0', color: item.active ? '#006644' : '#5E6C84' }}>{item.active ? '已啟用' : '已停用'}</span></td><td><button onClick={() => setApiKeyProjects(prev => prev.map(entry => { if (entry.id !== item.id) return entry; const active = !entry.active; localStorage.setItem(`api-key-${entry.id}`, active ? 'active' : 'disabled'); return { ...entry, active }; }))} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: item.active ? '#FFEBE6' : '#E3FCEF', color: item.active ? '#AE2E24' : '#006644', border: 'none', cursor: 'pointer' }}><Power className="h-3 w-3" />{item.active ? '停用' : '啟用'}</button></td></tr>)}</tbody></table></div></div>
        </div>
      )}

      {/* ── 設定 Tab ── */}
      {activeTab === '設定' && (
        <div className="space-y-5 max-w-2xl">
          {/* Task Name */}
          <div className="card">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                {editName ? (
                  <input type="text" value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus className="flex-1 px-3 py-2 rounded-lg border text-sm mr-3" style={{ borderColor: 'var(--color-primary-blue)', color: 'var(--color-gray-900)' }} />
                ) : (
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: 'var(--color-gray-400)' }}>任務名稱</div>
                    <div className="font-medium" style={{ color: 'var(--color-gray-900)' }}>{nameVal}</div>
                  </div>
                )}
                {editName ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveField('name')} className="p-2 rounded-lg" style={{ background: 'var(--color-success)', border: 'none', cursor: 'pointer' }}><Check className="w-4 h-4 text-white" /></button>
                    <button onClick={() => { setNameVal(task.name); setEditName(false); }} className="p-2 rounded-lg" style={{ background: 'var(--color-gray-200)', border: 'none', cursor: 'pointer' }}><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditName(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}><Edit2 className="w-3.5 h-3.5" />編輯</button>
                )}
              </div>

              <div className="flex items-center justify-between">
                {editDesc ? (
                  <input type="text" value={descVal} onChange={e => setDescVal(e.target.value)} autoFocus className="flex-1 px-3 py-2 rounded-lg border text-sm mr-3" style={{ borderColor: 'var(--color-primary-blue)', color: 'var(--color-gray-900)' }} />
                ) : (
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: 'var(--color-gray-400)' }}>任務描述</div>
                    <div className="text-sm" style={{ color: 'var(--color-gray-700)' }}>{descVal || '—'}</div>
                  </div>
                )}
                {editDesc ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveField('desc')} className="p-2 rounded-lg" style={{ background: 'var(--color-success)', border: 'none', cursor: 'pointer' }}><Check className="w-4 h-4 text-white" /></button>
                    <button onClick={() => { setDescVal(task.desc); setEditDesc(false); }} className="p-2 rounded-lg" style={{ background: 'var(--color-gray-200)', border: 'none', cursor: 'pointer' }}><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditDesc(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}><Edit2 className="w-3.5 h-3.5" />編輯</button>
                )}
              </div>

              {/* Status */}
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--color-gray-400)' }}>狀態</div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded text-xs font-medium" style={{ background: statusColor(taskStatus) + '18', color: statusColor(taskStatus) }}>{statusLabel(taskStatus)}</span>
                  <div className="flex gap-2 ml-2">
                    <button onClick={() => handleStatus('Running')} disabled={taskStatus === 'Running'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: taskStatus === 'Running' ? 'var(--color-gray-200)' : 'var(--color-success)', color: taskStatus === 'Running' ? 'var(--color-gray-400)' : 'white', border: 'none', cursor: taskStatus === 'Running' ? 'not-allowed' : 'pointer' }}><Play className="w-3 h-3" />啟動</button>
                    <button onClick={() => handleStatus('Running')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-warning)', color: 'white', border: 'none', cursor: 'pointer' }}><RotateCcw className="w-3 h-3" />重新啟動</button>
                    <button onClick={() => handleStatus('Stopped')} disabled={taskStatus === 'Stopped'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: taskStatus === 'Stopped' ? 'var(--color-gray-200)' : 'var(--color-danger)', color: taskStatus === 'Stopped' ? 'var(--color-gray-400)' : 'white', border: 'none', cursor: taskStatus === 'Stopped' ? 'not-allowed' : 'pointer' }}><Square className="w-3 h-3" />停止</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Model Info (read-only) */}
          <div className="card">
            <div className="card-body grid grid-cols-2 gap-4">
              {[
                { label: '模型名稱', val: task.jobType === 'Training' ? 'LLaMA 3' : 'Mistral' },
                { label: '模型標籤', val: modelTag },
                { label: '任務擁有者', val: project.manager },
                { label: '任務建立時間', val: task.startTime !== '-' ? `2026-07-07 ${task.startTime}` : '—' },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>{label}</div>
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)', border: '1px solid var(--color-gray-200)' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h4 style={{ color: 'var(--color-gray-900)' }}>資源配置</h4>
                <button onClick={() => setShowResModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}>變更分配</button>
              </div>
            </div>
            <div className="card-body grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>節點</div>
                <div className="font-mono" style={{ color: 'var(--color-gray-700)' }}>gpu-node-01</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>CPU</div>
                <div className="font-mono" style={{ color: 'var(--color-teal)' }}>{task.cpuThreads} 線程</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>RAM</div>
                <div className="font-mono" style={{ color: 'var(--color-warning)' }}>{task.ramGB} GB</div>
              </div>
              {task.gpuAllocs.length > 0 && (
                <div className="col-span-3">
                  <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>GPU</div>
                  <div className="flex flex-wrap gap-2">
                    {task.gpuAllocs.map(a => (
                      <span key={a.gpuId} className="px-2 py-1 rounded text-xs font-mono" style={{ background: 'rgba(0,82,204,0.08)', color: 'var(--color-primary-blue)' }}>{a.gpuId} ({a.memGiB} GiB)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="flex items-center justify-between"><h4 style={{ color: 'var(--color-gray-900)' }}>模型效能與進階配置</h4><button onClick={saveModelConfig} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}>儲存配置</button></div></div>
            <div className="card-body"><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><label><span className="mb-1 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>Temperature</span><b className="font-mono" style={{ color: 'var(--color-primary-blue)' }}>{modelTemperature.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" value={modelTemperature} onChange={e => setModelTemperature(Number(e.target.value))} className="w-full accent-[#0052cc]" /></label><label><span className="mb-1 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Max Tokens</span><input type="number" min="256" step="256" value={modelMaxTokens} onChange={e => setModelMaxTokens(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-gray-300)' }} /></label><label><span className="mb-1 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Context Window</span><select value={modelContextWindow} onChange={e => setModelContextWindow(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-gray-300)' }}>{['4K','8K','16K','32K','64K','128K'].map(option => <option key={option}>{option}</option>)}</select></label></div><div className="mt-4 flex flex-wrap gap-5 text-sm" style={{ color: 'var(--color-gray-700)' }}><label className="flex items-center gap-2"><input type="checkbox" checked={modelAutoScaling} onChange={e => setModelAutoScaling(e.target.checked)} />是否啟用自動擴展</label><label className="flex items-center gap-2"><input type="checkbox" checked={modelDetailedLogging} onChange={e => setModelDetailedLogging(e.target.checked)} />是否啟用詳細日誌</label></div></div>
          </div>

          {/* Delete */}
          <div className="card" style={{ borderColor: 'rgba(222,53,11,0.3)', border: '1px solid' }}>
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm" style={{ color: 'var(--color-danger)' }}>刪除模型</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>此操作無法復原，將永久移除該任務及其相關資料</div>
                </div>
                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-danger)', color: 'white', border: 'none', cursor: 'pointer' }}><Trash2 className="w-4 h-4" />刪除模型</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 日誌 Tab ── */}
      {activeTab === '日誌' && (
        <div style={{ height: 500 }}>
          <Terminal lines={logLines} readOnly />
        </div>
      )}

      {/* ── 描述 Tab ── */}
      {activeTab === '描述' && (
        <div style={{ height: 500 }}>
          <Terminal lines={descLines} readOnly />
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl shadow-2xl p-6 w-full max-w-sm" style={{ background: 'var(--color-bg-white)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(222,53,11,0.1)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
              </div>
              <div>
                <h4 style={{ color: 'var(--color-gray-900)' }}>確認刪除模型</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>此操作無法復原</p>
              </div>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--color-gray-700)' }}>確定要刪除模型「{nameVal}」嗎？所有相關資料將一併移除。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>取消</button>
              <button onClick={() => { setShowDeleteConfirm(false); onDelete(); }} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-danger)', color: 'white', border: 'none', cursor: 'pointer' }}>確認刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resource Change Modal ── */}
      {showResModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowResModal(false)}>
          <div className="rounded-xl shadow-2xl p-6 w-full max-w-md" style={{ background: 'var(--color-bg-white)' }} onClick={e => e.stopPropagation()}>
            <h4 className="mb-5" style={{ color: 'var(--color-gray-900)' }}>變更資源分配</h4>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>CPU（線程）</label>
                  <span className="text-sm font-mono" style={{ color: 'var(--color-teal)' }}>{resCpu}</span>
                </div>
                <input type="range" min="0.5" max={project.cpuThreads} step="0.5" value={resCpu} onChange={e => setResCpu(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-teal)' }} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>RAM（GB）</label>
                  <span className="text-sm font-mono" style={{ color: 'var(--color-warning)' }}>{resRam} GB</span>
                </div>
                <input type="range" min="1" max={project.ramGB} step="1" value={resRam} onChange={e => setResRam(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-warning)' }} />
              </div>

            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowResModal(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>取消</button>
              <button onClick={saveResources} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
