import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Star, Sparkles, TrendingUp, Clock, Database, Eye, ChevronDown, ChevronUp, GitMerge, X, Filter, Send, Lightbulb, RotateCcw, FileText, Target, RefreshCw, History, TestTube2 } from 'lucide-react';

interface ReviewItem {
  id: string;
  timestamp: string;
  query: string;
  aiResponse: string;
  confidence: number;
  issues: string[];
  humanCorrection?: string;
  status: 'pending' | 'approved' | 'rejected' | 'corrected';
  routeReason: 'low_confidence' | 'sensitive_content' | 'negative_feedback' | 'pii_detected';
  retrievedChunks?: Array<{ source: string; content: string; relevance: number }>;
  reasoningSteps?: string[];
}

interface HistoricalTest {
  id: string;
  timestamp: string;
  query: string;
  aiResponse: string;
  accuracy: number;
  issues: string[];
  retrievedChunks: Array<{ source: string; content: string; relevance: number }>;
  reasoningSteps: string[];
}

export function HITLReviewInterface() {
  const [selectedItem, setSelectedItem] = useState<string>('review-001');
  const [humanCorrection, setHumanCorrection] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showTraceContext, setShowTraceContext] = useState(false);
  const [showPromptDiff, setShowPromptDiff] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [showCoPilot, setShowCoPilot] = useState(false);
  const [coPilotInstruction, setCoPilotInstruction] = useState('');
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [showHistoricalTest, setShowHistoricalTest] = useState(false);
  const [selectedTestItem, setSelectedTestItem] = useState<string | null>(null);

  const reviewItems: ReviewItem[] = [
    {
      id: 'review-001',
      timestamp: '2024-01-11 10:34',
      query: '請說明公司的退款政策',
      aiResponse: '根據公司政策，客戶可以在購買後 30 天內申請全額退款。退款將在 5-7 個工作日內處理完成。如需退款，請聯繫客服部門。',
      confidence: 0.62,
      issues: ['資訊不完整', '未提及例外情況'],
      status: 'pending',
      routeReason: 'low_confidence',
      retrievedChunks: [
        { source: 'policy-doc-2024.pdf (p.12)', content: '退款政策：購買後30天內可申請退款...', relevance: 0.85 },
        { source: 'faq-customer-service.md', content: '退款流程需要5-7個工作日...', relevance: 0.72 },
        { source: 'terms-of-service.pdf (p.5)', content: '特殊商品不適用退款政策...', relevance: 0.45 },
      ],
      reasoningSteps: [
        '步驟1: 檢索到 3 篇相關文件',
        '步驟2: 識別關鍵資訊：30天退款期限',
        '步驟3: 整合處理時間資訊：5-7個工作日',
        '步驟4: 生成回覆（未包含例外情況，準確率降低）'
      ]
    },
    {
      id: 'review-002',
      timestamp: '2024-01-11 10:28',
      query: '如何重設密碼？',
      aiResponse: '您可以點擊登入頁面的「忘記密碼」連結，系統會發送重設連結到您的註冊信箱。',
      confidence: 0.89,
      issues: [],
      status: 'approved',
      humanCorrection: '已確認內容正確',
      routeReason: 'negative_feedback',
      retrievedChunks: [
        { source: 'user-manual.pdf (p.8)', content: '密碼重設流程：點擊忘記密碼...', relevance: 0.95 },
      ],
      reasoningSteps: [
        '步驟1: 檢索到高相關度文件 (0.95)',
        '步驟2: 提取標準密碼重設流程',
        '步驟3: 生成簡潔回覆'
      ]
    },
    {
      id: 'review-003',
      timestamp: '2024-01-11 10:22',
      query: '請提供技術支援聯絡方式',
      aiResponse: '請撥打 0800-123-456 或寄信至 support@company.com',
      confidence: 0.45,
      issues: ['資訊可能過期', '需要驗證'],
      status: 'corrected',
      humanCorrection: '技術支援：0800-456-789（週一至週五 9:00-18:00）\\n信箱：tech-support@company.com\\n線上客服：https://support.company.com/chat',
      routeReason: 'low_confidence',
      retrievedChunks: [
        { source: 'contact-info-2023.md', content: '技術支援電話：0800-123-456...', relevance: 0.68 },
        { source: 'outdated-faq.pdf', content: '舊版聯絡資訊...', relevance: 0.52 },
      ],
      reasoningSteps: [
        '步驟1: 檢索到可能過期的文件',
        '步驟2: 發現文件日期為 2023 年',
        '步驟3: 準確率下降，標記為需人工驗證'
      ]
    },
    {
      id: 'review-004',
      timestamp: '2024-01-11 10:15',
      query: '產品保固期多久？',
      aiResponse: '本產品提供一年保固，涵蓋製造瑕疵。',
      confidence: 0.71,
      issues: ['缺少詳細條款'],
      status: 'pending',
      routeReason: 'sensitive_content',
      retrievedChunks: [
        { source: 'warranty-terms.pdf (p.3)', content: '標準保固期為一年...', relevance: 0.88 },
        { source: 'product-specs.pdf', content: '製造瑕疵涵蓋範圍...', relevance: 0.75 },
      ],
      reasoningSteps: [
        '步驟1: 檢索保固條款文件',
        '步驟2: 提取標準保固期限',
        '步驟3: 偵測到法律相關內容，觸發敏感詞掃描'
      ]
    },
    {
      id: 'review-005',
      timestamp: '2024-01-11 10:08',
      query: '客戶資料安全如何保障？包含個人信箱 john@example.com',
      aiResponse: '[已攔截] 偵測到個人識別資訊',
      confidence: 0.0,
      issues: ['PII 偵測', '包含敏感資訊'],
      status: 'pending',
      routeReason: 'pii_detected',
      retrievedChunks: [],
      reasoningSteps: [
        '步驟1: 輸入掃描偵測到 EMAIL 實體',
        '步驟2: 觸發 PII 防護規則',
        '步驟3: 拒絕處理並標記為人工審核'
      ]
    },
  ];

  const oldPrompt = `你是一個客服助手。請根據公司政策回答使用者問題。`;
  
  const newPrompt = `你是一個極具同理心的客服助手。請遵循以下原則：
1. 優先安撫使用者情緒，展現理解與關懷
2. 根據公司政策提供完整且準確的資訊
3. 主動提及可能的例外情況與注意事項
4. 若資訊不確定，請明確表示並建議聯繫人工客服`;

  // Prompt History Data
  const promptHistory = [
    {
      version: 'v1.0',
      timestamp: '2024-01-10 14:30',
      prompt: '你是一個客服助手。',
      performance: { accuracy: 72, satisfaction: 3.2 },
      status: 'archived',
      deployedBy: 'System',
      reason: '初始版本'
    },
    {
      version: 'v1.1',
      timestamp: '2024-01-10 16:45',
      prompt: '你是一個客服助手。請根據公司政策回答使用者問題。',
      performance: { accuracy: 80, satisfaction: 3.8 },
      status: 'archived',
      deployedBy: 'Admin',
      reason: '加入政策遵循指引'
    },
    {
      version: 'v1.2',
      timestamp: '2024-01-11 09:20',
      prompt: `你是一個客服助手。請遵循以下原則：
1. 根據公司政策回答問題
2. 保持專業態度
3. 提供準確資訊`,
      performance: { accuracy: 82, satisfaction: 3.9 },
      status: 'archived',
      deployedBy: 'APE System',
      reason: 'APE 自動優化 - 結構化指引'
    },
    {
      version: 'v2.0',
      timestamp: '2024-01-11 11:00',
      prompt: `你是一個極具同理心的客服助手。請遵循以下原則：
1. 優先安撫使用者情緒，展現理解與關懷
2. 根據公司政策提供完整且準確的資訊
3. 主動提及可能的例外情況與注意事項
4. 若資訊不確定，請明確表示並建議聯繫人工客服`,
      performance: { accuracy: 85, satisfaction: 4.2 },
      status: 'active',
      deployedBy: 'Admin',
      reason: '整合人工修正反饋 - 加強同理心與完整性'
    },
    {
      version: 'v2.1 (候選)',
      timestamp: '2024-01-11 12:15',
      prompt: `你是一個極具同理心且高效的客服助手。請嚴格遵循以下原則：
1. 首先安撫使用者情緒，展現真誠理解與關懷
2. 基於公司最新政策提供完整、準確且結構化的資訊
3. 主動說明可能的例外情況、注意事項與替代方案
4. 對於不確定的資訊，明確表達並提供人工客服聯繫方式
5. 回覆應清晰分段，重點使用項目符號或編號`,
      performance: { accuracy: 88, satisfaction: 4.5 },
      status: 'pending',
      deployedBy: 'APE System',
      reason: 'APE 自動優化 - 提升結構化與清晰度'
    }
  ];

  //歷史測試數據 (50筆)
  const historicalTests: HistoricalTest[] = Array.from({ length: 50 }, (_, i) => ({
    id: `test-${String(i + 1).padStart(3, '0')}`,
    timestamp: `2024-01-11 ${String(8 + Math.floor(i / 10)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
    query: [
      '如何重設密碼？',
      '請說明退款政策',
      '技術支援聯絡方式',
      '產品保固期限？',
      '如何更新個人資料？',
      '忘記帳號怎麼辦？',
      '如何取消訂單？',
      '配送需要多久時間？',
      '如何追蹤訂單？',
      '可以換貨嗎？'
    ][i % 10],
    aiResponse: '根據政策提供的完整回覆...',
    accuracy: 0.75 + Math.random() * 0.2,
    issues: Math.random() > 0.7 ? ['可能需要更新資訊'] : [],
    retrievedChunks: [
      { source: 'doc-001.pdf', content: '相關政策內容...', relevance: 0.8 + Math.random() * 0.15 },
      { source: 'faq-guide.md', content: '常見問題解答...', relevance: 0.7 + Math.random() * 0.2 }
    ],
    reasoningSteps: [
      '步驟1: 檢索相關文件',
      '步驟2: 分析查詢意圖',
      '步驟3: 整合資訊並生成回覆'
    ]
  }));

  const promptDiffImpact = {
    testSetScore: { old: 80, new: 85 },
    avgAccuracy: { old: 0.72, new: 0.81 },
    userSatisfaction: { old: 3.8, new: 4.2 }
  };

  const selectedReview = reviewItems.find(item => item.id === selectedItem);
  const selectedTest = historicalTests.find(test => test.id === selectedTestItem);

  const apeTimeline = [
    { time: '09:45', event: '偵測到低準確率回覆', type: 'detection', status: 'completed' },
    { time: '10:12', event: '人工修正已提交（3筆相似案例）', type: 'correction', status: 'completed' },
    { time: '10:15', event: 'Prompt 優化建議生成', type: 'optimization', status: 'completed' },
    { time: '10:18', event: '候選 Prompt 等待審核', type: 'pending', status: 'pending' },
  ];

  const goldenDataset = [
    { question: '如何重設密碼？', verified: true, usage: 23, contribution: '+12% accuracy' },
    { question: '退款政策說明', verified: true, usage: 18, contribution: '+8% accuracy' },
    { question: '技術支援聯絡方式', verified: true, usage: 15, contribution: '+5% accuracy' },
    { question: '產品保固條款', verified: false, usage: 0, contribution: 'N/A' },
  ];

  const handleAction = (action: 'approve' | 'reject' | 'addToGolden') => {
    setActiveAction(action);
    setTimeout(() => setActiveAction(null), 1500);
  };

  const handleCoPilotGenerate = () => {
    if (coPilotInstruction) {
      setHumanCorrection(`[AI 輔助重寫] 根據您的指示"${coPilotInstruction}"，建議回覆如下：\\n\\n${selectedReview?.aiResponse}\\n\\n（語氣已調整為更委婉）`);
      setShowCoPilot(false);
      setCoPilotInstruction('');
    }
  };

  const filteredItems = reviewItems.filter(item => {
    if (filterType === 'all') return true;
    return item.routeReason === filterType;
  });

  const getRouteReasonBadge = (reason: string) => {
    const badges = {
      'low_confidence': { label: '準確率不足', color: 'var(--color-warning)', bg: 'rgba(255, 171, 0, 0.1)' },
      'sensitive_content': { label: '敏感詞觸發', color: 'var(--color-danger)', bg: 'rgba(222, 53, 11, 0.1)' },
      'negative_feedback': { label: '用戶負評', color: 'var(--color-primary-blue)', bg: 'rgba(0, 82, 204, 0.1)' },
      'pii_detected': { label: 'PII 偵測', color: 'var(--color-danger)', bg: 'rgba(222, 53, 11, 0.1)' },
    };
    return badges[reason as keyof typeof badges] || badges.low_confidence;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                background: 'rgba(255, 171, 0, 0.1)' 
              }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>待審核</div>
                <div className="text-2xl font-mono mt-0.5" style={{ color: 'var(--color-warning)' }}>
                  {reviewItems.filter(i => i.status === 'pending').length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                background: 'rgba(54, 179, 126, 0.1)' 
              }}>
                <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>已核准</div>
                <div className="text-2xl font-mono mt-0.5" style={{ color: 'var(--color-success)' }}>
                  {reviewItems.filter(i => i.status === 'approved').length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                background: 'rgba(0, 82, 204, 0.1)' 
              }}>
                <Sparkles className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>已修正</div>
                <div className="text-2xl font-mono mt-0.5" style={{ color: 'var(--color-primary-blue)' }}>
                  {reviewItems.filter(i => i.status === 'corrected').length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                background: 'rgba(0, 184, 217, 0.1)' 
              }}>
                <Star className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
              </div>
              <div className="flex-1">
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>黃金資料集</div>
                <div className="text-2xl font-mono mt-0.5" style={{ color: 'var(--color-teal)' }}>
                  {goldenDataset.filter(d => d.verified).length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Review Interface */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Review List */}
        <div className="col-span-3">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h4 style={{ color: 'var(--color-gray-900)' }}>審核佇列</h4>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-2 py-1 rounded text-xs border"
                    style={{ 
                      borderColor: 'var(--color-gray-300)',
                      background: 'var(--color-bg-white)',
                      color: 'var(--color-gray-700)'
                    }}
                  >
                    <option value="all">全部</option>
                    <option value="low_confidence">準確率不足</option>
                    <option value="sensitive_content">敏感詞</option>
                    <option value="negative_feedback">負評</option>
                    <option value="pii_detected">PII</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-gray-200)' }}>
              {filteredItems.map((item) => {
                const routeBadge = getRouteReasonBadge(item.routeReason);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item.id)}
                    className="w-full text-left p-4 transition-all"
                    style={{
                      background: selectedItem === item.id ? 'rgba(0, 82, 204, 0.05)' : 'transparent',
                      borderLeft: selectedItem === item.id ? '3px solid var(--color-primary-blue)' : '3px solid transparent',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-mono" style={{ color: 'var(--color-gray-400)' }}>
                        {item.id}
                      </span>
                      <span 
                        className={`badge ${
                          item.status === 'approved' ? 'badge-success' :
                          item.status === 'corrected' ? 'badge-info' :
                          item.status === 'rejected' ? 'badge-danger' :
                          'badge-warning'
                        }`}
                        style={{ fontSize: '9px', padding: '2px 6px' }}
                      >
                        {item.status === 'approved' ? '已核准' :
                         item.status === 'corrected' ? '已修正' :
                         item.status === 'rejected' ? '已拒絕' :
                         '待處理'}
                      </span>
                    </div>
                    <div className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-gray-700)' }}>
                      {item.query}
                    </div>
                    
                    {/* Route Reason Badge */}
                    <div className="mb-2">
                      <span 
                        className="text-xs px-2 py-1 rounded"
                        style={{ 
                          background: routeBadge.bg,
                          color: routeBadge.color,
                          fontSize: '10px'
                        }}
                      >
                        🏷️ {routeBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.confidence < 0.7 && (
                        <AlertTriangle className="w-3 h-3" style={{ color: 'var(--color-warning)' }} />
                      )}
                      <span className="text-xs font-mono" style={{ 
                        color: item.confidence < 0.7 ? 'var(--color-warning)' : 'var(--color-success)' 
                      }}>
                        準確率 {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Split-Screen Comparison */}
        <div className="col-span-6">
          {selectedReview && (
            <div className="space-y-4">
              {/* Query */}
              <div className="card">
                <div className="card-header" style={{ background: 'var(--color-gray-50)' }}>
                  <div className="flex items-center justify-between">
                    <h4 style={{ color: 'var(--color-gray-900)' }}>使用者查詢</h4>
                    <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                      {selectedReview.timestamp}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <p style={{ color: 'var(--color-gray-700)' }}>
                    {selectedReview.query}
                  </p>
                </div>
              </div>

              {/* AI Output vs Human Correction */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left: AI Output with Trace Context */}
                <div className="card" style={{ 
                  borderColor: selectedReview.confidence < 0.7 ? 'var(--color-warning)' : 'var(--color-gray-200)',
                  borderWidth: selectedReview.confidence < 0.7 ? '2px' : '1px'
                }}>
                  <div className="card-header" style={{ 
                    background: selectedReview.confidence < 0.7 ? 'rgba(255, 171, 0, 0.05)' : 'var(--color-gray-50)' 
                  }}>
                    <div className="flex items-center justify-between">
                      <h4 style={{ color: 'var(--color-gray-900)', fontSize: '14px' }}>
                        AI 生成回覆
                      </h4>
                      {selectedReview.confidence < 0.7 && (
                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          準確率不足
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    <p className="text-sm mb-4" style={{ color: 'var(--color-gray-700)', lineHeight: '1.6' }}>
                      {selectedReview.aiResponse}
                    </p>

                    {selectedReview.issues.length > 0 && (
                      <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-gray-200)' }}>
                        <div className="text-xs font-medium" style={{ color: 'var(--color-gray-700)' }}>
                          偵測到的問題：
                        </div>
                        {selectedReview.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ 
                              background: 'var(--color-warning)' 
                            }} />
                            <span style={{ color: 'var(--color-gray-600)' }}>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Trace Context Toggle */}
                    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                      <button
                        onClick={() => setShowTraceContext(!showTraceContext)}
                        className="w-full flex items-center justify-between text-xs font-medium transition-colors hover:bg-gray-50 p-2 rounded"
                        style={{ color: 'var(--color-primary-blue)' }}
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          查看推論過程 (Trace Context)
                        </div>
                        {showTraceContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showTraceContext && (
                        <div className="mt-3 space-y-3">
                          {/* Retrieved Chunks */}
                          <div>
                            <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>
                              📄 Retrieved Chunks (檢索來源)
                            </div>
                            {selectedReview.retrievedChunks && selectedReview.retrievedChunks.length > 0 ? (
                              <div className="space-y-2">
                                {selectedReview.retrievedChunks.map((chunk, idx) => (
                                  <div 
                                    key={idx}
                                    className="p-2 rounded border text-xs"
                                    style={{ 
                                      borderColor: chunk.relevance > 0.8 ? 'var(--color-success)' : 'var(--color-warning)',
                                      background: 'var(--color-gray-50)'
                                    }}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium" style={{ color: 'var(--color-gray-700)' }}>
                                        {chunk.source}
                                      </span>
                                      <span className="font-mono" style={{ 
                                        color: chunk.relevance > 0.8 ? 'var(--color-success)' : 'var(--color-warning)' 
                                      }}>
                                        相關度: {chunk.relevance.toFixed(2)}
                                      </span>
                                    </div>
                                    <div style={{ color: 'var(--color-gray-600)' }}>
                                      {chunk.content}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs p-2 rounded" style={{ 
                                background: 'var(--color-gray-50)',
                                color: 'var(--color-gray-400)' 
                              }}>
                                無檢索結果
                              </div>
                            )}
                          </div>

                          {/* Reasoning Steps */}
                          <div>
                            <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>
                              🧠 Reasoning Steps (思維鏈)
                            </div>
                            {selectedReview.reasoningSteps && (
                              <div className="space-y-1">
                                {selectedReview.reasoningSteps.map((step, idx) => (
                                  <div 
                                    key={idx}
                                    className="flex items-start gap-2 text-xs p-2 rounded"
                                    style={{ background: 'var(--color-gray-50)' }}
                                  >
                                    <div 
                                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium"
                                      style={{ 
                                        background: 'var(--color-primary-blue)',
                                        color: 'white'
                                      }}
                                    >
                                      {idx + 1}
                                    </div>
                                    <span style={{ color: 'var(--color-gray-700)' }}>{step}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--color-gray-400)' }}>準確率評分</span>
                        <span className="font-mono" style={{ 
                          color: selectedReview.confidence < 0.7 ? 'var(--color-warning)' : 'var(--color-success)' 
                        }}>
                          {(selectedReview.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="progress-bar mt-2">
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${selectedReview.confidence * 100}%`,
                            background: selectedReview.confidence < 0.7 ? 'var(--color-warning)' : 'var(--color-success)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Human Correction with Co-Pilot */}
                <div className="card" style={{ borderColor: 'var(--color-success)', borderWidth: '2px' }}>
                  <div className="card-header" style={{ background: 'rgba(54, 179, 126, 0.05)' }}>
                    <div className="flex items-center justify-between">
                      <h4 style={{ color: 'var(--color-gray-900)', fontSize: '14px' }}>
                        人工修正回覆
                      </h4>
                      {selectedReview.status === 'pending' && (
                        <button
                          onClick={() => setShowCoPilot(!showCoPilot)}
                          className="px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
                          style={{ 
                            background: showCoPilot ? 'var(--color-primary-blue)' : 'var(--color-gray-100)',
                            color: showCoPilot ? 'white' : 'var(--color-gray-700)'
                          }}
                        >
                          <Lightbulb className="w-3 h-3" />
                          AI 輔助
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    {/* Co-Pilot Panel */}
                    {showCoPilot && selectedReview.status === 'pending' && (
                      <div className="mb-3 p-3 rounded-lg" style={{ 
                        background: 'rgba(0, 82, 204, 0.05)',
                        border: '1px solid var(--color-primary-blue)'
                      }}>
                        <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-primary-blue)' }}>
                          ✨ AI Co-Pilot 輔助修正
                        </div>
                        <input
                          type="text"
                          value={coPilotInstruction}
                          onChange={(e) => setCoPilotInstruction(e.target.value)}
                          placeholder="例如：語氣委婉一點、增加例外情況說明..."
                          className="w-full px-3 py-2 rounded text-sm border mb-2"
                          style={{ 
                            borderColor: 'var(--color-gray-300)',
                            background: 'var(--color-bg-white)'
                          }}
                        />
                        <button
                          onClick={handleCoPilotGenerate}
                          className="w-full px-3 py-2 rounded text-xs flex items-center justify-center gap-2"
                          style={{ 
                            background: 'var(--color-primary-blue)',
                            color: 'white',
                            border: 'none'
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          生成修正建議
                        </button>
                      </div>
                    )}

                    <textarea
                      value={selectedReview.status === 'corrected' ? selectedReview.humanCorrection : humanCorrection}
                      onChange={(e) => setHumanCorrection(e.target.value)}
                      placeholder="在此輸入修正後的回覆內容..."
                      className="w-full px-3 py-2 rounded-lg border resize-none text-sm"
                      style={{
                        borderColor: 'var(--color-gray-300)',
                        background: 'var(--color-bg-white)',
                        minHeight: showCoPilot ? '120px' : '180px',
                        color: 'var(--color-gray-700)',
                        lineHeight: '1.6'
                      }}
                      disabled={selectedReview.status !== 'pending'}
                    />

                    <div className="mt-4 pt-3 border-t text-xs" style={{ 
                      borderColor: 'var(--color-gray-200)',
                      color: 'var(--color-gray-400)' 
                    }}>
                      💡 提示：請提供完整且準確的回覆，這將用於改進 AI 模型
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Enhanced */}
              {selectedReview.status === 'pending' && (
                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleAction('approve')}
                        className="flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                        style={{ 
                          background: activeAction === 'approve' ? 'var(--color-success)' : 'rgba(54, 179, 126, 0.1)',
                          color: activeAction === 'approve' ? 'white' : 'var(--color-success)',
                          border: '2px solid var(--color-success)'
                        }}
                      >
                        <CheckCircle className="w-5 h-5" />
                        <div className="text-left">
                          <div>核准並發布</div>
                          <div className="text-xs opacity-80">Approve & Resolve</div>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleAction('reject')}
                        className="flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                        style={{ 
                          background: activeAction === 'reject' ? 'var(--color-danger)' : 'rgba(222, 53, 11, 0.1)',
                          color: activeAction === 'reject' ? 'white' : 'var(--color-danger)',
                          border: '2px solid var(--color-danger)'
                        }}
                      >
                        <XCircle className="w-5 h-5" />
                        拒絕
                      </button>

                      <button 
                        onClick={() => handleAction('addToGolden')}
                        className="flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                        style={{ 
                          background: activeAction === 'addToGolden' ? 'var(--color-teal)' : 'rgba(0, 184, 217, 0.1)',
                          color: activeAction === 'addToGolden' ? 'white' : 'var(--color-teal)',
                          border: '2px solid var(--color-teal)'
                        }}
                      >
                        <Database className="w-5 h-5" />
                        <div className="text-left">
                          <div>提交至知識庫</div>
                          <div className="text-xs opacity-80">Commit & Train</div>
                        </div>
                      </button>
                    </div>
                    {activeAction === 'addToGolden' && (
                      <div className="mt-3 p-2 rounded text-xs" style={{ 
                        background: 'rgba(0, 184, 217, 0.1)',
                        color: 'var(--color-teal)'
                      }}>
                        ✓ 已加入測試集，正在背景執行回歸測試...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Optimization Timeline & Golden Dataset */}
        <div className="col-span-3 space-y-4">
          {/* APE Timeline with Prompt Diff */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
                <h4 style={{ color: 'var(--color-gray-900)', fontSize: '14px' }}>
                  自動提示優化 (APE)
                </h4>
              </div>
            </div>
            <div className="p-4">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-2 top-2 bottom-2 w-0.5" style={{ background: 'var(--color-gray-200)' }} />
                
                <div className="space-y-4 relative">
                  {apeTimeline.map((event, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div 
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 z-10"
                        style={{ 
                          background: 'var(--color-bg-white)',
                          borderColor: event.status === 'pending' ? 'var(--color-warning)' :
                                      event.type === 'deployment' ? 'var(--color-success)' : 
                                      event.type === 'optimization' ? 'var(--color-primary-blue)' :
                                      'var(--color-gray-300)'
                        }}
                      />
                      <div className="flex-1 pb-4">
                        <div className="text-xs font-mono mb-1" style={{ color: 'var(--color-gray-400)' }}>
                          {event.time}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-gray-700)' }}>
                          {event.event}
                        </div>
                        {event.status === 'pending' && (
                          <span className="text-xs px-2 py-0.5 rounded mt-1 inline-block" style={{
                            background: 'rgba(255, 171, 0, 0.1)',
                            color: 'var(--color-warning)'
                          }}>
                            ⏳ 等待審核
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prompt Diff Button */}
              <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-gray-200)' }}>
                <button
                  onClick={() => setShowPromptDiff(!showPromptDiff)}
                  className="w-full px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-all hover:shadow-sm"
                  style={{ 
                    background: 'var(--color-gray-50)',
                    border: '1px solid var(--color-gray-200)',
                    color: 'var(--color-gray-700)'
                  }}
                >
                  <GitMerge className="w-4 h-4" />
                  比對 Prompt 差異
                </button>

                {/* History Prompt Button */}
                <button
                  onClick={() => setShowPromptHistory(!showPromptHistory)}
                  className="w-full px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-all hover:shadow-sm"
                  style={{ 
                    background: 'var(--color-gray-50)',
                    border: '1px solid var(--color-gray-200)',
                    color: 'var(--color-gray-700)'
                  }}
                >
                  <History className="w-4 h-4" />
                  歷史 Prompt
                </button>

                {showPromptDiff && (
                  <div className="p-3 rounded-lg border" style={{ 
                    borderColor: 'var(--color-gray-200)',
                    background: 'var(--color-gray-50)'
                  }}>
                    <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>
                      Diff View
                    </div>
                    
                    {/* Old Prompt */}
                    <div className="mb-2 p-2 rounded border" style={{ 
                      borderColor: 'var(--color-danger)',
                      background: 'rgba(222, 53, 11, 0.05)'
                    }}>
                      <div className="text-xs font-mono mb-1" style={{ color: 'var(--color-danger)' }}>
                        🔴 Old Prompt
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-gray-700)' }}>
                        {oldPrompt}
                      </div>
                    </div>

                    {/* New Prompt */}
                    <div className="mb-3 p-2 rounded border" style={{ 
                      borderColor: 'var(--color-success)',
                      background: 'rgba(54, 179, 126, 0.05)'
                    }}>
                      <div className="text-xs font-mono mb-1" style={{ color: 'var(--color-success)' }}>
                        🟢 New Prompt
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-gray-700)' }}>
                        {newPrompt}
                      </div>
                    </div>

                    {/* Impact Analysis */}
                    <div className="p-2 rounded mb-3" style={{ background: 'rgba(0, 82, 204, 0.05)' }}>
                      <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-primary-blue)' }}>
                        📊 Impact Analysis
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span style={{ color: 'var(--color-gray-600)' }}>測試集分數:</span>
                          <span style={{ color: 'var(--color-success)' }}>
                            {promptDiffImpact.testSetScore.old}% → {promptDiffImpact.testSetScore.new}% 
                            <span className="ml-1">↑{promptDiffImpact.testSetScore.new - promptDiffImpact.testSetScore.old}%</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span style={{ color: 'var(--color-gray-600)' }}>平均準確率:</span>
                          <span style={{ color: 'var(--color-success)' }}>
                            {promptDiffImpact.avgAccuracy.old} → {promptDiffImpact.avgAccuracy.new}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span style={{ color: 'var(--color-gray-600)' }}>用戶滿意度:</span>
                          <span style={{ color: 'var(--color-success)' }}>
                            {promptDiffImpact.userSatisfaction.old} → {promptDiffImpact.userSatisfaction.new} ⭐
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                        style={{ 
                          background: 'var(--color-success)',
                          color: 'white',
                          border: 'none'
                        }}
                      >
                        <Send className="w-3 h-3" />
                        部署
                      </button>
                      <button
                        className="flex-1 px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                        style={{ 
                          background: 'var(--color-danger)',
                          color: 'white',
                          border: 'none'
                        }}
                      >
                        <X className="w-3 h-3" />
                        拒絕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Golden Dataset with Contribution */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
                  <h4 style={{ color: 'var(--color-gray-900)', fontSize: '14px' }}>
                    黃金資料集
                  </h4>
                </div>
                <button
                  className="px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{ 
                    background: 'var(--color-teal)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  <RefreshCw className="w-3 h-3" />
                  評測
                </button>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {goldenDataset.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg border"
                  style={{ 
                    borderColor: item.verified ? 'var(--color-teal)' : 'var(--color-gray-200)',
                    background: item.verified ? 'rgba(0, 184, 217, 0.03)' : 'var(--color-gray-50)'
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-xs line-clamp-2 flex-1" style={{ color: 'var(--color-gray-700)' }}>
                      {item.question}
                    </div>
                    {item.verified && (
                      <Star className="w-3.5 h-3.5 ml-2 flex-shrink-0" style={{ color: 'var(--color-teal)' }} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--color-gray-400)' }}>
                        使用：
                      </span>
                      <span className="font-mono" style={{ color: 'var(--color-gray-700)' }}>
                        {item.usage} 次
                      </span>
                    </div>
                    {item.verified && (
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
                        <span className="font-medium" style={{ color: 'var(--color-success)' }}>
                          {item.contribution}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt History Modal */}
      {showPromptHistory && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(100, 116, 139, 0.4)' }}
          onClick={() => setShowPromptHistory(false)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
            style={{ background: 'var(--color-bg-white)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 p-6 border-b flex items-center justify-between" style={{ 
              background: 'var(--color-bg-white)',
              borderColor: 'var(--color-gray-200)'
            }}>
              <div className="flex items-center gap-3">
                <History className="w-6 h-6" style={{ color: 'var(--color-primary-blue)' }} />
                <div>
                  <h3 style={{ color: 'var(--color-gray-900)' }}>歷史 Prompt 記錄</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-gray-400)' }}>
                    共 {promptHistory.length} 個版本
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPromptHistory(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-4">
                {promptHistory.map((history, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-lg border"
                    style={{ 
                      borderColor: history.status === 'active' ? 'var(--color-success)' : 
                                  history.status === 'pending' ? 'var(--color-warning)' : 
                                  'var(--color-gray-200)',
                      background: history.status === 'active' ? 'rgba(54, 179, 126, 0.05)' :
                                 history.status === 'pending' ? 'rgba(255, 171, 0, 0.05)' :
                                 'var(--color-gray-50)'
                    }}
                  >
                    {/* Version Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="px-3 py-1 rounded-full text-xs font-mono font-medium"
                          style={{ 
                            background: history.status === 'active' ? 'var(--color-success)' :
                                       history.status === 'pending' ? 'var(--color-warning)' :
                                       'var(--color-gray-400)',
                            color: 'white'
                          }}
                        >
                          {history.version}
                        </div>
                        {history.status === 'active' && (
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            目前使用
                          </span>
                        )}
                        {history.status === 'pending' && (
                          <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                            <Clock className="w-3 h-3 mr-1" />
                            等待審核
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-gray-400)' }}>
                        {history.timestamp}
                      </span>
                    </div>

                    {/* Prompt Content */}
                    <div className="mb-3 p-3 rounded-lg" style={{ 
                      background: 'var(--color-bg-white)',
                      border: '1px solid var(--color-gray-200)'
                    }}>
                      <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-400)' }}>
                        PROMPT CONTENT
                      </div>
                      <div className="text-sm whitespace-pre-wrap" style={{ 
                        color: 'var(--color-gray-700)',
                        lineHeight: '1.6'
                      }}>
                        {history.prompt}
                      </div>
                    </div>

                    {/* Performance Metrics - 移除信心度欄位 */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="p-2 rounded" style={{ background: 'rgba(0, 82, 204, 0.05)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>準確率</div>
                        <div className="text-lg font-mono font-medium" style={{ color: 'var(--color-primary-blue)' }}>
                          {history.performance.accuracy}%
                        </div>
                      </div>
                      <div className="p-2 rounded" style={{ background: 'rgba(255, 171, 0, 0.05)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>滿意度</div>
                        <div className="text-lg font-mono font-medium" style={{ color: 'var(--color-warning)' }}>
                          {history.performance.satisfaction.toFixed(1)} ⭐
                        </div>
                      </div>
                    </div>

                    {/* Deployment Info */}
                    <div className="flex items-center justify-between text-xs pt-3 border-t" style={{ 
                      borderColor: 'var(--color-gray-200)'
                    }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--color-gray-400)' }}>部署者：</span>
                        <span className="font-medium" style={{ color: 'var(--color-gray-700)' }}>
                          {history.deployedBy}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--color-gray-400)' }}>原因：</span>
                        <span style={{ color: 'var(--color-gray-700)' }}>
                          {history.reason}
                        </span>
                      </div>
                    </div>

                    {/* Historical Test Button for Active Version */}
                    {history.status === 'active' && (
                      <div className="mt-3 pt-3 border-t" style={{ 
                        borderColor: 'var(--color-gray-200)'
                      }}>
                        <button
                          onClick={() => setShowHistoricalTest(true)}
                          className="w-full px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                          style={{ 
                            background: 'var(--color-primary-blue)',
                            color: 'white',
                            border: 'none'
                          }}
                        >
                          <TestTube2 className="w-3 h-3" />
                          歷史測試
                        </button>
                      </div>
                    )}

                    {/* Action Buttons for Pending */}
                    {history.status === 'pending' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ 
                        borderColor: 'var(--color-gray-200)'
                      }}>
                        <button
                          className="flex-1 px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                          style={{ 
                            background: 'var(--color-success)',
                            color: 'white',
                            border: 'none'
                          }}
                        >
                          <Send className="w-3 h-3" />
                          部署此版本
                        </button>
                        <button
                          className="flex-1 px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                          style={{ 
                            background: 'var(--color-gray-100)',
                            color: 'var(--color-gray-700)'
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          復原到此版本
                        </button>
                      </div>
                    )}

                    {/* Action Button for Archived */}
                    {history.status === 'archived' && (
                      <div className="mt-3 pt-3 border-t" style={{ 
                        borderColor: 'var(--color-gray-200)'
                      }}>
                        <button
                          className="w-full px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                          style={{ 
                            background: 'var(--color-gray-100)',
                            color: 'var(--color-gray-700)'
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          復原到此版本
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 p-4 border-t flex items-center justify-between" style={{ 
              background: 'var(--color-bg-white)',
              borderColor: 'var(--color-gray-200)'
            }}>
              <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                💡 提示：點擊「復原到此版本」可將舊版 Prompt 設為候選版本
              </div>
              <button 
                onClick={() => setShowPromptHistory(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
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
      )}

      {/* Historical Test Modal */}
      {showHistoricalTest && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(100, 116, 139, 0.4)' }}
          onClick={() => {
            setShowHistoricalTest(false);
            setSelectedTestItem(null);
          }}
        >
          <div 
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
            style={{ background: 'var(--color-bg-white)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 p-6 border-b flex items-center justify-between" style={{ 
              background: 'var(--color-bg-white)',
              borderColor: 'var(--color-gray-200)'
            }}>
              <div className="flex items-center gap-3">
                <TestTube2 className="w-6 h-6" style={{ color: 'var(--color-primary-blue)' }} />
                <div>
                  <h3 style={{ color: 'var(--color-gray-900)' }}>歷史測試結果</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-gray-400)' }}>
                    先前 50 筆對話測試 - 版本 v2.0
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowHistoricalTest(false);
                  setSelectedTestItem(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-12 gap-6">
              {/* Left: Test List */}
              <div className="col-span-4">
                <div className="card">
                  <div className="card-header">
                    <h4 style={{ color: 'var(--color-gray-900)' }}>測試案例列表</h4>
                  </div>
                  <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: 'var(--color-gray-200)' }}>
                    {historicalTests.map((test) => (
                      <button
                        key={test.id}
                        onClick={() => setSelectedTestItem(test.id)}
                        className="w-full text-left p-3 transition-all"
                        style={{
                          background: selectedTestItem === test.id ? 'rgba(0, 82, 204, 0.05)' : 'transparent',
                          borderLeft: selectedTestItem === test.id ? '3px solid var(--color-primary-blue)' : '3px solid transparent',
                        }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-mono" style={{ color: 'var(--color-gray-400)' }}>
                            {test.id}
                          </span>
                          <span className="text-xs font-mono" style={{ 
                            color: test.accuracy > 0.8 ? 'var(--color-success)' : test.accuracy > 0.6 ? 'var(--color-warning)' : 'var(--color-danger)'
                          }}>
                            {(test.accuracy * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs mb-1 line-clamp-2" style={{ color: 'var(--color-gray-700)' }}>
                          {test.query}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                          {test.timestamp}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Test Details */}
              <div className="col-span-8">
                {selectedTest ? (
                  <div className="space-y-4">
                    {/* Query */}
                    <div className="card">
                      <div className="card-header">
                        <div className="flex items-center justify-between">
                          <h4 style={{ color: 'var(--color-gray-900)' }}>測試查詢</h4>
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                            {selectedTest.timestamp}
                          </span>
                        </div>
                      </div>
                      <div className="card-body">
                        <p style={{ color: 'var(--color-gray-700)' }}>
                          {selectedTest.query}
                        </p>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="card">
                      <div className="card-header">
                        <div className="flex items-center justify-between">
                          <h4 style={{ color: 'var(--color-gray-900)' }}>AI 回覆</h4>
                          <span className={`badge ${selectedTest.accuracy > 0.8 ? 'badge-success' : selectedTest.accuracy > 0.6 ? 'badge-warning' : 'badge-danger'}`}>
                            準確率: {(selectedTest.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="card-body">
                        <p className="text-sm mb-4" style={{ color: 'var(--color-gray-700)', lineHeight: '1.6' }}>
                          {selectedTest.aiResponse}
                        </p>

                        {selectedTest.issues.length > 0 && (
                          <div className="pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                            <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>
                              偵測到的問題：
                            </div>
                            {selectedTest.issues.map((issue, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ 
                                  background: 'var(--color-warning)' 
                                }} />
                                <span style={{ color: 'var(--color-gray-600)' }}>{issue}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reasoning Process */}
                    <div className="card">
                      <div className="card-header">
                        <h4 style={{ color: 'var(--color-gray-900)' }}>推論過程</h4>
                      </div>
                      <div className="card-body space-y-3">
                        {/* Retrieved Chunks */}
                        <div>
                          <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>
                            📄 Retrieved Chunks (檢索來源)
                          </div>
                          <div className="space-y-2">
                            {selectedTest.retrievedChunks.map((chunk, idx) => (
                              <div 
                                key={idx}
                                className="p-2 rounded border text-xs"
                                style={{ 
                                  borderColor: chunk.relevance > 0.8 ? 'var(--color-success)' : 'var(--color-warning)',
                                  background: 'var(--color-gray-50)'
                                }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium" style={{ color: 'var(--color-gray-700)' }}>
                                    {chunk.source}
                                  </span>
                                  <span className="font-mono" style={{ 
                                    color: chunk.relevance > 0.8 ? 'var(--color-success)' : 'var(--color-warning)' 
                                  }}>
                                    相關度: {chunk.relevance.toFixed(2)}
                                  </span>
                                </div>
                                <div style={{ color: 'var(--color-gray-600)' }}>
                                  {chunk.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Reasoning Steps */}
                        <div>
                          <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>
                            🧠 Reasoning Steps (思維鏈)
                          </div>
                          <div className="space-y-1">
                            {selectedTest.reasoningSteps.map((step, idx) => (
                              <div 
                                key={idx}
                                className="flex items-start gap-2 text-xs p-2 rounded"
                                style={{ background: 'var(--color-gray-50)' }}
                              >
                                <div 
                                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium"
                                  style={{ 
                                    background: 'var(--color-primary-blue)',
                                    color: 'white'
                                  }}
                                >
                                  {idx + 1}
                                </div>
                                <span style={{ color: 'var(--color-gray-700)' }}>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card h-full flex items-center justify-center">
                    <div className="text-center" style={{ color: 'var(--color-gray-400)' }}>
                      <TestTube2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>請從左側選擇一個測試案例查看詳情</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
