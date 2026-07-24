import { Cpu, Clock, AlertTriangle, Plus, Settings, X, ChevronDown, FolderOpen, ChevronRight, User, Calendar, Wrench } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { ProjectDetailPage } from './ProjectDetailPage';
import { TaskDetailPage } from './TaskDetailPage';

// ─── Types ───────────────────────────────────────────────────────────────────
interface GpuAlloc { gpuId: string; memGiB: number; }
interface Task {
  id: number; name: string; desc: string;
  status: 'Running' | 'Queued' | 'Stopped';
  jobType: string; gpuAllocs: GpuAlloc[];
  cpuThreads: number; ramGB: number; startTime: string;
  tpmLimit: number; rpmLimit: number;
  modelConfig?: { temperature: number; maxTokens: number; contextWindow: string; autoScaling: boolean; detailedLogging: boolean };
}
interface Project {
  id: number; name: string; status: 'Active' | 'Pending' | 'Stopped';
  cpuThreads: number; ramGB: number;
  gpuAllocs: GpuAlloc[];
  manager: string; createdAt: string; desc: string;
  tasks: Task[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const ALL_GPUS = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `H200-${i}`, label: `H200 GPU-${i}`, cluster: 'NVIDIA H200 叢集', maxVram: 141 })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `L40-${i}`, label: `L40 GPU-${i}`, cluster: 'NVIDIA L40 叢集', maxVram: 48 })),
];

const INIT_PROJECTS: Project[] = [
  {
    id: 1, name: 'Pilot Project 領航案', status: 'Active', cpuThreads: 32, ramGB: 256,
    gpuAllocs: [{ gpuId: 'H200-0', memGiB: 141 }, { gpuId: 'H200-1', memGiB: 141 }, { gpuId: 'H200-2', memGiB: 141 }, { gpuId: 'H200-3', memGiB: 141 }],
    manager: 'pilot-admin@company.com', createdAt: '2026-07-01 09:00', desc: '領航案 AI 訓練與推論整合專案',
    tasks: [{ id: 1, name: 'Gemma4:31b', desc: '大語言模型', status: 'Running', jobType: 'Training', gpuAllocs: [{ gpuId: 'H200-0', memGiB: 141 }, { gpuId: 'H200-1', memGiB: 141 }], cpuThreads: 16, ramGB: 128, startTime: '14:32', tpmLimit: 50000, rpmLimit: 1000 }],
  },
  {
    id: 2, name: '金融風控模型', status: 'Active', cpuThreads: 16, ramGB: 128,
    gpuAllocs: [{ gpuId: 'H200-4', memGiB: 141 }, { gpuId: 'H200-5', memGiB: 141 }],
    manager: 'fintech@company.com', createdAt: '2026-07-02 10:30', desc: '金融即時風控推論服務',
    tasks: [{ id: 2, name: 'Gemma4:31b', desc: '大語言模型', status: 'Running', jobType: 'Inference', gpuAllocs: [{ gpuId: 'H200-4', memGiB: 71 }], cpuThreads: 8, ramGB: 64, startTime: '13:15', tpmLimit: 100000, rpmLimit: 2000 }],
  },
  {
    id: 3, name: '文本分析系統', status: 'Pending', cpuThreads: 8, ramGB: 64,
    gpuAllocs: [{ gpuId: 'L40-0', memGiB: 48 }, { gpuId: 'L40-1', memGiB: 48 }, { gpuId: 'L40-2', memGiB: 48 }, { gpuId: 'L40-3', memGiB: 48 }],
    manager: 'nlp@company.com', createdAt: '2026-07-03 14:00', desc: 'NLP 文本分析與資料預處理',
    tasks: [],
  },
  {
    id: 4, name: '醫療影像辨識', status: 'Active', cpuThreads: 16, ramGB: 128,
    gpuAllocs: [{ gpuId: 'L40-0', memGiB: 48 }, { gpuId: 'L40-1', memGiB: 48 }, { gpuId: 'L40-2', memGiB: 48 }, { gpuId: 'L40-3', memGiB: 48 }],
    manager: 'vision@company.com', createdAt: '2026-07-04 11:00', desc: '醫療影像 AI 辨識系統',
    tasks: [{ id: 4, name: 'Gemma4:31b', desc: '大語言模型', status: 'Running', jobType: 'Training', gpuAllocs: [{ gpuId: 'L40-0', memGiB: 48 }, { gpuId: 'L40-1', memGiB: 48 }, { gpuId: 'L40-2', memGiB: 48 }, { gpuId: 'L40-3', memGiB: 48 }], cpuThreads: 16, ramGB: 128, startTime: '15:20', tpmLimit: 30000, rpmLimit: 500 }],
  },
];

