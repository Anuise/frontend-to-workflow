import React, { useState } from 'react';
import { Eye, ShieldAlert, CheckCircle, AlertTriangle, TrendingUp, ThumbsUp, ThumbsDown, X, ChevronRight, Download, Calendar, FileBarChart } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
interface GuardrailLayer {
  layer: string; scanner: string; threshold: number;
  detectedScore: number; action: string; detectedEntities: string[];
}
interface Trace {
  id: string; timestamp: string; input: string; output: string;
  model: string; cost: number; latency: number;
  tokens: { input: number; output: number };
  quality: { overall: number; faithfulness: number; relevance: number; coherence: number; contextPrecision: number; hallucination: number; toxicity: number };
  status: 'success' | 'blocked';
  piiDetected: boolean;
  guardrailLayer: GuardrailLayer | null;
  humanFeedback: 'positive' | 'negative' | null;
}

// ─── Data ────────────────────────────────────────────────────────────────────
const TRACES: Trace[] = [
  { id: 'trace-001', timestamp: '10:34:12', input: '查詢客戶資料庫中的訂單記錄', output: '已找到 15 筆符合條件的訂單記錄', model: 'Llama-3.3-Nemotron', cost: 0.023, latency: 234, tokens: { input: 45, output: 78 }, quality: { overall: 0.92, faithfulness: 0.92, relevance: 0.89, coherence: 0.94, contextPrecision: 0.88, hallucination: 0.08, toxicity: 0.01 }, status: 'success', piiDetected: false, guardrailLayer: null, humanFeedback: null },
  { id: 'trace-002', timestamp: '10:33:45', input: '生成產品說明文案', output: '這款智慧型手機具備先進的 AI 功能...', model: 'GPT-oss-120B', cost: 0.041, latency: 412, tokens: { input: 32, output: 156 }, quality: { overall: 0.94, faithfulness: 0.95, relevance: 0.91, coherence: 0.96, contextPrecision: 0.93, hallucination: 0.05, toxicity: 0.0 }, status: 'success', piiDetected: false, guardrailLayer: null, humanFeedback: 'positive' },
  { id: 'trace-003', timestamp: '10:33:18', input: '分析使用者評論情緒，包含郵件 john.doe@example.com', output: '[已攔截] 偵測到可能包含個人資訊', model: 'Llama 3.3 70B', cost: 0.015, latency: 156, tokens: { input: 67, output: 12 }, quality: { overall: 0, faithfulness: 0, relevance: 0, coherence: 0, contextPrecision: 0, hallucination: 0, toxicity: 0 }, status: 'blocked', piiDetected: true, guardrailLayer: { layer: 'Input Rail', scanner: 'PII Scanner', threshold: 0.8, detectedScore: 0.95, action: 'reject', detectedEntities: ['EMAIL', 'PERSON_NAME'] }, humanFeedback: null },
  { id: 'trace-004', timestamp: '10:32:52', input: '提供法規遵循建議', output: '根據最新的金融監管規定，建議您...', model: 'Llama-3.3-Nemotron', cost: 0.067, latency: 523, tokens: { input: 89, output: 234 }, quality: { overall: 0.91, faithfulness: 0.88, relevance: 0.93, coherence: 0.91, contextPrecision: 0.90, hallucination: 0.12, toxicity: 0.0 }, status: 'success', piiDetected: false, guardrailLayer: null, humanFeedback: null },
  { id: 'trace-005', timestamp: '10:32:21', input: '翻譯技術文件', output: '技術規格書已成功翻譯為繁體中文', model: 'GPT-oss-120B', cost: 0.034, latency: 367, tokens: { input: 123, output: 145 }, quality: { overall: 0.90, faithfulness: 0.91, relevance: 0.87, coherence: 0.93, contextPrecision: 0.89, hallucination: 0.09, toxicity: 0.02 }, status: 'success', piiDetected: false, guardrailLayer: null, humanFeedback: 'negative' },
  { id: 'trace-006', timestamp: '10:31:55', input: '摘要本季財務報告', output: '本季總收入達 4.2 億，較去年同期成長 18%...', model: 'GPT-oss-120B', cost: 0.058, latency: 489, tokens: { input: 210, output: 198 }, quality: { overall: 0.93, faithfulness: 0.93, relevance: 0.94, coherence: 0.92, contextPrecision: 0.91, hallucination: 0.07, toxicity: 0.0 }, status: 'success', piiDetected: false, guardrailLayer: null, humanFeedback: null },
];

