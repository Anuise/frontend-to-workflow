import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle, XCircle, Settings, Play, Upload, ExternalLink, X, ChevronRight, Zap } from 'lucide-react';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';

export function SecurityObservability() {
  const [showRedTeamResults, setShowRedTeamResults] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<string | null>(null);

  const securityScans = [
    { 
      name: '提示注入掃描', 
      status: 'passed', 
      lastRun: '10分鐘前',
      issues: 0,
      icon: ShieldCheck,
      interceptRate: [
        { time: '00:00', rate: 12 },
        { time: '04:00', rate: 8 },
        { time: '08:00', rate: 15 },
        { time: '12:00', rate: 23 },
        { time: '16:00', rate: 18 },
        { time: '20:00', rate: 14 },
      ]
    },
    { 
      name: '機敏內容護欄', 
      status: 'active', 
      lastRun: '即時監控',
      blocked: 23,
      icon: ShieldAlert,
      hasRules: true
    },
    { 
      name: '越獄行為防禦', 
      status: 'passed', 
      lastRun: '2小時前',
      attempts: 150,
      success: 148,
      icon: Shield
    },
  ];

  const redTeamResults = [
    { vulnerability: 'Prompt Injection', status: 'safe', count: 0, color: 'var(--color-success)' },
    { vulnerability: 'Insecure Output Handling', status: 'warning', count: 3, color: 'var(--color-warning)' },
    { vulnerability: 'Sensitive Info Disclosure', status: 'failed', count: 2, color: 'var(--color-danger)' },
    { vulnerability: 'Model Denial of Service', status: 'safe', count: 0, color: 'var(--color-success)' },
    { vulnerability: 'Supply Chain Vulnerabilities', status: 'safe', count: 0, color: 'var(--color-success)' },
    { vulnerability: 'Data Poisoning', status: 'warning', count: 1, color: 'var(--color-warning)' },
    { vulnerability: 'Excessive Agency', status: 'safe', count: 0, color: 'var(--color-success)' },
    { vulnerability: 'Insecure Plugin Design', status: 'safe', count: 0, color: 'var(--color-success)' },
    { vulnerability: 'Training Data Leakage', status: 'warning', count: 2, color: 'var(--color-warning)' },
    { vulnerability: 'Model Theft', status: 'safe', count: 0, color: 'var(--color-success)' },
  ];

  const handleRunRedTeam = () => {
    setShowRedTeamResults(true);
  };

  // Vulnerability Details Data
  const vulnerabilityDetails: Record<string, any> = {
    'Insecure Output Handling': {
      severity: 'warning',
      description: '系統在處理 LLM 輸出時缺乏適當的驗證和清理機制，可能導致惡意內容被執行或顯示。',
      affectedComponents: ['Agent Output Handler', 'Response Formatter', 'UI Renderer'],
      issues: [
        {
          id: 'IOH-001',
          location: 'agent/output_handler.py:234',
          type: 'XSS Injection Risk',
          description: 'LLM 輸出未經過 HTML 編碼直接渲染到前端',
          severity: 'High'
        },
        {
          id: 'IOH-002',
          location: 'api/response_format.ts:89',
          type: 'Code Injection Risk',
          description: '允許 LLM 返回的代碼片段直接執行',
          severity: 'Critical'
        },
        {
          id: 'IOH-003',
          location: 'ui/markdown_render.tsx:45',
          type: 'Unsafe Markdown Parsing',
          description: 'Markdown 解析器未過濾危險 HTML 標籤',
          severity: 'Medium'
        }
      ],
      aiRecommendations: [
        {
          step: 1,
          title: '實施輸出內容驗證層',
          description: '在 Agent 和使用者介面之間加入內容驗證層，過濾所有 LLM 輸出。',
          priority: 'High'
        },
        {
          step: 2,
          title: '啟用內容安全政策 (CSP)',
          description: '配置嚴格的 Content Security Policy 標頭，防止內嵌腳本執行。',
          priority: 'High'
        },
        {
          step: 3,
          title: '使用安全的 Markdown 渲染器',
          description: '替換為具有內建 XSS 防護的 Markdown 庫，如 DOMPurify + marked。',
          priority: 'Medium'
        },
        {
          step: 4,
          title: '實施輸出速率限制',
          description: '限制單一使用者在短時間內的輸出請求數量，防止濫用。',
          priority: 'Low'
        }
      ],
      codeExample: `// 修復前 (不安全)
function renderOutput(llmResponse: string) {
  return <div dangerouslySetInnerHTML={{ __html: llmResponse }} />;
}

// 修復後 (安全)
import DOMPurify from 'dompurify';

function renderOutput(llmResponse: string) {
  // 1. 清理 HTML
  const cleanHTML = DOMPurify.sanitize(llmResponse, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre'],
    ALLOWED_ATTR: []
  });
  
  // 2. 使用安全的渲染方式
  return <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />;
}

// 3. 加入 NeMo Guardrails 驗證
async function validateOutput(response: string): Promise<string> {
  const guardrailResult = await nemoGuardrails.check({
    text: response,
    rails: ['output_validation', 'xss_detection']
  });
  
  if (guardrailResult.blocked) {
    throw new Error('Output blocked by guardrails');
  }
  
  return response;
}`
    },
    'Sensitive Info Disclosure': {
      severity: 'danger',
      description: '模型可能洩漏訓練資料中的敏感資訊，或在回應中意外包含個人識別資訊 (PII)。',
      affectedComponents: ['LLM Response Generator', 'Context Builder', 'Memory Store'],
      issues: [
        {
          id: 'SID-001',
          location: 'llm/context_builder.py:156',
          type: 'PII Leakage',
          description: '對話歷史記錄包含未脫敏的使用者資料',
          severity: 'Critical'
        },
        {
          id: 'SID-002',
          location: 'memory/vector_store.ts:234',
          type: 'Sensitive Data in Embeddings',
          description: '向量資料庫中儲存了原始敏感資料',
          severity: 'High'
        }
      ],
      aiRecommendations: [
        {
          step: 1,
          title: '部署 PII 偵測與遮蔽層',
          description: '使用 Presidio 或類似工具自動偵測並遮蔽 PII（email、電話、身分證號等）。',
          priority: 'Critical'
        },
        {
          step: 2,
          title: '實施資料脫敏政策',
          description: '在資料進入 LLM 之前，先進行自動化脫敏處理。',
          priority: 'High'
        },
        {
          step: 3,
          title: '啟用 NeMo PII Rail',
          description: '配置 NeMo Guardrails 的 PII 防護規則，雙重驗證輸入與輸出。',
          priority: 'High'
        },
        {
          step: 4,
          title: '定期審核記憶體存儲',
          description: '定期掃描向量資料庫和對話記錄，移除過期或敏感資料。',
          priority: 'Medium'
        }
      ],
      codeExample: `// 使用 Presidio 進行 PII 偵測與遮蔽
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def sanitize_input(user_input: str) -> str:
    # 1. 分析並偵測 PII
    results = analyzer.analyze(
        text=user_input,
        entities=["EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON", "CREDIT_CARD"],
        language="zh"
    )
    
    # 2. 遮蔽敏感資訊
    anonymized = anonymizer.anonymize(
        text=user_input,
        analyzer_results=results
    )
    
    return anonymized.text

// 整合到 LLM 呼叫流程
async function callLLM(raw_input: string): Promise<string> {
    // 輸入清理
    const clean_input = sanitize_input(raw_input);
    
    // LLM 推論
    const response = await llm.generate(clean_input);
    
    // 輸出驗證
    const clean_output = sanitize_input(response);
    
    return clean_output;
}`
    },
    'Training Data Leakage': {
      severity: 'warning',
      description: '訓練資料中的機密資訊可能通過模型回應洩漏，包括內部文件、原始碼片段等。',
      affectedComponents: ['Fine-tuning Pipeline', 'RAG Retriever', 'Training Data Store'],
      issues: [
        {
          id: 'TDL-001',
          location: 'training/data_prep.py:78',
          type: 'Unfiltered Training Data',
          description: '訓練資料集包含內部 API 金鑰和憑證',
          severity: 'Critical'
        },
        {
          id: 'TDL-002',
          location: 'rag/retriever.py:123',
          type: 'Excessive Context Window',
          description: 'RAG 檢索返回過多原始文件內容',
          severity: 'Medium'
        }
      ],
      aiRecommendations: [
        {
          step: 1,
          title: '訓練資料清理與審核',
          description: '建立自動化管道掃描訓練資料，移除機密資訊和憑證。',
          priority: 'Critical'
        },
        {
          step: 2,
          title: '限制 RAG 上下文長度',
          description: '配置檢索器只返回摘要或關鍵片段，而非完整文件。',
          priority: 'High'
        },
        {
          step: 3,
          title: '實施資料分類標籤',
          description: '為所有訓練資料添加敏感度標籤（Public/Internal/Confidential）。',
          priority: 'Medium'
        },
        {
          step: 4,
          title: '啟用模型輸出監控',
          description: '使用 Langfuse 追蹤所有輸出，標記可疑的機密資訊洩漏。',
          priority: 'High'
        }
      ],
      codeExample: `// 訓練資料清理範例
import re
from typing import List

class DataSanitizer:
    def __init__(self):
        self.patterns = {
            'api_key': r'(api[_-]?key|apikey)\\s*[:=]\\s*["\']?([a-zA-Z0-9_\\-]{20,})',
            'password': r'(password|passwd|pwd)\\s*[:=]\\s*["\']?([^"\'\\s]{8,})',
            'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
            'ip_address': r'\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b'
        }
    
    def scan_document(self, text: str) -> List[dict]:
        findings = []
        for key, pattern in self.patterns.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                findings.append({
                    'type': key,
                    'value': match.group(0),
                    'position': match.span()
                })
        return findings
    
    def sanitize(self, text: str) -> str:
        for key, pattern in self.patterns.items():
            text = re.sub(pattern, f'[REDACTED_{key.upper()}]', text, flags=re.IGNORECASE)
        return text

// 整合到 RAG 管道
sanitizer = DataSanitizer()

def prepare_training_data(documents: List[str]) -> List[str]:
    cleaned_docs = []
    for doc in documents:
        # 掃描機密資訊
        findings = sanitizer.scan_document(doc)
        if findings:
            print(f"⚠️  Found {len(findings)} sensitive items")
        
        # 清理文件
        clean_doc = sanitizer.sanitize(doc)
        cleaned_docs.append(clean_doc)
    
    return cleaned_docs`
    },
    'Data Poisoning': {
      severity: 'warning',
      description: '惡意行為者可能透過注入有毒資料來操縱模型行為或訓練流程。',
      affectedComponents: ['User Feedback Loop', 'Fine-tuning Service', 'Knowledge Base Updater'],
      issues: [
        {
          id: 'DP-001',
          location: 'feedback/collector.py:56',
          type: 'Unvalidated User Feedback',
          description: '使用者回饋未經驗證直接用於模型微調',
          severity: 'High'
        }
      ],
      aiRecommendations: [
        {
          step: 1,
          title: '實施回饋驗證機制',
          description: '建立多層驗證流程，包括自動化檢測和人工審核。',
          priority: 'High'
        },
        {
          step: 2,
          title: '啟用異常偵測',
          description: '使用統計模型偵測異常的回饋模式或突然變化。',
          priority: 'Medium'
        },
        {
          step: 3,
          title: '隔離微調環境',
          description: '在沙盒環境中進行模型微調，防止污染生產模型。',
          priority: 'High'
        }
      ],
      codeExample: `// 回饋驗證範例
class FeedbackValidator:
    def __init__(self):
        self.anomaly_detector = AnomalyDetector()
    
    def validate(self, feedback: dict) -> bool:
        # 1. 檢查回饋頻率
        if self.is_spam(feedback['user_id']):
            return False
        
        # 2. 內容品質檢查
        if not self.check_quality(feedback['content']):
            return False
        
        # 3. 異常偵測
        if self.anomaly_detector.detect(feedback):
            return False
        
        return True`
    }
  };

  const currentVulnerabilityDetail = selectedVulnerability ? vulnerabilityDetails[selectedVulnerability] : null;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="mb-1" style={{ color: 'var(--color-gray-900)' }}>全方位觀測與安全治理</h3>
              <p className="text-sm" style={{ color: 'var(--color-gray-400)' }}>
                整合 Langfuse、DeepEval、NeMo Guardrails、Garak 的企業級監控平台
              </p>
            </div>
            <div className="flex items-center gap-3">
            </div>
          </div>
        </div>
      </div>

      {/* Red Team Scan Results */}
      {showRedTeamResults && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                <h4 style={{ color: 'var(--color-gray-900)' }}>紅隊掃描報告 (OWASP LLM Top 10)</h4>
                <span className="badge badge-danger" style={{ fontSize: '10px' }}>Garak 1000 次攻擊測試</span>
              </div>
              <button 
                onClick={() => setShowRedTeamResults(false)}
                className="text-xs px-3 py-1 rounded-lg" 
                style={{ 
                  background: 'var(--color-gray-100)',
                  color: 'var(--color-gray-700)'
                }}
              >
                關閉
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              {redTeamResults.map((result, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md"
                  style={{ 
                    borderColor: result.status === 'safe' ? 'var(--color-success)' : 
                                 result.status === 'warning' ? 'var(--color-warning)' : 
                                 'var(--color-danger)',
                    background: result.status === 'safe' ? 'rgba(54, 179, 126, 0.05)' : 
                                result.status === 'warning' ? 'rgba(255, 171, 0, 0.05)' : 
                                'rgba(222, 53, 11, 0.05)'
                  }}
                  onClick={() => {
                    if (result.count > 0) {
                      setSelectedVulnerability(result.vulnerability);
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-gray-900)' }}>
                        {result.vulnerability}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                        OWASP LLM #{idx + 1}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {result.status === 'safe' && <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />}
                      {result.status === 'warning' && <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />}
                      {result.status === 'failed' && <XCircle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                      {result.status === 'safe' ? '✅ 安全' : 
                       result.status === 'warning' ? '⚠️ 警告' : 
                       '❌ 失敗'}
                    </span>
                    {result.count > 0 && (
                      <span className="text-xs font-mono font-medium flex items-center gap-1" style={{ color: result.color }}>
                        發現 {result.count} 個漏洞
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-lg" style={{ background: 'rgba(0, 82, 204, 0.05)' }}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
                <div>
                  <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-gray-900)' }}>
                    建議修復 8 個弱點
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                    建議加強 Output Handler 驗證機制，並更新 Training Data 過濾規則。詳細報告已匯出至 <a href="#" className="underline" style={{ color: 'var(--color-primary-blue)' }}>security-report.pdf</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Overview Cards */}
      <div>
        <h3 className="mb-4" style={{ color: 'var(--color-gray-900)' }}>資安狀態總覽</h3>
        <div className="grid grid-cols-3 gap-4">
          {securityScans.map((scan, idx) => {
            const Icon = scan.icon;
            const isPassed = scan.status === 'passed';
            const isActive = scan.status === 'active';
            
            return (
              <div key={idx} className="card">
                <div className="card-body">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ 
                      background: isPassed ? 'rgba(54, 179, 126, 0.1)' : isActive ? 'rgba(255, 171, 0, 0.1)' : 'rgba(0, 82, 204, 0.1)'
                    }}>
                      <Icon className="w-6 h-6" style={{ 
                        color: isPassed ? 'var(--color-success)' : isActive ? 'var(--color-warning)' : 'var(--color-primary-blue)'
                      }} />
                    </div>
                    <span 
                      className={`badge ${isPassed ? 'badge-success' : isActive ? 'badge-warning' : 'badge-info'}`}
                      style={{ fontSize: '10px' }}
                    >
                      {isPassed ? '通過' : isActive ? '運行中' : '正常'}
                    </span>
                  </div>
                  
                  <h4 className="mb-2" style={{ color: 'var(--color-gray-900)', fontSize: '15px' }}>
                    {scan.name}
                  </h4>
                  
                  <div className="space-y-2 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--color-gray-400)' }}>最後檢查</span>
                      <span style={{ color: 'var(--color-gray-700)' }}>{scan.lastRun}</span>
                    </div>
                    
                    {scan.issues !== undefined && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--color-gray-400)' }}>發現問題</span>
                        <span className="font-mono" style={{ color: 'var(--color-success)' }}>
                          {scan.issues}
                        </span>
                      </div>
                    )}
                    
                    {scan.blocked !== undefined && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--color-gray-400)' }}>已攔截</span>
                        <span className="font-mono" style={{ color: 'var(--color-warning)' }}>
                          {scan.blocked} 次
                        </span>
                      </div>
                    )}
                    
                    {scan.attempts !== undefined && scan.success !== undefined && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--color-gray-400)' }}>防禦成功率</span>
                        <span className="font-mono" style={{ color: 'var(--color-success)' }}>
                          {((scan.success / scan.attempts) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Trend Chart */}
                  {scan.interceptRate && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                      <div className="text-xs mb-2" style={{ color: 'var(--color-gray-400)' }}>攔截率趨勢 (24h)</div>
                      <ResponsiveContainer width="100%" height={60}>
                        <LineChart data={scan.interceptRate}>
                          <Line 
                            type="monotone" 
                            dataKey="rate" 
                            stroke="var(--color-warning)" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* View Rules Link */}
                  {scan.hasRules && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                      <a 
                        href="#"
                        className="text-xs flex items-center gap-1 transition-colors"
                        style={{ color: 'var(--color-primary-blue)' }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        檢視護欄規則
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* Vulnerability Detail Modal */}
      {selectedVulnerability && currentVulnerabilityDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(100, 116, 139, 0.4)' }}
          onClick={() => setSelectedVulnerability(null)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
            style={{ background: 'var(--color-bg-white)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 p-6 border-b flex items-start justify-between" style={{ 
              background: 'var(--color-bg-white)',
              borderColor: 'var(--color-gray-200)'
            }}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-6 h-6" style={{ 
                    color: currentVulnerabilityDetail.severity === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)' 
                  }} />
                  <h3 style={{ color: 'var(--color-gray-900)' }}>
                    {selectedVulnerability}
                  </h3>
                  <span 
                    className={`badge ${currentVulnerabilityDetail.severity === 'danger' ? 'badge-danger' : 'badge-warning'}`}
                    style={{ fontSize: '11px' }}
                  >
                    {currentVulnerabilityDetail.severity === 'danger' ? '嚴重' : '警告'}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-gray-600)' }}>
                  {currentVulnerabilityDetail.description}
                </p>
              </div>
              <button 
                onClick={() => setSelectedVulnerability(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors ml-4"
              >
                <X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Affected Components */}
              <div>
                <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-900)' }}>
                  受影響的組件
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentVulnerabilityDetail.affectedComponents.map((component: string, idx: number) => (
                    <div 
                      key={idx}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ 
                        background: 'rgba(0, 82, 204, 0.1)',
                        color: 'var(--color-primary-blue)'
                      }}
                    >
                      {component}
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues Found */}
              <div>
                <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-900)' }}>
                  發現的問題
                </h4>
                <div className="space-y-3">
                  {currentVulnerabilityDetail.issues.map((issue: any, idx: number) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-lg border"
                      style={{ 
                        borderColor: issue.severity === 'Critical' ? 'var(--color-danger)' : 
                                    issue.severity === 'High' ? 'var(--color-warning)' : 
                                    'var(--color-gray-300)',
                        background: issue.severity === 'Critical' ? 'rgba(222, 53, 11, 0.05)' : 
                                   issue.severity === 'High' ? 'rgba(255, 171, 0, 0.05)' : 
                                   'var(--color-gray-50)'
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-2 py-1 rounded" style={{ 
                            background: 'var(--color-gray-100)',
                            color: 'var(--color-gray-700)'
                          }}>
                            {issue.id}
                          </span>
                          <span 
                            className={`badge ${
                              issue.severity === 'Critical' ? 'badge-danger' : 
                              issue.severity === 'High' ? 'badge-warning' : 
                              'badge-info'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {issue.severity}
                          </span>
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--color-gray-400)' }}>
                          {issue.location}
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-gray-900)' }}>
                        {issue.type}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--color-gray-600)' }}>
                        {issue.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendations */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
                  <h4 className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                    AI 修復建議
                  </h4>
                </div>
                <div className="space-y-3">
                  {currentVulnerabilityDetail.aiRecommendations.map((rec: any, idx: number) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-lg"
                      style={{ 
                        background: 'rgba(0, 184, 217, 0.05)',
                        border: '1px solid rgba(0, 184, 217, 0.2)'
                      }}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div 
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                          style={{ 
                            background: 'var(--color-teal)',
                            color: 'white'
                          }}
                        >
                          {rec.step}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                              {rec.title}
                            </span>
                            <span 
                              className={`badge ${
                                rec.priority === 'Critical' ? 'badge-danger' : 
                                rec.priority === 'High' ? 'badge-warning' : 
                                rec.priority === 'Medium' ? 'badge-info' : 
                                'badge-secondary'
                              }`}
                              style={{ fontSize: '10px' }}
                            >
                              {rec.priority === 'Critical' ? '緊急' : 
                               rec.priority === 'High' ? '高' : 
                               rec.priority === 'Medium' ? '中' : 
                               '低'}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--color-gray-600)' }}>
                            {rec.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Example */}
              <div>
                <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-gray-900)' }}>
                  修復代碼範例
                </h4>
                <div 
                  className="p-4 rounded-lg overflow-x-auto"
                  style={{ 
                    background: 'var(--color-gray-900)',
                    border: '1px solid var(--color-gray-700)'
                  }}
                >
                  <pre className="text-xs font-mono" style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {currentVulnerabilityDetail.codeExample}
                  </pre>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                <button 
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    background: 'var(--color-primary-blue)',
                    color: 'white'
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    標記為已修復
                  </div>
                </button>
                <button 
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    background: 'var(--color-gray-100)',
                    color: 'var(--color-gray-700)'
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    查看完整報告
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedVulnerability(null)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    background: 'var(--color-gray-100)',
                    color: 'var(--color-gray-700)'
                  }}
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}