const availableModels = [
  { name: 'LLaMA 3', category: 'LLM', versions: ['70B', '8B', '3B'], description: 'Meta 開源大型語言模型', recommendedGPU: 'H200 x4' },
  { name: 'GPT-4', category: 'LLM', versions: ['turbo', 'base'], description: 'OpenAI 多模態大型語言模型', recommendedGPU: 'H200 x8' },
  { name: 'Mistral', category: 'LLM', versions: ['7B-Instruct-v0.2', '7B-v0.1'], description: '高效能開源語言模型', recommendedGPU: 'L40 x2' },
  { name: 'BERT', category: 'NLP', versions: ['large-uncased', 'base-chinese', 'base-multilingual'], description: 'Google 預訓練語言表示模型', recommendedGPU: 'L40 x1' },
  { name: 'Stable Diffusion', category: 'Vision', versions: ['XL 1.0', 'v2.1', 'v1.5'], description: '文字到圖像生成模型', recommendedGPU: 'L40 x2' },
  { name: 'YOLOv8', category: 'Vision', versions: ['x', 'l', 'm', 's', 'n'], description: '即時物件偵測模型', recommendedGPU: 'L40 x1' },
  { name: 'Whisper', category: 'Audio', versions: ['large-v3', 'medium', 'small'], description: 'OpenAI 語音識別模型', recommendedGPU: 'L40 x1' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtNow = () => new Date().toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-');

function getProjectUsedResources(project: Project) {
  const cpuUsed = project.tasks.reduce((s, t) => s + t.cpuThreads, 0);
  const ramUsed = project.tasks.reduce((s, t) => s + t.ramGB, 0);
  const gpuUsed: Record<string, number> = {};
  for (const t of project.tasks) {
    for (const g of t.gpuAllocs) {
      gpuUsed[g.gpuId] = (gpuUsed[g.gpuId] ?? 0) + g.memGiB;
    }
  }
  return { cpuUsed, ramUsed, gpuUsed };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function GPUResourceDashboard({ tab }: { tab: 'cluster' | 'workload' }) {
  const activeTab = tab;

  // Cluster charts
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set(['h200', 'l40']));
  const generateTimeData = (totalGB: number, usedBase: number, reservedBase: number, utilBase: number, prefix: string, points = 35) => {
    const startH = 14, startM = 0;
    return Array.from({ length: points }, (_, i) => {
      const mins = startH * 60 + startM + i;
      const label = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
      const n = () => (Math.random() - 0.5) * 2;
      const used = Math.round(Math.min(usedBase + n(), totalGB - reservedBase - 2));
      const reserved = Math.round(reservedBase + n() * 0.3);
      const free = Math.max(0, totalGB - used - reserved);
      const util = Math.max(0, Math.min(100, utilBase + n() * 3));
      return { time: label, [`${prefix}_used`]: used, [`${prefix}_reserved`]: reserved, [`${prefix}_free`]: free, [`${prefix}_util`]: parseFloat(util.toFixed(1)) };
    });
  };
  const h200Data = useMemo(() => generateTimeData(141, 122, 8, 87, 'h200'), []);
  const a100Data = useMemo(() => generateTimeData(80, 50, 5, 4, 'a100'), []);

  // Projects
  const [projects, setProjects] = useState<Project[]>(INIT_PROJECTS);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set([1]));
  const toggleProjectExpand = (id: number) => setExpandedProjects(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  // ── Sub-page navigation (declared after `projects`) ──
  type NavView = 'main' | { type: 'project'; projectId: number } | { type: 'task'; projectId: number; taskId: number };
  const [navView, setNavView] = useState<NavView>('main');
  useEffect(() => { setNavView('main'); }, [tab]);

  const navProject = navView !== 'main' ? projects.find(p => p.id === navView.projectId) ?? null : null;
  const navTask = navView !== 'main' && navView.type === 'task' ? navProject?.tasks.find(t => t.id === navView.taskId) ?? null : null;

  const handleUpdateTask = (updated: Task) => {
    setProjects(prev => prev.map(p =>
      p.id === navProject?.id ? { ...p, tasks: p.tasks.map(t => t.id === updated.id ? updated : t) } : p
    ));
  };
  const handleDeleteTask = () => {
    if (navView !== 'main' && navView.type === 'task') {
      setProjects(prev => prev.map(p => p.id === navView.projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== navView.taskId) } : p));
      setNavView({ type: 'project', projectId: navView.projectId });
    }
  };

  // ── Project Modal ─────────────────────────────────────────────────────────
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projName, setProjName] = useState('');
  const [projCpu, setProjCpu] = useState(4);
  const [projRam, setProjRam] = useState(16);
  const [projGPUs, setProjGPUs] = useState<Record<string, number>>({});
  const [projManager, setProjManager] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const projGpuGroups = [
    { cluster: 'NVIDIA H200 叢集', gpus: ALL_GPUS.filter(g => g.cluster === 'NVIDIA H200 叢集') },
    { cluster: 'NVIDIA L40 叢集', gpus: ALL_GPUS.filter(g => g.cluster === 'NVIDIA L40 叢集') },
  ];

  const resetProjectForm = () => { setProjName(''); setProjCpu(4); setProjRam(16); setProjGPUs({}); setProjManager(''); setProjDesc(''); };

  const toggleProjGPU = (gpuId: string, maxVram: number) => {
    setProjGPUs(prev => {
      const next = { ...prev };
      if (next[gpuId] !== undefined) delete next[gpuId];
      else next[gpuId] = maxVram;
      return next;
    });
  };

  const submitProject = () => {
    if (!projName.trim()) return;
    const gpuAllocs: GpuAlloc[] = Object.entries(projGPUs).map(([gpuId, memGiB]) => ({ gpuId, memGiB }));
    const newProj: Project = {
      id: Date.now(), name: projName.trim(), status: 'Active',
      cpuThreads: projCpu, ramGB: projRam, gpuAllocs,
      manager: projManager || '—', createdAt: fmtNow(), desc: projDesc,
      tasks: [],
    };
    setProjects(prev => [...prev, newProj]);
    setExpandedProjects(prev => new Set([...prev, newProj.id]));
    setShowProjectModal(false);
    resetProjectForm();
  };

  // ── Task Modal ────────────────────────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [modelType, setModelType] = useState<'existing' | 'new-env'>('existing');
  const [modelSearch, setModelSearch] = useState('');
  const [modelTagSearch, setModelTagSearch] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [dockerTagInput, setDockerTagInput] = useState('');
  const [portMappings, setPortMappings] = useState<{ id: number; internal: string; external: string }[]>([{ id: 1, internal: '', external: '' }]);
  const [mountPaths, setMountPaths] = useState<{ id: number; path: string }[]>([{ id: 1, path: '' }]);
  const [diskSize, setDiskSize] = useState(0);
  const [taskCpu, setTaskCpu] = useState(0.5);
  const [taskRam, setTaskRam] = useState(1);
  const [tempStorage, setTempStorage] = useState(false);
  const [taskGPUs, setTaskGPUs] = useState<Record<string, number>>({});
  const [serviceTemperature, setServiceTemperature] = useState(0.7);
  const [serviceMaxTokens, setServiceMaxTokens] = useState(4096);
  const [serviceContextWindow, setServiceContextWindow] = useState('32K');
  const [serviceAutoScaling, setServiceAutoScaling] = useState(false);
  const [serviceDetailedLogging, setServiceDetailedLogging] = useState(true);

  const existingModelList = ['LLaMA 3-70B', 'LLaMA 3-8B', 'Mistral-7B-Instruct', 'BERT-large-uncased', 'Stable Diffusion XL', 'YOLOv8-x', 'Whisper-large-v3'];
  const existingTagList = ['v1.0', 'v1.1', 'v2.0', 'latest', 'stable', 'nightly'];

  const nextId = () => Date.now() + Math.random();
  const addPort = () => setPortMappings(p => [...p, { id: nextId(), internal: '', external: '' }]);
  const removePort = (id: number) => setPortMappings(p => p.length > 1 ? p.filter(x => x.id !== id) : p);
  const updatePort = (id: number, field: 'internal' | 'external', val: string) => setPortMappings(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));
  const addMount = () => setMountPaths(p => [...p, { id: nextId(), path: '' }]);
  const removeMount = (id: number) => setMountPaths(p => p.length > 1 ? p.filter(x => x.id !== id) : p);
  const updateMount = (id: number, val: string) => setMountPaths(p => p.map(x => x.id === id ? { ...x, path: val } : x));

  const resetTaskForm = () => {
    setTaskName(''); setTaskDesc(''); setModelType('existing');
    setModelSearch(''); setModelTagSearch(''); setDockerImage(''); setDockerTagInput('');
    setPortMappings([{ id: 1, internal: '', external: '' }]);
    setMountPaths([{ id: 1, path: '' }]);
    setDiskSize(0); setTaskCpu(0.5); setTaskRam(1); setTempStorage(false); setTaskGPUs({}); setServiceTemperature(0.7); setServiceMaxTokens(4096); setServiceContextWindow('32K'); setServiceAutoScaling(false); setServiceDetailedLogging(true);
  };

  const openTaskModal = (projectId: number) => {
    setActiveProjectId(projectId);
    resetTaskForm();
    setShowTaskModal(true);
  };

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const activeProjectResources = activeProject ? getProjectUsedResources(activeProject) : null;

  const maxTaskCpu = activeProject ? Math.max(0.5, activeProject.cpuThreads - (activeProjectResources?.cpuUsed ?? 0)) : 64;
  const maxTaskRam = activeProject ? Math.max(1, activeProject.ramGB - (activeProjectResources?.ramUsed ?? 0)) : 512;

  const totalTaskGpuMem = Object.values(taskGPUs).reduce((s, v) => s + v, 0);

  const getGpuAvailMem = (gpuId: string): number => {
    if (!activeProject) return ALL_GPUS.find(g => g.id === gpuId)?.maxVram ?? 0;
    const projAlloc = activeProject.gpuAllocs.find(a => a.gpuId === gpuId);
    if (!projAlloc) return 0;
    const used = activeProjectResources?.gpuUsed[gpuId] ?? 0;
    return Math.max(0, projAlloc.memGiB - used);
  };

  const isGpuDisabled = (gpuId: string): boolean => {
    if (!activeProject) return false;
    const inProject = activeProject.gpuAllocs.some(a => a.gpuId === gpuId);
    if (!inProject) return true;
    const avail = getGpuAvailMem(gpuId);
    if (avail <= 0) return true;
    if (taskGPUs[gpuId] !== undefined) return false;
    return totalTaskGpuMem >= maxTaskRam;
  };

  const toggleTaskGPU = (gpuId: string) => {
    if (isGpuDisabled(gpuId) && taskGPUs[gpuId] === undefined) return;
    setTaskGPUs(prev => {
      const next = { ...prev };
      if (next[gpuId] !== undefined) delete next[gpuId];
      else { const avail = getGpuAvailMem(gpuId); next[gpuId] = Math.min(avail, Math.max(1, avail)); }
      return next;
    });
  };

  const submitTask = () => {
    if (!taskName.trim() || !activeProjectId) return;
    const gpuAllocs: GpuAlloc[] = Object.entries(taskGPUs).map(([gpuId, memGiB]) => ({ gpuId, memGiB }));
    const newTask: Task = {
      id: Date.now(), name: taskName.trim(), desc: taskDesc,
      status: 'Queued', jobType: modelType === 'existing' ? 'Inference' : 'Training',
      gpuAllocs, cpuThreads: taskCpu, ramGB: taskRam, startTime: '-',
      tpmLimit: 10000, rpmLimit: 200,
      modelConfig: { temperature: serviceTemperature, maxTokens: serviceMaxTokens, contextWindow: serviceContextWindow, autoScaling: serviceAutoScaling, detailedLogging: serviceDetailedLogging },
    };
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, tasks: [...p.tasks, newTask] } : p));
    setShowTaskModal(false);
  };

  // ── Model Selector Modal (unchanged) ─────────────────────────────────────
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ name: string; jobType: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedJobType, setSelectedJobType] = useState('Training');
  const [modelSavePath, setModelSavePath] = useState('/models/output/');
  const [selectedGPUType, setSelectedGPUType] = useState<'H200' | 'L40'>('H200');
  const [maxGPU, setMaxGPU] = useState(4);
  const [maxCPU, setMaxCPU] = useState(16);
  const [maxMemory, setMaxMemory] = useState(128);

  const getPriorityColor = (p: string) => p === 'High' ? 'var(--color-danger)' : 'var(--color-gray-400)';

  const statusBadge = (s: string) => {
    if (s === 'Active' || s === 'Running') return 'badge-success';
    if (s === 'Pending' || s === 'Queued') return 'badge-warning';
    return 'badge-danger';
  };
  const statusLabel = (s: string) => ({ Active: '運行中', Pending: '待命', Stopped: '已停止', Running: '運行中', Queued: '等待中' }[s] ?? s);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">


      {/* ══ Tab 1: Cluster Overview ══ */}
      {activeTab === 'cluster' && navView === 'main' && (
        <div className="space-y-5">
          {[
            { id: 'h200', name: 'NVIDIA H200 叢集', count: 8, vram: 141, tone: '#0052CC', note: '大規模訓練 · 標準模式 / MIG 已停用' },
            { id: 'l40', name: 'NVIDIA L40 叢集', count: 4, vram: 48, tone: '#00A3BF', note: '視覺推論 · 圖形與生成式工作負載' },
          ].map(cluster => {
            const isOpen = expandedClusters.has(cluster.id);
            return (
              <section key={cluster.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedClusters(prev => { const next = new Set(prev); next.has(cluster.id) ? next.delete(cluster.id) : next.add(cluster.id); return next; })}
                  className="card-header flex w-full items-center justify-between text-left"
                  style={{ background: cluster.id === 'h200' ? 'rgba(222,53,11,0.045)' : 'rgba(0,184,217,0.045)', cursor: 'pointer' }}
                >
                  <span className="flex items-center gap-3">
                    <ChevronRight className="h-4 w-4 transition-transform" style={{ color: cluster.tone, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: cluster.tone }}><Cpu className="h-4 w-4 text-white" /></span>
                    <span>
                      <span className="block font-medium" style={{ color: 'var(--color-gray-900)' }}>{cluster.name}</span>
                      <span className="mt-0.5 block text-xs" style={{ color: 'var(--color-gray-400)' }}>{cluster.note} · {cluster.count} GPUs · {cluster.vram} GiB / GPU</span>
                    </span>
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: `${cluster.tone}14`, color: cluster.tone }}>{cluster.count} 張監測中</span>
                </button>
                {isOpen && (
                  <div className="card-body">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-gray-800)' }}>GPU 記憶體使用量</div>
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>每張卡獨立監控；左側為記憶體、右側為核心利用率</div>
                      </div>
                      <div className="font-mono text-xs" style={{ color: cluster.tone }}>即時更新 · 30 秒視窗</div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {Array.from({ length: cluster.count }, (_, index) => {
                        const key = `${cluster.id}-${index}`;
                        const series = generateTimeData(cluster.vram, Math.round(cluster.vram * (0.42 + ((index * 11) % 35) / 100)), Math.max(2, Math.round(cluster.vram * 0.08)), 48 + ((index * 9) % 40), key, 18);
                        const usedKey = `${key}_used`;
                        const reservedKey = `${key}_reserved`;
                        const utilKey = `${key}_util`;
                        const chartX = (pointIndex: number) => 8 + (pointIndex / (series.length - 1)) * 244;
                        const memoryY = (value: number) => 94 - (value / cluster.vram) * 82;
                        const utilY = (value: number) => 94 - (value / 100) * 82;
                        const memoryLine = series.map((point, pointIndex) => `${chartX(pointIndex)},${memoryY(Number(point[usedKey]))}`).join(' ');
                        const memoryArea = `8,94 ${memoryLine} 252,94`;
                        const reserveLine = series.map((point, pointIndex) => `${chartX(pointIndex)},${memoryY(Number(point[usedKey]) + Number(point[reservedKey]))}`).join(' ');
                        const utilLine = series.map((point, pointIndex) => `${chartX(pointIndex)},${utilY(Number(point[utilKey]))}`).join(' ');
                        const currentUsed = Number(series[series.length - 1][usedKey]);
                        const currentUtil = Number(series[series.length - 1][utilKey]);
                        return (
                          <div key={key} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-gray-50)' }}>
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-mono text-xs font-medium" style={{ color: 'var(--color-gray-700)' }}>{cluster.name.replace('NVIDIA ', '').replace(' 叢集', '')} GPU-{String(index + 1).padStart(2, '0')}</span>
                              <span className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>{cluster.vram} GiB VRAM</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--color-gray-500)' }}><span>使用量（GPU 記憶體使用量）</span><span className="font-mono" style={{ color: '#de350b' }}>{currentUsed} GiB</span></div>
                                <svg viewBox="0 0 260 110" className="h-36 w-full" role="img" aria-label={`GPU-${index + 1} 記憶體使用量趨勢`}>
                                  {[12, 53, 94].map(y => <line key={`${key}-memory-grid-${y}`} x1="8" y1={y} x2="252" y2={y} stroke="#e5edf4" strokeDasharray="3 3" />)}
                                  <polygon points={memoryArea} fill="#de350b" fillOpacity="0.6" />
                                  <polyline points={reserveLine} fill="none" stroke="#36b37e" strokeWidth="1.5" />
                                  <polyline points={memoryLine} fill="none" stroke="#de350b" strokeWidth="1.5" />
                                  <text x="8" y="108" fontSize="8" fill="#8a98a9">14:00</text><text x="119" y="108" fontSize="8" fill="#8a98a9">14:15</text><text x="225" y="108" fontSize="8" fill="#8a98a9">14:30</text>
                                </svg>
                                <div className="mt-1 flex gap-3 text-[10px]" style={{ color: 'var(--color-gray-500)' }}><span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: '#de350b' }} />used</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: '#36b37e' }} />reserved</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: '#79e2f2' }} />free</span></div>
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--color-gray-500)' }}><span>利用率（GPU 利用率）</span><span className="font-mono" style={{ color: '#ff8b00' }}>{currentUtil}%</span></div>
                                <svg viewBox="0 0 260 110" className="h-36 w-full" role="img" aria-label={`GPU-${index + 1} 利用率趨勢`}>
                                  {[12, 53, 94].map(y => <line key={`${key}-util-grid-${y}`} x1="8" y1={y} x2="252" y2={y} stroke="#e5edf4" strokeDasharray="3 3" />)}
                                  <polyline points={utilLine} fill="none" stroke="#ff8b00" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                                  <text x="8" y="108" fontSize="8" fill="#8a98a9">14:00</text><text x="119" y="108" fontSize="8" fill="#8a98a9">14:15</text><text x="225" y="108" fontSize="8" fill="#8a98a9">14:30</text>
                                </svg>
                                <div className="mt-1 text-[10px]" style={{ color: '#ff8b00' }}><i className="mr-1 inline-block h-px w-3 align-middle" style={{ background: '#ff8b00' }} />gpu</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {/* ── Project Isolation / Kubernetes Namespaces ── */}
          <section className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h4 style={{ color: 'var(--color-gray-900)' }}>專案隔離（Kubernetes Namespaces）</h4>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>各專案於獨立 Namespace 執行，配額與工作負載分開管理</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--color-teal)', background: 'rgba(0,184,217,0.10)' }}>4 個 Namespace</span>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {[
                  { name: 'pilot-project-ns', project: 'Pilot Project 領航案', pods: '8', cpu: '32 cores', memory: '564 GB VRAM', gpus: 'H200 ×4', quota: '4 GPUs', used: '4 GPUs', status: '運行中' },
                  { name: 'fintech-ml-ns', project: '金融風控模型', pods: '2', cpu: '8 cores', memory: '141 GB VRAM', gpus: 'H200 ×2', quota: '2 GPUs', used: '1 GPU', status: '運行中' },
                  { name: 'text-analysis-ns', project: '文本分析系統', pods: '0', cpu: '0 cores', memory: '0 GB', gpus: 'L40 ×4', quota: '4 GPUs', used: '0 GPUs', status: '待命' },
                  { name: 'vision-prod-ns', project: '醫療影像辨識', pods: '4', cpu: '16 cores', memory: '192 GB VRAM', gpus: 'L40 ×4', quota: '4 GPUs', used: '4 GPUs', status: '運行中' },
                ].map(namespace => {
                  const isRunning = namespace.status === '運行中';
                  return <div key={namespace.name} className="rounded-lg border-2 p-4" style={{ borderColor: isRunning ? 'var(--color-teal)' : 'var(--color-gray-300)', background: isRunning ? 'rgba(0,184,217,0.018)' : 'var(--color-gray-50)' }}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div><div className="font-mono text-sm" style={{ color: 'var(--color-primary-blue)' }}>{namespace.name}</div><div className="mt-1 text-xs" style={{ color: 'var(--color-gray-700)' }}>{namespace.project}</div><div className="mt-0.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>Python 3.11 + CUDA 12.3 環境</div></div>
                      <span className={`badge ${isRunning ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>{namespace.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
                      {[['Pods', namespace.pods], ['CPU', namespace.cpu], ['Memory', namespace.memory], ['GPUs', namespace.gpus]].map(([label, value]) => <div key={label}><div style={{ color: 'var(--color-gray-400)' }}>{label}</div><div className="mt-0.5 font-mono" style={{ color: label === 'GPUs' ? 'var(--color-teal)' : 'var(--color-gray-700)', fontWeight: label === 'GPUs' ? 600 : 400 }}>{value}</div></div>)}
                    </div>
                    <div className="mt-4 text-xs" style={{ color: 'var(--color-gray-400)' }}>配額：{namespace.quota}｜已使用：{namespace.used}</div>
                  </div>;
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══ Tab 2: Workload ══ */}
      {activeTab === 'workload' && navView === 'main' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ color: 'var(--color-gray-900)' }}>算力排程與工作負載</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>先建立專案，再於專案維護頁面新增任務</p>
            </div>
            <button
              onClick={() => { resetProjectForm(); setShowProjectModal(true); }}
              className="px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-all hover:shadow-sm"
              style={{ background: 'var(--color-teal)', color: 'white', border: 'none' }}
            >
              <Plus className="w-4 h-4" />
              新建專案
            </button>
          </div>

          {projects.map(project => {
            const res = getProjectUsedResources(project);
            const isExpanded = expandedProjects.has(project.id);
            return (
              <div key={project.id} className="card">
                <div
                  className="card-header cursor-pointer select-none"
                  onClick={() => toggleProjectExpand(project.id)}
                  style={{ background: isExpanded ? 'rgba(0,82,204,0.03)' : undefined }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className="w-4 h-4 transition-transform" style={{ color: 'var(--color-gray-400)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: 'var(--color-gray-900)' }}>{project.name}</span>
                          <span className={`badge ${statusBadge(project.status)}`} style={{ fontSize: '10px' }}>{statusLabel(project.status)}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>CPU: {res.cpuUsed}/{project.cpuThreads} 線程</span>
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>RAM: {res.ramUsed}/{project.ramGB} GB</span>
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>GPU: {project.gpuAllocs.length} 張</span>
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-gray-400)' }}><User className="w-3 h-3" />{project.manager}</span>
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-gray-400)' }}><Calendar className="w-3 h-3" />{project.createdAt}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>{project.tasks.length} 個任務</span>
                      <button
                        onClick={() => setNavView({ type: 'project', projectId: project.id })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:shadow-sm"
                        style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        維護
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="card-body">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'CPU 使用率', used: res.cpuUsed, total: project.cpuThreads, unit: '線程', color: 'var(--color-teal)' },
                        { label: 'RAM 使用率', used: res.ramUsed, total: project.ramGB, unit: 'GB', color: 'var(--color-warning)' },
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
                    <p className="text-xs mt-3" style={{ color: 'var(--color-gray-400)' }}>點擊「維護」按鈕進入專案詳細頁面管理任務</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Project Detail Sub-page ══ */}
      {activeTab === 'workload' && navView !== 'main' && navView.type === 'project' && navProject && (
        <ProjectDetailPage
          project={navProject}
          onBack={() => setNavView('main')}
          onTaskMaintain={(taskId) => setNavView({ type: 'task', projectId: navProject.id, taskId })}
          onAddTask={() => openTaskModal(navProject.id)}
          onUpdateProject={(updated) => setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onUpdateTask={handleUpdateTask}
        />
      )}

      {/* ══ Task Detail Sub-page ══ */}
      {activeTab === 'workload' && navView !== 'main' && navView.type === 'task' && navProject && navTask && (
        <TaskDetailPage
          task={navTask}
          project={navProject}
          onBack={() => setNavView({ type: 'project', projectId: navProject.id })}
          onDelete={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
        />
      )}

      {/* ══ Project Modal ══ */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(100,116,139,0.45)' }} onClick={() => setShowProjectModal(false)}>
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: 'var(--color-bg-white)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-teal)' }}><Plus className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 style={{ color: 'var(--color-gray-900)' }}>新建專案</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>設定專案資源配額，任務配置不得超過此上限</p>
                </div>
              </div>
              <button onClick={() => setShowProjectModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} /></button>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Name + Manager */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>專案名稱</label>
                  <input type="text" value={projName} onChange={e => setProjName(e.target.value)} placeholder="例如：nlp-research-project" className="w-full px-4 py-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>專案管理員</label>
                  <input type="text" value={projManager} onChange={e => setProjManager(e.target.value)} placeholder="例如：admin@company.com" className="w-full px-4 py-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                </div>
              </div>

              {/* Status + Created (auto) */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>狀態</label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: 'rgba(54,179,126,0.06)', border: '1px solid var(--color-success)' }}>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>Active</span>
                    <span className="text-sm" style={{ color: 'var(--color-gray-500)' }}>系統自動設定</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>建立時間</label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
                    <Calendar className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
                    <span className="text-sm font-mono" style={{ color: 'var(--color-gray-500)' }}>系統自動抓取</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>專案描述</label>
                <textarea value={projDesc} onChange={e => setProjDesc(e.target.value)} placeholder="請簡述專案目的與用途..." rows={2} className="w-full px-4 py-3 rounded-lg border text-sm resize-none" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
              </div>

              {/* Node / CPU / RAM */}
              <div className="p-5 rounded-lg space-y-5" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-gray-800)' }}>節點資源配額</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>CPU（線程）</label>
                      <span className="text-sm font-mono" style={{ color: 'var(--color-teal)' }}>{projCpu} 線程</span>
                    </div>
                    <input type="range" min="0.5" max="128" step="0.5" value={projCpu} onChange={e => setProjCpu(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-teal)' }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}><span>0.5</span><span>128</span></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>RAM（GB）</label>
                      <span className="text-sm font-mono" style={{ color: 'var(--color-warning)' }}>{projRam} GB</span>
                    </div>
                    <input type="range" min="1" max="1024" step="1" value={projRam} onChange={e => setProjRam(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-warning)' }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}><span>1 GB</span><span>1024 GB</span></div>
                  </div>
                </div>
              </div>

              {/* GPU */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--color-gray-700)' }}>GPU 配置</label>
                <div className="space-y-4">
                  {projGpuGroups.map(group => (
                    <div key={group.cluster} className="rounded-lg border" style={{ borderColor: 'var(--color-gray-200)' }}>
                      <div className="px-4 py-2.5 text-xs font-semibold" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-600)', borderBottom: '1px solid var(--color-gray-200)', borderRadius: '8px 8px 0 0' }}>{group.cluster}</div>
                      <div className="p-4 grid grid-cols-4 gap-4">
                        {group.gpus.map(gpu => {
                          const checked = projGPUs[gpu.id] !== undefined;
                          return (
                            <div key={gpu.id} className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={checked} onChange={() => toggleProjGPU(gpu.id, gpu.maxVram)} style={{ accentColor: 'var(--color-primary-blue)', width: 14, height: 14 }} />
                                <span className="text-xs font-mono" style={{ color: 'var(--color-gray-700)' }}>{gpu.label}</span>
                              </label>
                              {checked && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs" style={{ color: 'var(--color-primary-blue)' }}>
                                    <span>記憶體</span><span className="font-mono">{projGPUs[gpu.id]} GiB</span>
                                  </div>
                                  <input type="range" min="1" max={gpu.maxVram} step="1" value={projGPUs[gpu.id]} onChange={e => setProjGPUs(prev => ({ ...prev, [gpu.id]: Number(e.target.value) }))} className="w-full" style={{ accentColor: 'var(--color-primary-blue)' }} />
                                  <div className="flex justify-between text-xs" style={{ color: 'var(--color-gray-400)' }}><span>1</span><span>{gpu.maxVram}</span></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 px-8 py-4 border-t flex items-center justify-end gap-3" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <button onClick={() => setShowProjectModal(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none' }}>取消</button>
              <button onClick={submitProject} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: projName.trim() ? 'var(--color-teal)' : 'var(--color-gray-300)', color: 'white', border: 'none', opacity: projName.trim() ? 1 : 0.6, cursor: projName.trim() ? 'pointer' : 'not-allowed' }}>建立專案</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Task Modal ══ */}
      {showTaskModal && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(100,116,139,0.45)' }} onClick={() => setShowTaskModal(false)}>
          <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: 'var(--color-bg-white)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary-blue)' }}><Plus className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 style={{ color: 'var(--color-gray-900)' }}>建立模型服務</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-primary-blue)', fontWeight: 500 }}>專案：{activeProject.name}</p>
                </div>
              </div>
              {/* Resource quota summary */}
              <div className="flex items-center gap-4 text-xs mr-8" style={{ color: 'var(--color-gray-400)' }}>
                <span>CPU 剩餘 <b style={{ color: 'var(--color-teal)' }}>{maxTaskCpu}</b> 線程</span>
                <span>RAM 剩餘 <b style={{ color: 'var(--color-warning)' }}>{maxTaskRam}</b> GB</span>
              </div>
              <button onClick={() => setShowTaskModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} /></button>
            </div>

            <div className="px-8 py-6 space-y-7">
              {/* Name + Desc */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>模型服務名稱 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input type="text" value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="例如：llm-training-task-001" className="w-full px-4 py-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-700)' }}>模型服務描述 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input type="text" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="請簡述此任務的目的..." className="w-full px-4 py-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--color-gray-700)' }}>模型 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <div className="flex gap-4 mb-4">
                  {(['existing', 'new-env'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="radio" name="modelType" checked={modelType === opt} onChange={() => setModelType(opt)} style={{ accentColor: 'var(--color-primary-blue)' }} />
                      <span className="text-sm" style={{ color: 'var(--color-gray-700)' }}>{opt === 'existing' ? '現有模型' : '新環境'}</span>
                    </label>
                  ))}
                </div>
                {modelType === 'existing' ? (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-gray-400)' }}>搜尋模型名稱</label>
                      <input type="text" value={modelSearch} onChange={e => setModelSearch(e.target.value)} placeholder="例如：LLaMA 3" list="model-list-t" className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                      <datalist id="model-list-t">{existingModelList.map(m => <option key={m} value={m} />)}</datalist>
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-gray-400)' }}>搜尋模型標籤（版本）</label>
                      <input type="text" value={modelTagSearch} onChange={e => setModelTagSearch(e.target.value)} placeholder="例如：v2.0" list="tag-list-t" className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                      <datalist id="tag-list-t">{existingTagList.map(t => <option key={t} value={t} />)}</datalist>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-gray-400)' }}>輸入 Docker 映像</label>
                      <input type="text" value={dockerImage} onChange={e => setDockerImage(e.target.value)} placeholder="e.g. tensorflow/tensorflow" className="w-full px-3 py-2.5 rounded-lg border text-sm font-mono" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-gray-400)' }}>輸入 Docker 標籤</label>
                      <input type="text" value={dockerTagInput} onChange={e => setDockerTagInput(e.target.value)} placeholder="e.g. nightly-jupyter" className="w-full px-3 py-2.5 rounded-lg border text-sm font-mono" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Ports */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>連接埠配置</label>
                  <button onClick={addPort} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none' }}><Plus className="w-3 h-3" />新增</button>
                </div>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)' }}>
                  <div className="grid grid-cols-[1fr_1fr_40px] px-4 py-2 text-xs font-medium" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)', borderBottom: '1px solid var(--color-gray-200)' }}><span>內部連接埠</span><span>外部連接埠</span><span /></div>
                  {portMappings.map((pm, idx) => (
                    <div key={pm.id} className="grid grid-cols-[1fr_1fr_40px] px-4 py-2.5 items-center" style={{ borderBottom: idx < portMappings.length - 1 ? '1px solid var(--color-gray-100)' : undefined }}>
                      <div className="pr-3"><input type="text" value={pm.internal} onChange={e => updatePort(pm.id, 'internal', e.target.value)} placeholder="e.g. 8888" className="w-full px-3 py-2 rounded border text-sm font-mono" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} /></div>
                      <div className="pr-3"><input type="text" value={pm.external} onChange={e => updatePort(pm.id, 'external', e.target.value)} placeholder="e.g. 30888" className="w-full px-3 py-2 rounded border text-sm font-mono" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} /></div>
                      <button onClick={() => removePort(pm.id)} disabled={portMappings.length === 1} className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ color: portMappings.length === 1 ? 'var(--color-gray-300)' : 'var(--color-danger)', cursor: portMappings.length === 1 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none' }}><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mounts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>掛載磁碟區</label>
                  <button onClick={addMount} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none' }}><Plus className="w-3 h-3" />新增</button>
                </div>
                <div className="space-y-2">
                  {mountPaths.map(mp => (
                    <div key={mp.id} className="flex items-center gap-2">
                      <input type="text" value={mp.path} onChange={e => updateMount(mp.id, e.target.value)} placeholder="e.g. /workspace/data" className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-mono" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                      <button onClick={() => removeMount(mp.id)} disabled={mountPaths.length === 1} className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ color: mountPaths.length === 1 ? 'var(--color-gray-300)' : 'var(--color-danger)', cursor: mountPaths.length === 1 ? 'not-allowed' : 'pointer', background: mountPaths.length === 1 ? 'var(--color-gray-50)' : 'rgba(222,53,11,0.06)', border: '1px solid', borderColor: mountPaths.length === 1 ? 'var(--color-gray-200)' : 'rgba(222,53,11,0.2)' }}><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs px-1" style={{ color: 'var(--color-warning)' }}>⚠ 提醒您，容器內資料將會被覆蓋，請確認您掛載的目標路徑是正確且安全的</p>
              </div>

              {/* Disk */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>磁碟大小</label>
                  <span className="text-sm font-mono" style={{ color: diskSize > 0 ? 'var(--color-primary-blue)' : 'var(--color-gray-400)' }}>{diskSize > 0 ? `${diskSize} GB` : '未設定'}</span>
                </div>
                <input type="range" min="0" max="500" step="1" value={diskSize} onChange={e => setDiskSize(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-primary-blue)' }} />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}><span>0 (未設定)</span><span>500 GB</span></div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--color-gray-400)' }}>非必填。若掛載磁碟區，則至少設定 1 GB。</p>
              </div>

              {/* Node */}
              <div className="border-t pt-6" style={{ borderColor: 'var(--color-gray-200)' }}>
                <h4 className="text-sm font-semibold mb-5" style={{ color: 'var(--color-gray-900)' }}>節點配置 <span style={{ color: 'var(--color-danger)' }}>*</span></h4>
                <div className="space-y-6">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>CPU <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <span className="text-sm font-mono" style={{ color: 'var(--color-teal)' }}>{taskCpu} 線程</span>
                    </div>
                    <input type="range" min="0.5" max={maxTaskCpu} step="0.5" value={taskCpu} onChange={e => setTaskCpu(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-teal)' }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}><span>0.5</span><span>{maxTaskCpu} (專案上限)</span></div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>至少 0.5 線程，且須為 0.5 的倍數</p>
                  </div>
                  {/* RAM */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>RAM <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <span className="text-sm font-mono" style={{ color: 'var(--color-warning)' }}>{taskRam} GB</span>
                    </div>
                    <input type="range" min="1" max={maxTaskRam} step="1" value={taskRam} onChange={e => setTaskRam(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-warning)' }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}><span>1 GB</span><span>{maxTaskRam} GB (專案上限)</span></div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>至少 1 GB</p>
                  </div>
                  {/* Temp Storage */}
                  <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>臨時儲存空間 <span style={{ color: 'var(--color-danger)' }}>*</span></div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>容器重啟後資料將清除</div>
                    </div>
                    <button onClick={() => setTempStorage(v => !v)} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{ background: tempStorage ? 'var(--color-teal)' : 'var(--color-gray-300)', border: 'none', cursor: 'pointer' }}>
                      <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: tempStorage ? 'translateX(22px)' : 'translateX(4px)' }} />
                    </button>
                  </div>
                  {/* GPU */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium" style={{ color: 'var(--color-gray-700)' }}>GPU</label>
                      {totalTaskGpuMem >= maxTaskRam && (
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(222,53,11,0.08)', color: 'var(--color-danger)' }}>RAM 配額已達上限，無法繼續選取 GPU</span>
                      )}
                    </div>
                    <div className="space-y-4">
                      {[
                        { cluster: 'NVIDIA H200 叢集', gpus: activeProject.gpuAllocs.filter(a => a.gpuId.startsWith('H200')) },
                        { cluster: 'NVIDIA L40 叢集', gpus: activeProject.gpuAllocs.filter(a => a.gpuId.startsWith('L40')) },
                      ].filter(g => g.gpus.length > 0).map(group => (
                        <div key={group.cluster} className="rounded-lg border" style={{ borderColor: 'var(--color-gray-200)' }}>
                          <div className="px-4 py-2.5 text-xs font-semibold" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-600)', borderBottom: '1px solid var(--color-gray-200)', borderRadius: '8px 8px 0 0' }}>{group.cluster}</div>
                          <div className="p-4 grid grid-cols-4 gap-4">
                            {group.gpus.map(alloc => {
                              const gpu = ALL_GPUS.find(g => g.id === alloc.gpuId)!;
                              const avail = getGpuAvailMem(alloc.gpuId);
                              const checked = taskGPUs[alloc.gpuId] !== undefined;
                              const disabled = isGpuDisabled(alloc.gpuId);
                              return (
                                <div key={alloc.gpuId} className="space-y-2">
                                  <label className="flex items-center gap-2" style={{ cursor: disabled && !checked ? 'not-allowed' : 'pointer', opacity: disabled && !checked ? 0.45 : 1 }}>
                                    <input type="checkbox" checked={checked} disabled={disabled && !checked} onChange={() => toggleTaskGPU(alloc.gpuId)} style={{ accentColor: 'var(--color-primary-blue)', width: 14, height: 14 }} />
                                    <div>
                                      <div className="text-xs font-mono" style={{ color: 'var(--color-gray-700)' }}>{gpu.label}</div>
                                      <div className="text-xs" style={{ color: avail <= 0 ? 'var(--color-danger)' : 'var(--color-gray-400)' }}>{avail <= 0 ? '已滿載' : `可用 ${avail} GiB`}</div>
                                    </div>
                                  </label>
                                  {checked && (
                                    <div className="space-y-1 pl-1">
                                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-primary-blue)' }}>
                                        <span>記憶體</span><span className="font-mono">{taskGPUs[alloc.gpuId]} GiB</span>
                                      </div>
                                      <input type="range" min="1" max={avail} step="1" value={taskGPUs[alloc.gpuId]} onChange={e => setTaskGPUs(prev => ({ ...prev, [alloc.gpuId]: Number(e.target.value) }))} className="w-full" style={{ accentColor: 'var(--color-primary-blue)' }} />
                                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-gray-400)' }}><span>1</span><span>{avail}</span></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {activeProject.gpuAllocs.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--color-gray-400)' }}>此專案未配置 GPU</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-5" style={{ borderColor: 'rgba(0,82,204,0.16)', background: 'rgba(0,82,204,0.025)' }}>
              <div className="mb-4"><h4 style={{ color: 'var(--color-gray-800)' }}>模型效能與進階配置</h4><p className="mt-1 text-xs" style={{ color: 'var(--color-gray-400)' }}>建立模型服務時由管理者設定推論行為與擴展策略。</p></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><label><span className="mb-1 flex justify-between text-xs" style={{ color: 'var(--color-gray-500)' }}><span>Temperature</span><b className="font-mono" style={{ color: 'var(--color-primary-blue)' }}>{serviceTemperature.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" value={serviceTemperature} onChange={e => setServiceTemperature(Number(e.target.value))} className="w-full accent-[#0052cc]" /></label><label><span className="mb-1 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Max Tokens</span><input type="number" min="256" step="256" value={serviceMaxTokens} onChange={e => setServiceMaxTokens(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-gray-300)' }} /></label><label><span className="mb-1 block text-xs" style={{ color: 'var(--color-gray-500)' }}>Context Window</span><select value={serviceContextWindow} onChange={e => setServiceContextWindow(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-gray-300)' }}>{['4K','8K','16K','32K','64K','128K'].map(option => <option key={option}>{option}</option>)}</select></label></div>
              <div className="mt-4 flex flex-wrap gap-5 text-sm" style={{ color: 'var(--color-gray-700)' }}><label className="flex items-center gap-2"><input type="checkbox" checked={serviceAutoScaling} onChange={e => setServiceAutoScaling(e.target.checked)} />是否啟用自動擴展</label><label className="flex items-center gap-2"><input type="checkbox" checked={serviceDetailedLogging} onChange={e => setServiceDetailedLogging(e.target.checked)} />是否啟用詳細日誌</label></div>
            </div>

            <div className="sticky bottom-0 px-8 py-4 border-t flex items-center justify-end gap-3" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <button onClick={() => setShowTaskModal(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none' }}>取消</button>
              <button onClick={submitTask} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: taskName.trim() ? 'var(--color-primary-blue)' : 'var(--color-gray-300)', color: 'white', border: 'none', opacity: taskName.trim() ? 1 : 0.6, cursor: taskName.trim() ? 'pointer' : 'not-allowed' }}>建立模型服務</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Model Selector Modal ══ */}
      {showModelSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(100, 116, 139, 0.4)' }} onClick={() => setShowModelSelector(false)}>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: 'var(--color-bg-white)' }} onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 p-6 border-b flex items-center justify-between" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6" style={{ color: 'var(--color-primary-blue)' }} />
                <div>
                  <h3 style={{ color: 'var(--color-gray-900)' }}>配置模型與資源</h3>
                  {selectedProject && <p className="text-sm mt-1" style={{ color: 'var(--color-primary-blue)', fontWeight: 500 }}>任務：{selectedProject.name}</p>}
                </div>
              </div>
              <button onClick={() => setShowModelSelector(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-900)' }}>作業類型</h4>
                <select value={selectedJobType} onChange={e => setSelectedJobType(e.target.value)} className="w-full px-4 py-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }}>
                  <option value="Training">Training - 模型訓練</option>
                  <option value="Inference">Inference - 模型推論</option>
                  <option value="Fine-tuning">Fine-tuning - 模型微調</option>
                  <option value="Pre-processing">Pre-processing - 資料預處理</option>
                </select>
              </div>
              {selectedJobType === 'Training' && (
                <div className="p-4 rounded-lg" style={{ background: 'rgba(0,184,217,0.05)', border: '1px solid var(--color-teal)' }}>
                  <div className="flex items-center gap-2 mb-3"><FolderOpen className="w-5 h-5" style={{ color: 'var(--color-teal)' }} /><h4 className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>訓練模型存放位址</h4></div>
                  <input type="text" value={modelSavePath} onChange={e => setModelSavePath(e.target.value)} placeholder="/models/output/" className="w-full px-4 py-3 rounded-lg border text-sm font-mono" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }} />
                  <p className="text-xs mt-2" style={{ color: 'var(--color-gray-400)' }}>💡 訓練完成後，模型權重將儲存至此路徑</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-900)' }}>選擇模型</h4>
                <div className="grid grid-cols-2 gap-3">
                  {availableModels.map((model, idx) => (
                    <div key={idx} onClick={() => { setSelectedModel(model.name); setSelectedVersion(model.versions[0]); }} className="p-4 rounded-lg border-2 cursor-pointer transition-all" style={{ borderColor: selectedModel === model.name ? 'var(--color-primary-blue)' : 'var(--color-gray-200)', background: selectedModel === model.name ? 'rgba(0,82,204,0.05)' : 'var(--color-bg-white)' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1"><div className="font-medium" style={{ color: 'var(--color-gray-900)' }}>{model.name}</div><div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>{model.description}</div></div>
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>{model.category}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs"><span style={{ color: 'var(--color-gray-400)' }}>建議配置：</span><span className="font-mono" style={{ color: 'var(--color-teal)' }}>{model.recommendedGPU}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedModel && (
                <div>
                  <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-900)' }}>選擇模型版本</h4>
                  <div className="relative">
                    <select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className="w-full px-4 py-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-gray-300)', background: 'var(--color-bg-white)', color: 'var(--color-gray-700)' }}>
                      {availableModels.find(m => m.name === selectedModel)?.versions.map((v, i) => <option key={i} value={v}>{selectedModel} - {v}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-gray-400)' }} />
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--color-gray-900)' }}>設定最大運算資源</h4>
                <div className="mb-4">
                  <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--color-gray-700)' }}>GPU 卡型選擇</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['H200', 'L40'] as const).map(type => (
                      <div key={type} onClick={() => setSelectedGPUType(type)} className="p-4 rounded-lg border-2 cursor-pointer transition-all" style={{ borderColor: selectedGPUType === type ? (type === 'H200' ? 'var(--color-danger)' : 'var(--color-teal)') : 'var(--color-gray-200)', background: selectedGPUType === type ? (type === 'H200' ? 'rgba(222,53,11,0.05)' : 'rgba(0,184,217,0.06)') : 'var(--color-bg-white)' }}>
                        <div className="flex items-center gap-2 mb-1"><Cpu className="w-4 h-4" style={{ color: type === 'H200' ? 'var(--color-danger)' : 'var(--color-teal)' }} /><div className="font-medium" style={{ color: 'var(--color-gray-900)' }}>NVIDIA {type}</div></div>
                        <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>{type === 'H200' ? '141 GB VRAM | 適合大規模訓練' : '48 GB VRAM | 適合視覺推論與生成工作負載'}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {[
                  { label: '最大 GPU 數量', val: maxGPU, set: setMaxGPU, min: 1, max: 8, step: 1, unit: 'GPUs', color: 'var(--color-primary-blue)' },
                  { label: '最大 CPU Cores', val: maxCPU, set: setMaxCPU, min: 4, max: 64, step: 4, unit: 'Cores', color: 'var(--color-teal)' },
                  { label: '最大記憶體 (GB)', val: maxMemory, set: setMaxMemory, min: 32, max: 512, step: 32, unit: 'GB', color: 'var(--color-warning)' },
                ].map(s => (
                  <div key={s.label} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm" style={{ color: 'var(--color-gray-700)' }}>{s.label}</label>
                      <span className="text-sm font-mono font-medium" style={{ color: s.color }}>{s.val} {s.unit}</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} onChange={e => s.set(Number(e.target.value))} className="w-full" style={{ accentColor: s.color }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}><span>{s.min}</span><span>{s.max}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sticky bottom-0 p-4 border-t flex items-center justify-end gap-3" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <button onClick={() => setShowModelSelector(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)' }}>取消</button>
              <button disabled={!selectedModel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: selectedModel ? 'var(--color-primary-blue)' : 'var(--color-gray-300)', color: 'white', opacity: selectedModel ? 1 : 0.5, cursor: selectedModel ? 'pointer' : 'not-allowed' }}>確認配置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
