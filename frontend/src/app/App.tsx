import React, { useState } from 'react';
import { LayoutDashboard, Cpu, Shield, Server, Activity, ChevronLeft, ChevronRight, ChevronDown, ScrollText, Users, ClipboardList, Database, LogOut, LockKeyhole, ArrowRight, ShieldCheck, Building2, Gauge } from 'lucide-react';
import platformLogo from '../imports/image-10.png';
import { GPUResourceDashboard } from './components/GPUResourceDashboard';
import { ModelOpsDashboard } from './components/ModelOpsDashboard';
import { SecurityObservability } from './components/SecurityObservability';
import { TraceDashboard } from './components/TraceDashboard';
import { AccountManagement } from './components/AccountManagement';
import { ComputeRequestModule } from './components/ComputeRequestModule';

type ModuleType = 'gpu-cluster' | 'gpu-workload' | 'model' | 'security' | 'trace' | 'account' | 'compute';

interface SubItem { id: ModuleType; name: string; icon: React.ElementType; description: string; }
interface NavGroup { kind: 'group'; id: string; name: string; icon: React.ElementType; children: SubItem[]; }
interface NavItem  { kind: 'item';  id: ModuleType; name: string; icon: React.ElementType; description: string; }
type NavEntry = NavGroup | NavItem;

const NAV: NavEntry[] = [
  { kind: 'item', id: 'model',    name: '模型倉庫',     icon: LayoutDashboard, description: '模型註冊、版本與部署管理' },
  {
    kind: 'group', id: 'compute-mgmt', name: '算力管理', icon: Database,
    children: [
      { id: 'compute',      name: '算力申請與審核',     icon: ClipboardList, description: '申請、追蹤與管理者審核' },
      { id: 'gpu-workload', name: '算力排程與工作負載', icon: Activity,      description: '專案隔離與任務排程管理' },
      { id: 'gpu-cluster',  name: '叢集資源總覽',      icon: Server,        description: '叢集狀態與資源即時監控' },
    ],
  },
  { kind: 'item', id: 'security', name: '安全監控',     icon: Shield,          description: '觀測與治理' },
  { kind: 'item', id: 'trace',    name: '追蹤日誌',     icon: ScrollText,      description: 'Langfuse 追蹤日誌管理' },
  { kind: 'item', id: 'account',  name: '帳號與權限管理', icon: Users,          description: '使用者帳號與角色管理' },
];

const ALL_ITEMS: SubItem[] = NAV.flatMap(e => e.kind === 'group' ? e.children : [e as SubItem]);

function renderModule(activeModule: ModuleType, restricted = false) {
  switch (activeModule) {
    case 'gpu-cluster':  return <GPUResourceDashboard tab="cluster" />;
    case 'gpu-workload': return <GPUResourceDashboard tab="workload" />;
    case 'compute':      return <ComputeRequestModule restricted={restricted} />;
    case 'model':        return <ModelOpsDashboard />;
    case 'security':     return <SecurityObservability />;
    case 'trace':        return <TraceDashboard />;
    case 'account':      return <AccountManagement />;
    default:             return <GPUResourceDashboard tab="cluster" />;
  }
}