const DATE_FILTERS = ['今', '昨', '本月', '本季', '本年', '自訂日期'];
const REPORT_TABS = ['系統運作', '系統成效', '依賴狀況'];

// ─── Report modal data ────────────────────────────────────────────────────────
const SLA_ROWS = [
  { name: '每日查詢數',   value: '312',  unit: 'ms', threshold: '<1000ms' },
  { name: '最大查詢數',   value: '923',  unit: 'ms', threshold: '<1000ms' },
  { name: '平均查詢比率', value: '89.5', unit: '%',  threshold: '—'       },
  { name: '平均查詢大小', value: '218',  unit: 'ms', threshold: '—'       },
  { name: 'P95 延遲',     value: '487',  unit: 'ms', threshold: '—'       },
];

const RESOURCE_ROWS = [
  { name: '相關指標 CPU 使用率', value: '47.45', threshold: '—',    status: '正常' },
  { name: '相關指標 GPU 使用率', value: '72.15', threshold: '75.15',status: '警告' },
  { name: 'A100 GPU 使用率',     value: '60.15', threshold: '77.25',status: '正常' },
  { name: 'A100 GPU 使用率',     value: '68.15', threshold: '—',    status: '正常' },
  { name: '系統負載 (Load Avg)', value: '4.82',  threshold: '—',    status: '正常' },
];

const ANOMALY_ROWS = [
  { event: 'GPU_UTIL',  count: 1, score: 3, note: '資源使用管控' },
  { event: '儲存警告',  count: 1, score: 9, note: '—'           },
  { event: '儲存空間',  count: 1, score: 7, note: '—'           },
  { event: '記憶體',    count: 1, score: 1, note: '記憶體使用管控' },
  { event: '異常流量',  count: 1, score: 1, note: '異常流量管控' },
];

const PERF_STATS = [
  { label: '平均回應品質', value: '92.4%', color: 'var(--color-success)',      bg: 'rgba(54,179,126,0.06)' },
  { label: '幻覺偵測率',   value: '7.8%',  color: 'var(--color-primary-blue)', bg: 'rgba(0,82,204,0.05)'   },
  { label: '毒性攔截數',   value: '26',    color: 'var(--color-danger)',        bg: 'rgba(222,53,11,0.05)'  },
  { label: 'PII 攔截率',   value: '100%',  color: 'var(--color-success)',       bg: 'rgba(54,179,126,0.06)' },
  { label: '正向回饋比率', value: '84.3%', color: 'var(--color-teal)',          bg: 'rgba(0,184,217,0.05)'  },
  { label: 'P95 延遲',     value: '487ms', color: 'var(--color-warning)',       bg: 'rgba(255,171,0,0.06)'  },
];

const DEPEND_ROWS = [
  { service: 'Langfuse API',      status: '正常', latency: '23ms',  uptime: '99.98%' },
  { service: 'Vector Store',      status: '正常', latency: '8ms',   uptime: '100%'   },
  { service: 'Model Registry',    status: '正常', latency: '41ms',  uptime: '99.95%' },
  { service: 'GPU Scheduler',     status: '警告', latency: '312ms', uptime: '97.2%'  },
  { service: 'Object Storage',    status: '正常', latency: '15ms',  uptime: '100%'   },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return status === '警告'
    ? <span className="badge badge-warning" style={{ fontSize: 10 }}>警告</span>
    : <span className="badge badge-success" style={{ fontSize: 10 }}>正常</span>;
}

// ─── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({ onClose }: { onClose: () => void }) {
  const [dateFilter, setDateFilter] = useState('本月');
  const [reportTab, setReportTab] = useState('系統運作');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="relative w-full rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 960, maxHeight: '90vh', background: 'var(--color-bg-white)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-gray-200)', flexShrink: 0 }}>
          <div>
            <h3 style={{ color: 'var(--color-gray-900)' }}>追蹤日誌管理報表</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>追蹤日誌整合 AI 平台，預覽服務系統</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
          </button>
        </div>

        {/* Date filters + export */}
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--color-gray-100)', flexShrink: 0 }}>
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--color-gray-100)' }}>
            {DATE_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className="px-3 py-1 rounded-md text-sm transition-all"
                style={{
                  background: dateFilter === f ? 'var(--color-bg-white)' : 'transparent',
                  color: dateFilter === f ? 'var(--color-primary-blue)' : 'var(--color-gray-500)',
                  fontWeight: dateFilter === f ? 500 : 400,
                  border: 'none', cursor: 'pointer',
                  boxShadow: dateFilter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {f === '自訂日期' ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{f}</span> : f}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}>
            <Download className="w-4 h-4" />
            匯出報表
          </button>
        </div>

        {/* Report tabs */}
        <div className="flex px-6 border-b" style={{ borderColor: 'var(--color-gray-200)', flexShrink: 0 }}>
          {REPORT_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setReportTab(tab)}
              className="px-5 py-2.5 text-sm font-medium transition-all"
              style={{
                borderBottom: `2px solid ${reportTab === tab ? 'var(--color-primary-blue)' : 'transparent'}`,
                color: reportTab === tab ? 'var(--color-primary-blue)' : 'var(--color-gray-500)',
                background: 'none', border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: reportTab === tab ? 'var(--color-primary-blue)' : 'transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Modal body — scrollable */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* ── 系統運作 ── */}
          {reportTab === '系統運作' && (
            <div>
              <div className="text-sm font-medium mb-4" style={{ color: 'var(--color-gray-700)' }}>述地一：系統運作</div>
              <div className="grid grid-cols-3 gap-5">

                {/* 系統運作 table */}
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-500)' }}>系統運作</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                        {['指標', '數值', '門檻值', '狀態'].map(h => (
                          <th key={h} className="text-left py-2 pr-3" style={{ color: 'var(--color-gray-400)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SLA_ROWS.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                          <td className="py-2 pr-3" style={{ color: 'var(--color-gray-700)' }}>{r.name}</td>
                          <td className="py-2 pr-3 font-mono" style={{ color: 'var(--color-gray-900)' }}>{r.value} <span style={{ color: 'var(--color-gray-400)' }}>{r.unit}</span></td>
                          <td className="py-2 pr-3" style={{ color: 'var(--color-gray-400)' }}>{r.threshold}</td>
                          <td className="py-2"><StatusBadge status="正常" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 資源監控 table */}
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-500)' }}>資源監控</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                        {['指標', '數值', '門檻值', '狀態'].map(h => (
                          <th key={h} className="text-left py-2 pr-3" style={{ color: 'var(--color-gray-400)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RESOURCE_ROWS.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                          <td className="py-2 pr-3" style={{ color: 'var(--color-gray-700)' }}>{r.name}</td>
                          <td className="py-2 pr-3 font-mono" style={{ color: r.status === '警告' ? 'var(--color-warning)' : 'var(--color-gray-900)' }}>{r.value}</td>
                          <td className="py-2 pr-3" style={{ color: 'var(--color-gray-400)' }}>{r.threshold}</td>
                          <td className="py-2"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 異常狀態 table */}
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-500)' }}>異常狀態</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                        {['事件類型', '發生次數', '應對序數', '備注'].map(h => (
                          <th key={h} className="text-left py-2 pr-3" style={{ color: 'var(--color-gray-400)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ANOMALY_ROWS.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                          <td className="py-2 pr-3"><span className="badge badge-warning" style={{ fontSize: 10 }}>{r.event}</span></td>
                          <td className="py-2 pr-3 font-mono" style={{ color: 'var(--color-gray-700)' }}>{r.count}</td>
                          <td className="py-2 pr-3 font-mono" style={{ color: 'var(--color-gray-700)' }}>{r.score}</td>
                          <td className="py-2" style={{ color: 'var(--color-gray-400)' }}>{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* ── 系統成效 ── */}
          {reportTab === '系統成效' && (
            <div className="grid grid-cols-3 gap-4">
              {PERF_STATS.map(s => (
                <div key={s.label} className="p-4 rounded-xl" style={{ background: s.bg, border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>{s.label}</div>
                  <div className="text-2xl font-mono font-semibold" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── 依賴狀況 ── */}
          {reportTab === '依賴狀況' && (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                  {['服務名稱', '狀態', '延遲', '可用率'].map(h => (
                    <th key={h} className="text-left py-2 pr-4" style={{ color: 'var(--color-gray-400)', fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEPEND_ROWS.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                    <td className="py-3 pr-4 font-medium" style={{ color: 'var(--color-gray-800)' }}>{r.service}</td>
                    <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 pr-4 font-mono text-xs" style={{ color: 'var(--color-gray-600)' }}>{r.latency}</td>
                    <td className="py-3 font-mono text-xs" style={{ color: r.uptime === '100%' ? 'var(--color-success)' : r.uptime.startsWith('97') ? 'var(--color-warning)' : 'var(--color-gray-600)' }}>{r.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TraceDashboard() {
  const [dateFilter, setDateFilter] = useState('今');
  const [drawerTrace, setDrawerTrace] = useState<Trace | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, 'positive' | 'negative'>>({});
  const [showReport, setShowReport] = useState(false);

  const selectedTraceData = TRACES.find(t => t.id === selectedTrace) ?? null;
  const radarData = selectedTraceData ? [
    { metric: 'Faithfulness', value: selectedTraceData.quality.faithfulness * 100 },
    { metric: 'Relevance',    value: selectedTraceData.quality.relevance * 100 },
    { metric: 'Coherence',    value: selectedTraceData.quality.coherence * 100 },
    { metric: 'Context',      value: selectedTraceData.quality.contextPrecision * 100 },
  ] : [];

  return (
    <div className="space-y-5">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--color-gray-100)' }}>
          {DATE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className="px-3 py-1.5 rounded-md text-sm transition-all"
              style={{
                background: dateFilter === f ? 'var(--color-bg-white)' : 'transparent',
                color: dateFilter === f ? 'var(--color-primary-blue)' : 'var(--color-gray-500)',
                fontWeight: dateFilter === f ? 500 : 400,
                border: 'none', cursor: 'pointer',
                boxShadow: dateFilter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {f === '自訂日期' ? <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{f}</span> : f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
            style={{ background: 'var(--color-bg-white)', color: 'var(--color-gray-700)', border: '1px solid var(--color-gray-200)', cursor: 'pointer' }}
          >
            <FileBarChart className="w-4 h-4" />
            管理報表
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
            style={{ background: 'var(--color-primary-blue)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            <Download className="w-4 h-4" />
            匯出報表
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '總請求數', value: '1,247', color: 'var(--color-primary-blue)' },
          { label: '成功',     value: '1,221', color: 'var(--color-success)'       },
          { label: '已攔截',   value: '26',    color: 'var(--color-danger)'         },
          { label: '平均延遲', value: '397ms', color: 'var(--color-warning)'       },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body py-4">
              <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>{s.label}</div>
              <div className="text-xl font-mono font-semibold" style={{ color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trace table */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
              <h4 style={{ color: 'var(--color-gray-900)' }}>追蹤日誌 (Langfuse Traces)</h4>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                <span style={{ color: 'var(--color-gray-400)' }}>成功</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-danger)' }} />
                <span style={{ color: 'var(--color-gray-400)' }}>已攔截</span>
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>時間</th>
                <th>TRACE ID</th>
                <th>輸入</th>
                <th>概述</th>
                <th>模型</th>
                <th>Tokens</th>
                <th>品質</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {TRACES.map(trace => (
                <tr key={trace.id} style={{ background: selectedTrace === trace.id ? 'rgba(0,82,204,0.03)' : 'transparent' }}>
                  <td style={{ color: 'var(--color-gray-400)', fontSize: 12, fontFamily: 'monospace' }}>{trace.timestamp}</td>
                  <td>
                    <button
                      onClick={() => setDrawerTrace(trace)}
                      className="text-xs font-mono flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--color-primary-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {trace.id}<ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                  <td style={{ maxWidth: 180 }}>
                    <div className="text-xs truncate" style={{ color: 'var(--color-gray-700)' }}>{trace.input}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="text-xs truncate" style={{ color: trace.status === 'blocked' ? 'var(--color-danger)' : 'var(--color-gray-600)' }}>{trace.output}</div>
                  </td>
                  <td><span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>{trace.model}</span></td>
                  <td><span className="text-xs font-mono" style={{ color: 'var(--color-gray-700)' }}>{trace.tokens.input + trace.tokens.output}</span></td>
                  <td>
                    {trace.status === 'success' ? (
                      <button onClick={() => setSelectedTrace(t => t === trace.id ? null : trace.id)} className="flex items-center gap-1" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                        <span className="text-xs font-mono" style={{ color: 'var(--color-success)' }}>{(trace.quality.overall * 100).toFixed(0)}%</span>
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {trace.piiDetected
                      ? <span className="badge badge-danger" style={{ fontSize: 10 }}><ShieldAlert className="w-3 h-3 mr-1 inline" />PII</span>
                      : <span className="badge badge-success" style={{ fontSize: 10 }}><CheckCircle className="w-3 h-3 mr-1 inline" />安全</span>
                    }
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setFeedbacks(p => ({ ...p, [trace.id]: 'positive' }))} style={{ color: (feedbacks[trace.id] ?? trace.humanFeedback) === 'positive' ? 'var(--color-success)' : 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="正確"><ThumbsUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setFeedbacks(p => ({ ...p, [trace.id]: 'negative' }))} style={{ color: (feedbacks[trace.id] ?? trace.humanFeedback) === 'negative' ? 'var(--color-danger)' : 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="需修正"><ThumbsDown className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality radar panel */}
      {selectedTraceData && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h4 style={{ color: 'var(--color-gray-900)' }}>AI 品質自動評估 — {selectedTraceData.id}</h4>
              <button onClick={() => setSelectedTrace(null)} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', border: 'none', cursor: 'pointer' }}>關閉</button>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm mb-3" style={{ color: 'var(--color-gray-700)', fontWeight: 500 }}>多維度品質雷達圖</div>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--color-gray-200)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--color-gray-400)', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--color-gray-400)', fontSize: 10 }} />
                    <Radar name="Quality" dataKey="value" stroke="var(--color-primary-blue)" fill="var(--color-primary-blue)" fillOpacity={0.3} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-gray-200)', borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>輸入內容</div>
                  <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-700)' }}>{selectedTraceData.input}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>輸出內容</div>
                  <div className="p-3 rounded-lg text-sm" style={{ background: selectedTraceData.status === 'blocked' ? 'rgba(222,53,11,0.05)' : 'var(--color-gray-50)', color: selectedTraceData.status === 'blocked' ? 'var(--color-danger)' : 'var(--color-gray-700)' }}>{selectedTraceData.output}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: '模型', val: selectedTraceData.model },
                    { label: '延遲', val: `${selectedTraceData.latency}ms` },
                    { label: '輸入 Tokens', val: String(selectedTraceData.tokens.input) },
                    { label: '輸出 Tokens', val: String(selectedTraceData.tokens.output) },
                  ].map(r => (
                    <div key={r.label}>
                      <div style={{ color: 'var(--color-gray-400)' }}>{r.label}</div>
                      <div className="mt-0.5 font-mono" style={{ color: 'var(--color-gray-700)' }}>{r.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Trace Detail Drawer ── */}
      {drawerTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" onClick={() => setDrawerTrace(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
          <div
            className="relative h-full overflow-y-auto shadow-2xl"
            style={{ width: 480, background: 'var(--color-bg-white)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 p-4 border-b flex items-center justify-between" style={{ background: 'var(--color-bg-white)', borderColor: 'var(--color-gray-200)' }}>
              <div>
                <h4 style={{ color: 'var(--color-gray-900)' }}>攤載詳情 (Trace Details)</h4>
                <div className="text-xs font-mono mt-1" style={{ color: 'var(--color-primary-blue)' }}>{drawerTrace.id}</div>
              </div>
              <button onClick={() => setDrawerTrace(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
                <X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-400)' }}>INPUT</div>
                <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-700)', border: '1px solid var(--color-gray-200)' }}>{drawerTrace.input}</div>
              </div>
              {drawerTrace.guardrailLayer && (
                <div className="p-4 rounded-lg" style={{ background: 'rgba(222,53,11,0.05)', border: '1px solid var(--color-danger)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-danger)' }}>Guardrail 已觸發</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div><span style={{ color: 'var(--color-gray-400)' }}>Layer:</span> <span style={{ color: 'var(--color-gray-700)' }}>{drawerTrace.guardrailLayer.layer} → {drawerTrace.guardrailLayer.scanner}</span></div>
                    <div><span style={{ color: 'var(--color-gray-400)' }}>Detected Score:</span> <span className="font-mono" style={{ color: 'var(--color-danger)' }}>{drawerTrace.guardrailLayer.detectedScore} (超過閾值 {drawerTrace.guardrailLayer.threshold})</span></div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span style={{ color: 'var(--color-gray-400)' }}>Entities:</span>
                      {drawerTrace.guardrailLayer.detectedEntities.map(e => <span key={e} className="badge badge-danger" style={{ fontSize: 10 }}>{e}</span>)}
                    </div>
                    <div><span style={{ color: 'var(--color-gray-400)' }}>Action:</span> <span style={{ color: 'var(--color-danger)', fontWeight: 500 }}>🚫 拒絕回答</span></div>
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-400)' }}>OUTPUT</div>
                <div className="p-3 rounded-lg text-sm" style={{ background: drawerTrace.status === 'blocked' ? 'rgba(222,53,11,0.05)' : 'var(--color-gray-50)', color: drawerTrace.status === 'blocked' ? 'var(--color-danger)' : 'var(--color-gray-700)', border: `1px solid ${drawerTrace.status === 'blocked' ? 'var(--color-danger)' : 'var(--color-gray-200)'}` }}>{drawerTrace.output}</div>
              </div>
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: 'var(--color-gray-400)' }}>TRACE WATERFALL</div>
                <div className="space-y-2">
                  {[
                    { step: 1, label: 'User Input',      time: '12ms',                   ok: true },
                    { step: 2, label: 'Guardrail Check', time: '45ms',                   ok: !drawerTrace.piiDetected },
                    ...(!drawerTrace.piiDetected ? [
                      { step: 3, label: 'LLM Call',        time: `${drawerTrace.latency}ms`, ok: true },
                      { step: 4, label: 'Output Guardrail',time: '28ms',                   ok: true },
                      { step: 5, label: 'Final Response',  time: '8ms',                    ok: true },
                    ] : []),
                  ].map((s, i, arr) => (
                    <React.Fragment key={s.step}>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ background: s.ok ? 'var(--color-success)' : 'var(--color-danger)', color: 'white' }}>{s.step}</div>
                        <div>
                          <div className="text-xs" style={{ color: 'var(--color-gray-700)' }}>{s.label}</div>
                          <div className="text-xs font-mono" style={{ color: 'var(--color-gray-400)' }}>{s.time}</div>
                        </div>
                      </div>
                      {i < arr.length - 1 && <div className="ml-3 border-l-2 h-3" style={{ borderColor: 'var(--color-gray-200)' }} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--color-gray-50)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-400)' }}>METADATA</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span style={{ color: 'var(--color-gray-400)' }}>Model:</span> <span style={{ color: 'var(--color-gray-700)' }}>{drawerTrace.model}</span></div>
                  <div><span style={{ color: 'var(--color-gray-400)' }}>Latency:</span> <span style={{ color: 'var(--color-gray-700)' }}>{drawerTrace.latency}ms</span></div>
                  <div><span style={{ color: 'var(--color-gray-400)' }}>Tokens:</span> <span style={{ color: 'var(--color-gray-700)' }}>{drawerTrace.tokens.input + drawerTrace.tokens.output}</span></div>
                  <div><span style={{ color: 'var(--color-gray-400)' }}>Cost:</span> <span style={{ color: 'var(--color-gray-700)' }}>${drawerTrace.cost.toFixed(3)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