function LoginScreen({ onLogin }: { onLogin: (mode: 'sso' | 'general') => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-8 sm:p-10" style={{ background: '#F2F1FA' }}>
      <section className="grid w-full max-w-[1120px] overflow-hidden rounded-[26px] border shadow-2xl lg:min-h-[650px] lg:grid-cols-[1.08fr_0.92fr]" style={{ background: '#FFFFFF', borderColor: '#E5E2F1', boxShadow: '0 28px 70px rgba(44, 35, 111, 0.17)' }}>
        <div className="relative hidden overflow-hidden p-11 text-white lg:flex lg:flex-col" style={{ background: 'linear-gradient(145deg, #17115D 0%, #3026A8 53%, #6B42E5 100%)' }}>
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border" style={{ borderColor: 'rgba(197,191,255,.35)' }} />
          <div className="absolute -left-9 -top-9 h-44 w-44 rounded-full border" style={{ borderColor: 'rgba(197,191,255,.26)' }} />
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.23)' }}><Cpu className="h-5 w-5" /></div>
            <div><p className="text-sm font-semibold">AI Compute Control</p><p className="text-xs text-indigo-200">企業級算力服務平台</p></div>
          </div>
          <div className="relative mt-14">
            <p className="text-xs font-semibold tracking-[0.2em] text-indigo-200">COMPUTE, ORCHESTRATED</p>
            <h1 className="mt-4 max-w-md text-[42px] font-semibold leading-[1.15]" style={{ letterSpacing: '-0.025em' }}>為模型服務，<br />配置恰好的算力。</h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-indigo-100">從模型註冊、服務部署到用量治理，將企業 AI 工作負載安全地連接至每一個團隊。</p>
          </div>
          <div className="relative mx-auto mt-10 h-48 w-72">
            <div className="absolute left-6 top-6 h-32 w-32 rounded-[26px]" style={{ background: 'linear-gradient(145deg, #6FE3FB, #5A69F5 65%, #4631B9)', boxShadow: '18px 21px 35px rgba(7, 3, 57, .35)', transform: 'rotate(-11deg)' }}>
              <div className="absolute left-7 top-7 grid h-16 w-16 place-items-center rounded-2xl" style={{ background: '#F4BE55', boxShadow: 'inset -9px -9px 0 rgba(174,105,18,.23)' }}><Cpu className="h-8 w-8" style={{ color: '#4B329B' }} /></div>
              <span className="absolute bottom-5 left-7 h-3 w-3 rounded-full bg-cyan-200 shadow-[20px_0_0_#c4b5fd,40px_0_0_#67e8f9]" />
            </div>
            <div className="absolute right-2 top-1 grid h-16 w-16 place-items-center rounded-2xl" style={{ background: 'rgba(155, 239, 255, .18)', border: '1px solid rgba(193,247,255,.45)', transform: 'rotate(12deg)' }}><Gauge className="h-7 w-7 text-cyan-100" /></div>
            <div className="absolute bottom-1 right-6 h-12 w-24 rounded-full opacity-50 blur-xl" style={{ background: '#0A0754' }} />
          </div>
          <div className="relative mt-auto grid grid-cols-3 gap-3 text-center">
            {[['H200', 'GPU 叢集'], ['TPM', '用量治理'], ['API', '安全存取']].map(([value, label]) => <div key={value} className="rounded-xl px-2 py-3" style={{ background: 'rgba(11, 6, 70, .2)', border: '1px solid rgba(255,255,255,.13)' }}><p className="text-sm font-semibold">{value}</p><p className="mt-1 text-[10px] text-indigo-200">{label}</p></div>)}
          </div>
        </div>

        <div className="flex min-h-[590px] flex-col px-7 py-8 sm:px-12 sm:py-10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: '#F1EEFF', border: '1px solid #E2DDFD' }}><img src={platformLogo} alt="AI Platform logo" className="h-5 w-auto object-contain" /></div>
            <span className="text-sm font-semibold" style={{ color: '#282344' }}>企業 AI 平台</span>
          </div>
          <div className="my-auto max-w-sm py-14">
            <p className="text-xs font-semibold tracking-[0.16em]" style={{ color: '#6956C9' }}>WELCOME</p>
            <h2 className="mt-3 text-3xl font-semibold" style={{ color: '#201C38', letterSpacing: '-0.02em' }}>登入工作空間</h2>
            <p className="mt-3 text-sm leading-6" style={{ color: '#77718C' }}>選擇登入方式，開始管理模型服務、算力資源與 API 用量。</p>
            <div className="mt-8 space-y-3">
              <button onClick={() => onLogin('sso')} className="group flex w-full items-center gap-4 rounded-xl p-4 text-left transition-transform hover:-translate-y-0.5" style={{ background: '#4F3AD4', color: 'white', border: '1px solid #4F3AD4', boxShadow: '0 10px 18px rgba(79,58,212,.18)', cursor: 'pointer' }}>
                <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: 'rgba(255,255,255,.14)' }}><Building2 className="h-5 w-5" /></span>
                <span className="flex-1"><span className="block text-sm font-semibold">SSO 單一簽入</span><span className="mt-0.5 block text-xs text-indigo-100">企業帳號 · 使用完整平台功能</span></span><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => onLogin('general')} className="group flex w-full items-center gap-4 rounded-xl p-4 text-left transition-transform hover:-translate-y-0.5" style={{ background: '#FFFFFF', color: '#292440', border: '1px solid #DED9F0', cursor: 'pointer' }}>
                <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: '#F1EEFF', color: '#5D4ACC' }}><LockKeyhole className="h-5 w-5" /></span>
                <span className="flex-1"><span className="block text-sm font-semibold">一般登入</span><span className="mt-0.5 block text-xs" style={{ color: '#807A93' }}>提出申請與追蹤案件處理進度</span></span><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" style={{ color: '#8D86A5' }} />
              </button>
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: '#F8F7FC', color: '#847E95' }}><ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none" style={{ color: '#6956C9' }} /><p className="text-xs leading-5">此為示範環境，不需要輸入帳號、密碼或驗證碼即可登入。</p></div>
          </div>
          <p className="text-center text-xs" style={{ color: '#A29CAD' }}>AI Compute Control Platform · v2.4.0</p>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [sessionMode, setSessionMode] = useState<'sso' | 'general' | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleType>('gpu-cluster');
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['compute-mgmt']));

  const toggleGroup = (id: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const visibleNav: NavEntry[] = sessionMode === 'general' ? [{ kind: 'group', id: 'compute-mgmt', name: '算力管理', icon: Database, children: [NAV.find(entry => entry.kind === 'group')!.children[0]] }] : NAV;
  const current = ALL_ITEMS.find(m => m.id === activeModule)!;

  if (!sessionMode) return <LoginScreen onLogin={mode => { setSessionMode(mode); setActiveModule(mode === 'general' ? 'compute' : 'gpu-cluster'); }} />;

  const btnBase: React.CSSProperties = {
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', width: '100%', borderRadius: 8, transition: 'background 0.15s',
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg-white)' }}>

      {/* ── Sidebar ── */}
      <aside
        className="border-r flex flex-col flex-shrink-0"
        style={{
          width: collapsed ? 64 : 256,
          borderColor: 'var(--color-gray-200)',
          background: 'var(--color-gray-50)',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div
          className="border-b flex-shrink-0 flex items-center"
          style={{
            borderColor: 'var(--color-gray-200)',
            height: 72,
            padding: collapsed ? '0 14px' : '0 20px',
            gap: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div className="rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ width: 36, height: 36, background: 'var(--color-primary-blue)' }}>
            <Cpu className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <h1 className="text-base whitespace-nowrap" style={{ color: 'var(--color-gray-900)' }}>AI Platform</h1>
              <p className="text-xs whitespace-nowrap" style={{ color: 'var(--color-gray-400)' }}>開發管理中控平台</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? '12px 8px' : '16px 12px' }}>
          <div className="space-y-0.5">
            {visibleNav.map(entry => {
              if (entry.kind === 'group') {
                const isGroupActive = entry.children.some(c => c.id === activeModule);
                const isOpen = openGroups.has(entry.id);
                const GroupIcon = entry.icon;

                if (collapsed) {
                  return (
                    <button
                      key={entry.id}
                      title={entry.name}
                      onClick={() => {
                        setActiveModule(entry.children[0].id);
                      }}
                      style={{
                        ...btnBase,
                        background: isGroupActive ? 'var(--color-primary-blue)' : 'transparent',
                        color: isGroupActive ? 'white' : 'var(--color-gray-700)',
                        padding: '10px 0',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={e => { if (!isGroupActive) e.currentTarget.style.background = 'var(--color-gray-100)'; }}
                      onMouseLeave={e => { if (!isGroupActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <GroupIcon className="w-5 h-5 flex-shrink-0" />
                    </button>
                  );
                }

                return (
                  <div key={entry.id}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(entry.id)}
                      style={{
                        ...btnBase,
                        background: isGroupActive && !isOpen ? 'rgba(0,82,204,0.07)' : 'transparent',
                        color: 'var(--color-gray-700)',
                        padding: '8px 12px',
                        gap: 8,
                        marginBottom: 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-gray-100)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isGroupActive && !isOpen ? 'rgba(0,82,204,0.07)' : 'transparent'; }}
                    >
                      <GroupIcon className="w-4 h-4 flex-shrink-0" style={{ color: isGroupActive ? 'var(--color-primary-blue)' : 'var(--color-gray-500)' }} />
                      <span className="flex-1 text-left text-sm whitespace-nowrap" style={{ fontWeight: 600, color: isGroupActive ? 'var(--color-primary-blue)' : 'var(--color-gray-600)' }}>
                        {entry.name}
                      </span>
                      <ChevronDown
                        className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
                        style={{ color: 'var(--color-gray-400)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                      />
                    </button>

                    {/* Sub-items */}
                    <div style={{
                      overflow: 'hidden',
                      maxHeight: isOpen ? entry.children.length * 56 : 0,
                      transition: 'max-height 0.22s cubic-bezier(0.4,0,0.2,1)',
                    }}>
                      <div
                        className="mb-1"
                        style={{ paddingLeft: 12, borderLeft: '2px solid var(--color-gray-200)', marginLeft: 18 }}
                      >
                        {entry.children.map(child => {
                          const ChildIcon = child.icon;
                          const isActive = activeModule === child.id;
                          return (
                            <button
                              key={child.id}
                              onClick={() => setActiveModule(child.id)}
                              style={{
                                ...btnBase,
                                background: isActive ? 'var(--color-primary-blue)' : 'transparent',
                                color: isActive ? 'white' : 'var(--color-gray-700)',
                                padding: '8px 10px',
                                gap: 8,
                                marginBottom: 1,
                              }}
                              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-gray-100)'; }}
                              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <ChildIcon className="w-4 h-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm whitespace-nowrap" style={{ fontWeight: 500 }}>{child.name}</div>
                                <div className="text-xs whitespace-nowrap" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-gray-400)', marginTop: 1 }}>
                                  {child.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              // Flat item
              const Icon = entry.icon;
              const isActive = activeModule === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setActiveModule(entry.id as ModuleType)}
                  title={collapsed ? entry.name : undefined}
                  style={{
                    ...btnBase,
                    background: isActive ? 'var(--color-primary-blue)' : 'transparent',
                    color: isActive ? 'white' : 'var(--color-gray-700)',
                    padding: collapsed ? '10px 0' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: collapsed ? 0 : 10,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-gray-100)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm whitespace-nowrap" style={{ fontWeight: 500 }}>{entry.name}</div>
                      <div className="text-xs whitespace-nowrap" style={{ color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--color-gray-400)', marginTop: 2 }}>
                        {entry.description}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="border-t flex-shrink-0 flex items-center"
          style={{
            borderColor: 'var(--color-gray-200)',
            padding: collapsed ? '12px 8px' : '12px 14px',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          {!collapsed && (
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-gray-400)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse-subtle flex-shrink-0" style={{ background: 'var(--color-success)' }} />
              正常運行
            </span>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? '展開側欄' : '收合側欄'}
            className="rounded-lg flex items-center justify-center transition-all"
            style={{
              width: 28, height: 28,
              border: '1px solid var(--color-gray-200)',
              background: 'var(--color-bg-white)',
              color: 'var(--color-gray-500)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-gray-100)'; e.currentTarget.style.color = 'var(--color-primary-blue)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-white)'; e.currentTarget.style.color = 'var(--color-gray-500)'; }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="border-b px-8 py-5" style={{
          borderColor: 'var(--color-gray-200)',
          background: 'var(--color-bg-white)',
        }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ color: 'var(--color-gray-900)' }}>{current.name}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-gray-400)' }}>{current.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm sm:inline" style={{ color: 'var(--color-gray-400)' }}>最後更新：2分鐘前</span>
              <button
                onClick={() => setSessionMode(null)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ color: '#B42318', background: '#FFF7F6', border: '1px solid #F4D4D0', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FDECE9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFF7F6'; }}
              >
                <LogOut className="h-4 w-4" />登出
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 animate-fade-in" style={{ background: 'var(--color-gray-50)' }}>
          {renderModule(activeModule, sessionMode === 'general')}
        </div>
      </main>
    </div>
  );
}
