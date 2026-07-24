import React, { useState } from 'react';
import { 
  FileText, CheckCircle, Clock, AlertCircle, Network, Database, Search, 
  RefreshCw, Trash2, Settings, Eye, Play, AlertTriangle, Lock, 
  FileSearch, TrendingUp, Link2, Layers, Sliders, Image, Upload
} from 'lucide-react';

type ViewMode = 'overview' | 'chunk-preview' | 'retrieval-test' | 'entity-resolution' | 'quality-issues';

interface ChunkData {
  id: string;
  content: string;
  pageNum: number;
  startChar: number;
  endChar: number;
  tokens: number;
  hasIssue?: boolean;
  issueType?: string;
}

interface EntityCandidate {
  id: string;
  entities: string[];
  confidence: number;
  sourceChunks: string[];
  status: 'pending' | 'approved' | 'rejected';
}

export function DataPipelineDashboard() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(50);
  const [hybridAlpha, setHybridAlpha] = useState(0.5);
  const [testQuery, setTestQuery] = useState('');
  const [showEmbeddingWarning, setShowEmbeddingWarning] = useState(false);
  const [sourceType, setSourceType] = useState<'document' | 'image'>('document');
  const [imageParseMode, setImageParseMode] = useState<'OCR' | 'VLM' | 'OCR+VLM'>('OCR');

  const uploadedFiles = [
    { 
      id: 1, 
      name: '金融監管法規 2024.pdf', 
      status: 'completed', 
      pages: 342, 
      entities: 1247,
      chunks: 4234,
      uploadTime: '2024-01-11 09:23',
      parser: 'IBM Docling',
      hasQualityIssues: false
    },
    { 
      id: 2, 
      name: '企業內部政策手冊.pdf', 
      status: 'processing', 
      pages: 156, 
      entities: 0,
      chunks: 0,
      uploadTime: '2024-01-11 10:15',
      parser: 'IBM Docling',
      progress: 67,
      hasQualityIssues: false
    },
    { 
      id: 3, 
      name: '醫療器材認證標準.docx', 
      status: 'completed', 
      pages: 89, 
      entities: 523,
      chunks: 1456,
      uploadTime: '2024-01-10 16:42',
      parser: 'IBM Docling',
      hasQualityIssues: true,
      qualityIssueCount: 3
    },
    { 
      id: 4, 
      name: '產品技術規格書.pdf', 
      status: 'queued', 
      pages: 0, 
      entities: 0,
      chunks: 0,
      uploadTime: '2024-01-11 10:30',
      parser: 'IBM Docling',
      hasQualityIssues: false
    },
  ];

  const mockChunks: ChunkData[] = [
    {
      id: 'chunk-1',
      content: '第一章 金融監管總則 1.1 目的與範圍 本法規旨在建立健全的金融監管體系，保護投資者權益...',
      pageNum: 1,
      startChar: 0,
      endChar: 512,
      tokens: 128,
      hasIssue: false
    },
    {
      id: 'chunk-2',
      content: '...確保市場公平透明。適用於所有在境內註冊的金融機構，包括但不限於銀行、證券公司、保險',
      pageNum: 1,
      startChar: 462,
      endChar: 974,
      tokens: 128,
      hasIssue: true,
      issueType: '句子被截斷'
    },
    {
      id: 'chunk-3',
      content: '公司等。1.2 監管原則 (1) 審慎監管原則：要求金融機構保持充足的資本和流動性...',
      pageNum: 2,
      startChar: 924,
      endChar: 1436,
      tokens: 128,
      hasIssue: false
    },
  ];

  const entityCandidates: EntityCandidate[] = [
    {
      id: 'ec-1',
      entities: ['金融監督管理委員會', '金管會', 'FSC'],
      confidence: 0.92,
      sourceChunks: ['chunk-1', 'chunk-5', 'chunk-12'],
      status: 'pending'
    },
    {
      id: 'ec-2',
      entities: ['台灣銀行', '臺灣銀行', 'Bank of Taiwan'],
      confidence: 0.88,
      sourceChunks: ['chunk-3', 'chunk-8'],
      status: 'pending'
    },
    {
      id: 'ec-3',
      entities: ['證券交易法', '證交法'],
      confidence: 0.95,
      sourceChunks: ['chunk-2', 'chunk-7', 'chunk-15'],
      status: 'pending'
    },
  ];

  const qualityIssues = [
    {
      fileId: 3,
      fileName: '醫療器材認證標準.docx',
      issues: [
        { type: 'OCR錯誤', count: 8, severity: 'medium', description: '識別錯誤字符' },
        { type: '表格結構', count: 2, severity: 'high', description: '表格欄位錯位' },
        { type: '分塊不當', count: 5, severity: 'low', description: '段落被截斷' },
      ]
    }
  ];

  const knowledgeGraph = {
    nodes: 156,
    edges: 423,
    entities: {
      organizations: 45,
      persons: 78,
      regulations: 33,
    },
    lastUpdate: '5分鐘前',
    duplicateCandidates: 15,
    lowQualityNodes: 3
  };

  const completedFiles = uploadedFiles.filter(f => f.status === 'completed');
  const totalIndexedChunks = completedFiles.reduce((sum, f) => sum + (f.chunks || 0), 0);

  const vectorIndexing = {
    totalChunks: totalIndexedChunks,
    indexedChunks: totalIndexedChunks,
    progress: 100,
    embeddingModel: 'bge-m3-multilingual',
    dimension: 1024,
    collections: completedFiles.length,
  };

  const retrievalTestResults = testQuery ? [
    {
      chunkId: 'chunk-1',
      score: 0.94,
      type: 'semantic',
      content: '第一章 金融監管總則...',
      source: '金融監管法規 2024.pdf',
      graphNodes: ['金融監管', '投資者保護']
    },
    {
      chunkId: 'chunk-5',
      score: 0.87,
      type: 'hybrid',
      content: '...金融機構應建立內部控制制度...',
      source: '金融監管法規 2024.pdf',
      graphNodes: ['金融機構', '內部控制']
    },
    {
      chunkId: 'chunk-12',
      score: 0.76,
      type: 'keyword',
      content: '...監管機構有權對違規行為進行處罰...',
      source: '企業內部政策手冊.pdf',
      graphNodes: ['監管機構', '違規處罰']
    },
  ] : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-success)' }} />;
      case 'processing':
        return <Clock className="w-4 h-4 animate-spin" style={{ color: 'var(--color-warning)' }} />;
      case 'queued':
        return <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '解析中';
      case 'queued':
        return '等待中';
      default:
        return status;
    }
  };

  const renderOverview = () => [
    // Center Area: Knowledge Graph & Vector
    <div key="center" className="col-span-6 space-y-4">
      {/* Knowledge Graph */}
      <div className="card" style={{ height: 'calc(50% - 8px)' }}>
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
              <h4 style={{ color: 'var(--color-gray-900)' }}>知識圖譜 (Apache AGE)</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-info">{knowledgeGraph.nodes} 節點</span>
              {knowledgeGraph.duplicateCandidates > 0 && (
                <button
                  onClick={() => setViewMode('entity-resolution')}
                  className="badge badge-warning cursor-pointer hover:opacity-80"
                >
                  {knowledgeGraph.duplicateCandidates} 待合併
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="card-body relative" style={{ height: 'calc(100% - 60px)' }}>
          {/* Simulated Knowledge Graph Visualization */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ 
            background: 'radial-gradient(circle, rgba(0, 184, 217, 0.03) 0%, transparent 70%)'
          }}>
            <svg width="100%" height="100%" viewBox="0 0 500 300" className="overflow-visible">
              {/* Edges */}
              <line x1="250" y1="150" x2="150" y2="80" stroke="var(--color-gray-300)" strokeWidth="1.5" />
              <line x1="250" y1="150" x2="350" y2="80" stroke="var(--color-gray-300)" strokeWidth="1.5" />
              <line x1="250" y1="150" x2="180" y2="220" stroke="var(--color-gray-300)" strokeWidth="1.5" />
              <line x1="250" y1="150" x2="320" y2="220" stroke="var(--color-gray-300)" strokeWidth="1.5" />
              <line x1="150" y1="80" x2="100" y2="150" stroke="var(--color-gray-300)" strokeWidth="1.5" />
              <line x1="350" y1="80" x2="400" y2="150" stroke="var(--color-gray-300)" strokeWidth="1.5" />
              
              {/* Nodes */}
              <circle cx="250" cy="150" r="24" fill="var(--color-primary-blue)" opacity="0.9" />
              <circle cx="150" cy="80" r="18" fill="var(--color-teal)" opacity="0.9" />
              <circle cx="350" cy="80" r="18" fill="var(--color-teal)" opacity="0.9" />
              <circle cx="180" cy="220" r="16" fill="var(--color-success)" opacity="0.9" />
              <circle cx="320" cy="220" r="16" fill="var(--color-success)" opacity="0.9" />
              <circle cx="100" cy="150" r="14" fill="var(--color-gray-400)" opacity="0.9" />
              <circle cx="400" cy="150" r="14" fill="var(--color-gray-400)" opacity="0.9" />
              
              {/* Labels */}
              <text x="250" y="155" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">金融</text>
              <text x="150" y="85" textAnchor="middle" fill="white" fontSize="10">監管</text>
              <text x="350" y="85" textAnchor="middle" fill="white" fontSize="10">法規</text>
              <text x="180" y="224" textAnchor="middle" fill="white" fontSize="9">機構</text>
              <text x="320" y="224" textAnchor="middle" fill="white" fontSize="9">標準</text>
              <text x="100" y="154" textAnchor="middle" fill="white" fontSize="8">A</text>
              <text x="400" y="154" textAnchor="middle" fill="white" fontSize="8">B</text>
            </svg>
          </div>

          {/* Stats Overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(knowledgeGraph.entities).map(([key, value]) => (
                <div key={key} className="card-body py-2 px-3">
                  <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                    {key === 'organizations' ? '組織' : key === 'persons' ? '人物' : '法規'}
                  </div>
                  <div className="text-lg font-mono" style={{ color: 'var(--color-primary-blue)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vector Indexing with Retrieval Test */}
      <div className="card" style={{ height: 'calc(50% - 8px)' }}>
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
              <h4 style={{ color: 'var(--color-gray-900)' }}>向量索引 (Qdrant)</h4>
            </div>
            <button
              onClick={() => setViewMode('retrieval-test')}
              className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              檢索測試
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--color-gray-700)' }}>
                  混合檢索索引進度
                </span>
                <span className="text-sm font-mono" style={{ color: 'var(--color-teal)' }}>
                  {vectorIndexing.indexedChunks.toLocaleString()} / {vectorIndexing.totalChunks.toLocaleString()}
                </span>
              </div>
              <div className="progress-bar" style={{ height: '8px' }}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${vectorIndexing.progress}%` }}
                />
              </div>
            </div>

            {/* Configuration Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg relative" style={{ background: 'var(--color-gray-50)' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>嵌入模型</div>
                  <button
                    onClick={() => setShowEmbeddingWarning(!showEmbeddingWarning)}
                    className="text-xs hover:opacity-70"
                  >
                    <Settings className="w-3.5 h-3.5" style={{ color: 'var(--color-gray-400)' }} />
                  </button>
                </div>
                <div className="text-sm font-mono" style={{ color: 'var(--color-gray-900)' }}>
                  {vectorIndexing.embeddingModel}
                </div>
                {showEmbeddingWarning && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 rounded-lg shadow-lg z-10 border" style={{ 
                    background: 'var(--color-bg-white)',
                    borderColor: 'var(--color-warning)'
                  }}>
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                      <div className="text-xs" style={{ color: 'var(--color-gray-700)' }}>
                        <strong>變更模型需要重新索引</strong><br/>
                        將重建所有 {vectorIndexing.totalChunks.toLocaleString()} 個向量，預計耗時 2-3 小時
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--color-gray-50)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>向量維度</div>
                <div className="text-sm font-mono" style={{ color: 'var(--color-gray-900)' }}>
                  {vectorIndexing.dimension}d
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--color-gray-50)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>檢索策略</div>
                <div className="text-sm" style={{ color: 'var(--color-gray-900)' }}>
                  混合檢索
                </div>
              </div>
              <div className="p-3 rounded-lg cursor-pointer hover:opacity-80" 
                style={{ background: 'rgba(0, 82, 204, 0.05)' }}
                onClick={() => setViewMode('retrieval-test')}
              >
                <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>Alpha 權重</div>
                <div className="text-sm font-mono" style={{ color: 'var(--color-primary-blue)' }}>
                  {hybridAlpha.toFixed(2)} 
                  <span className="text-xs ml-1">(可調)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,

    // Right Panel: Gardener Status Dashboard
    <div key="right" className="col-span-3 space-y-4">
      <div className="card">
        <div className="card-header">
          <h4 style={{ color: 'var(--color-gray-900)' }}>知識維護狀態</h4>
        </div>
        <div className="p-4 space-y-3">
          {/* Entity Resolution Status */}
          <button 
            onClick={() => setViewMode('entity-resolution')}
            className="w-full p-4 rounded-lg border text-left transition-all hover:shadow-md" 
            style={{ 
              borderColor: knowledgeGraph.duplicateCandidates > 0 ? 'var(--color-warning)' : 'var(--color-gray-200)',
              background: knowledgeGraph.duplicateCandidates > 0 ? 'rgba(255, 171, 0, 0.05)' : 'var(--color-bg-white)'
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ 
                background: knowledgeGraph.duplicateCandidates > 0 ? 'rgba(255, 171, 0, 0.2)' : 'rgba(0, 82, 204, 0.1)'
              }}>
                <RefreshCw className="w-5 h-5" style={{ 
                  color: knowledgeGraph.duplicateCandidates > 0 ? 'var(--color-warning)' : 'var(--color-primary-blue)' 
                }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                    實體解析
                  </div>
                  {knowledgeGraph.duplicateCandidates > 0 && (
                    <span className="badge badge-warning text-xs">
                      {knowledgeGraph.duplicateCandidates} 組待審核
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>
                  {knowledgeGraph.duplicateCandidates > 0 
                    ? '發現潛在重複實體，需人工確認' 
                    : '無待處理項目'}
                </div>
              </div>
            </div>
          </button>

          {/* Quality Issues Status */}
          <button 
            onClick={() => setViewMode('quality-issues')}
            className="w-full p-4 rounded-lg border text-left transition-all hover:shadow-md" 
            style={{ 
              borderColor: knowledgeGraph.lowQualityNodes > 0 ? 'var(--color-danger)' : 'var(--color-gray-200)',
              background: knowledgeGraph.lowQualityNodes > 0 ? 'rgba(222, 53, 11, 0.05)' : 'var(--color-bg-white)'
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ 
                background: knowledgeGraph.lowQualityNodes > 0 ? 'rgba(222, 53, 11, 0.2)' : 'rgba(54, 179, 126, 0.1)'
              }}>
                {knowledgeGraph.lowQualityNodes > 0 ? (
                  <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                ) : (
                  <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                    品質驗證
                  </div>
                  {knowledgeGraph.lowQualityNodes > 0 && (
                    <span className="badge badge-danger text-xs">
                      {knowledgeGraph.lowQualityNodes} 份問題文件
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>
                  {knowledgeGraph.lowQualityNodes > 0 
                    ? '發現低品質資料，建議檢查' 
                    : '所有資料品質良好'}
                </div>
              </div>
            </div>
          </button>

          {/* Clean Outdated - Simple Action */}
          <div className="w-full p-4 rounded-lg border" style={{ 
            borderColor: 'var(--color-gray-200)',
            background: 'var(--color-bg-white)'
          }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ 
                background: 'rgba(0, 184, 217, 0.1)'
              }}>
                <Trash2 className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                    清理過期知識
                  </div>
                  <button className="text-xs px-2 py-1 rounded" style={{ 
                    color: 'var(--color-teal)',
                    background: 'rgba(0, 184, 217, 0.1)'
                  }}>
                    執行
                  </button>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>
                  移除 90 天前的過時資料
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Graph-Vector Linkage Stats */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
            <h4 style={{ color: 'var(--color-gray-900)' }}>圖譜-向量關聯</h4>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>關聯覆蓋率</span>
            <span className="text-sm font-mono" style={{ color: 'var(--color-success)' }}>87%</span>
          </div>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: '87%' }} />
          </div>
          <div className="text-xs pt-2 border-t" style={{ 
            borderColor: 'var(--color-gray-200)',
            color: 'var(--color-gray-400)' 
          }}>
            {knowledgeGraph.nodes} 個圖譜節點可溯源至原始文件分塊
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h4 style={{ color: 'var(--color-gray-900)' }}>統計資訊</h4>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>總文件數</div>
            <div className="text-2xl font-mono" style={{ color: 'var(--color-primary-blue)' }}>
              {uploadedFiles.length}
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>知識圖譜節點</div>
            <div className="text-2xl font-mono" style={{ color: 'var(--color-teal)' }}>
              {knowledgeGraph.nodes}
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>向量總數</div>
            <div className="text-2xl font-mono" style={{ color: 'var(--color-success)' }}>
              {(vectorIndexing.totalChunks / 1000).toFixed(1)}K
            </div>
          </div>
        </div>
      </div>
    </div>
  ];

  const renderChunkPreview = () => (
    <div className="col-span-12">
      <div className="card h-full">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewMode('overview')}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                ← 返回
              </button>
              <div>
                <h4 style={{ color: 'var(--color-gray-900)' }}>{selectedFile || '文件分塊預覽'}</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>
                  檢查分塊品質，確保語義完整性
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'var(--color-gray-50)' }}>
                <Layers className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
                <span className="text-xs" style={{ color: 'var(--color-gray-600)' }}>
                  Chunk Size: <strong>{chunkSize}</strong>
                </span>
              </div>
              <button className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5">
                <Settings className="w-4 h-4" />
                調整策略
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {mockChunks.map((chunk, idx) => (
              <div 
                key={chunk.id}
                className="p-4 rounded-lg border"
                style={{ 
                  borderColor: chunk.hasIssue ? 'var(--color-warning)' : 'var(--color-gray-200)',
                  background: chunk.hasIssue ? 'rgba(255, 171, 0, 0.05)' : 'var(--color-bg-white)'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xs font-mono px-2 py-1 rounded" style={{ 
                    background: 'var(--color-gray-100)',
                    color: 'var(--color-gray-600)'
                  }}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-gray-400)' }}>
                        <span>頁碼: {chunk.pageNum}</span>
                        <span>字符: {chunk.startChar}-{chunk.endChar}</span>
                        <span>Tokens: {chunk.tokens}</span>
                      </div>
                      {chunk.hasIssue && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ 
                          background: 'var(--color-warning)',
                          color: 'white'
                        }}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-xs">{chunk.issueType}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-gray-700)' }}>
                      {chunk.content}
                    </p>
                    {chunk.hasIssue && (
                      <div className="mt-3 flex items-center gap-2">
                        <button className="text-xs px-3 py-1.5 rounded" style={{ 
                          background: 'var(--color-primary-blue)',
                          color: 'white'
                        }}>
                          調整重疊率
                        </button>
                        <button className="text-xs px-3 py-1.5 rounded" style={{ 
                          background: 'var(--color-gray-100)',
                          color: 'var(--color-gray-700)'
                        }}>
                          手動編輯
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRetrievalTest = () => (
    <div className="col-span-12">
      <div className="card h-full">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewMode('overview')}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                ← 返回
              </button>
              <div>
                <h4 style={{ color: 'var(--color-gray-900)' }}>檢索測試實驗室</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>
                  測試混合檢索效果，調整權重配置
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Alpha Weight Control */}
          <div className="p-4 rounded-lg" style={{ background: 'var(--color-gray-50)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                  混合檢索權重 (Alpha)
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>
                  Alpha = 0: 純關鍵字 (Sparse) | Alpha = 1: 純語義 (Dense)
                </div>
              </div>
              <div className="text-xl font-mono" style={{ color: 'var(--color-primary-blue)' }}>
                {hybridAlpha.toFixed(2)}
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={hybridAlpha}
              onChange={(e) => setHybridAlpha(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--color-primary-blue)' }}
            />
            <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--color-gray-400)' }}>
              <span>關鍵字優先</span>
              <span>平衡</span>
              <span>語義優先</span>
            </div>
          </div>

          {/* Query Input */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-gray-900)' }}>
              輸入測試查詢
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="例如：金融監管相關法規要求..."
                className="flex-1 px-4 py-2.5 rounded-lg border"
                style={{ 
                  borderColor: 'var(--color-gray-200)',
                  background: 'var(--color-bg-white)'
                }}
              />
              <button 
                className="btn-primary px-6 flex items-center gap-2"
                onClick={() => {/* Trigger search */}}
              >
                <Search className="w-4 h-4" />
                檢索
              </button>
            </div>
          </div>

          {/* Results */}
          {retrievalTestResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                  檢索結果 ({retrievalTestResults.length})
                </h5>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-gray-400)' }}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  按相關性排序
                </div>
              </div>
              <div className="space-y-3">
                {retrievalTestResults.map((result, idx) => (
                  <div 
                    key={result.chunkId}
                    className="p-4 rounded-lg border"
                    style={{ 
                      borderColor: 'var(--color-gray-200)',
                      background: 'var(--color-bg-white)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-sm font-mono px-2 py-1 rounded" style={{ 
                        background: result.score > 0.9 ? 'var(--color-success)' : result.score > 0.8 ? 'var(--color-warning)' : 'var(--color-gray-400)',
                        color: 'white'
                      }}>
                        {result.score.toFixed(2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded" style={{ 
                              background: result.type === 'semantic' ? 'rgba(0, 184, 217, 0.1)' : result.type === 'keyword' ? 'rgba(255, 171, 0, 0.1)' : 'rgba(0, 82, 204, 0.1)',
                              color: result.type === 'semantic' ? 'var(--color-teal)' : result.type === 'keyword' ? 'var(--color-warning)' : 'var(--color-primary-blue)'
                            }}>
                              {result.type === 'semantic' ? '語義' : result.type === 'keyword' ? '關鍵字' : '混合'}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                              {result.source}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-gray-700)' }}>
                          {result.content}
                        </p>
                        {result.graphNodes.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Network className="w-3.5 h-3.5" style={{ color: 'var(--color-gray-400)' }} />
                            <div className="flex items-center gap-1.5">
                              {result.graphNodes.map((node, i) => (
                                <span 
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ 
                                    background: 'var(--color-gray-100)',
                                    color: 'var(--color-gray-600)'
                                  }}
                                >
                                  {node}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderEntityResolution = () => (
    <div className="col-span-12">
      <div className="card h-full">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewMode('overview')}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                ← 返回
              </button>
              <div>
                <h4 style={{ color: 'var(--color-gray-900)' }}>實體解析 - 候選審核</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>
                  審核 AI 發現的重複實體，防止誤合併
                </p>
              </div>
            </div>
            <span className="badge badge-warning">
              {entityCandidates.filter(ec => ec.status === 'pending').length} 組待處理
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {entityCandidates.map((candidate) => (
              <div 
                key={candidate.id}
                className="p-5 rounded-lg border"
                style={{ 
                  borderColor: 'var(--color-gray-200)',
                  background: 'var(--color-bg-white)'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {candidate.entities.flatMap((entity, idx) => {
                        const elements = [];
                        if (idx > 0) {
                          elements.push(
                            <span key={`sep-${idx}`} style={{ color: 'var(--color-gray-300)' }}>≈</span>
                          );
                        }
                        elements.push(
                          <span 
                            key={`entity-${idx}`}
                            className="px-3 py-1.5 rounded font-medium"
                            style={{ 
                              background: 'rgba(0, 82, 204, 0.1)',
                              color: 'var(--color-primary-blue)'
                            }}
                          >
                            {entity}
                          </span>
                        );
                        return elements;
                      })}
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-gray-400)' }}>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        信心度: <strong>{(candidate.confidence * 100).toFixed(0)}%</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        來源: {candidate.sourceChunks.length} 個分塊
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="px-4 py-2 rounded text-sm"
                      style={{ 
                        background: 'var(--color-success)',
                        color: 'white'
                      }}
                    >
                      ✓ 合併
                    </button>
                    <button 
                      className="px-4 py-2 rounded text-sm"
                      style={{ 
                        background: 'var(--color-gray-100)',
                        color: 'var(--color-gray-700)'
                      }}
                    >
                      ✗ 拒絕
                    </button>
                  </div>
                </div>
                <div className="pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                  <details>
                    <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-gray-400)' }}>
                      查看來源分塊
                    </summary>
                    <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--color-gray-600)' }}>
                      {candidate.sourceChunks.map((chunk) => (
                        <div key={chunk}>• {chunk}</div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderQualityIssues = () => (
    <div className="col-span-12">
      <div className="card h-full">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewMode('overview')}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                ← 返回
              </button>
              <div>
                <h4 style={{ color: 'var(--color-gray-900)' }}>資料品質問題</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-gray-400)' }}>
                  檢測到的 OCR 錯誤、結構問題與分塊缺陷
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {qualityIssues.map((file) => (
              <div 
                key={file.fileId}
                className="p-5 rounded-lg border"
                style={{ 
                  borderColor: 'var(--color-danger)',
                  background: 'rgba(222, 53, 11, 0.05)'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                      <span className="font-medium" style={{ color: 'var(--color-gray-900)' }}>
                        {file.fileName}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                      發現 {file.issues.length} 類問題
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedFile(file.fileName);
                      setViewMode('chunk-preview');
                    }}
                    className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    檢視分塊
                  </button>
                </div>
                <div className="space-y-2">
                  {file.issues.map((issue, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded"
                      style={{ background: 'var(--color-bg-white)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            background: issue.severity === 'high' ? 'var(--color-danger)' : issue.severity === 'medium' ? 'var(--color-warning)' : 'var(--color-gray-400)'
                          }}
                        />
                        <div>
                          <div className="text-sm" style={{ color: 'var(--color-gray-900)' }}>
                            {issue.type}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                            {issue.description}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-mono" style={{ color: 'var(--color-gray-600)' }}>
                        {issue.count} 處
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'chunk-preview':
        return renderChunkPreview();
      case 'retrieval-test':
        return renderRetrievalTest();
      case 'entity-resolution':
        return renderEntityResolution();
      case 'quality-issues':
        return renderQualityIssues();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {viewMode === 'overview' && (
        /* Left Panel: Data Sources & Config */
        <div className="col-span-3 space-y-4">
          <div className="card">
            <div className="card-header border-b-0 pb-0">
              <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-gray-200)' }}>
                <button
                  onClick={() => setSourceType('document')}
                  className="flex-1 px-3 py-2 text-sm transition-colors relative"
                  style={{
                    color: sourceType === 'document' ? 'var(--color-primary-blue)' : 'var(--color-gray-600)',
                    fontWeight: sourceType === 'document' ? 600 : 400
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    文件來源
                  </div>
                  {sourceType === 'document' && (
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'var(--color-primary-blue)' }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setSourceType('image')}
                  className="flex-1 px-3 py-2 text-sm transition-colors relative"
                  style={{
                    color: sourceType === 'image' ? 'var(--color-primary-blue)' : 'var(--color-gray-600)',
                    fontWeight: sourceType === 'image' ? 600 : 400
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Image className="w-4 h-4" />
                    圖片來源
                  </div>
                  {sourceType === 'image' && (
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'var(--color-primary-blue)' }}
                    />
                  )}
                </button>
              </div>
            </div>

            {sourceType === 'document' ? (
              <>
                <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                  {uploadedFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file.name);
                        if (file.status === 'completed') {
                          setViewMode('chunk-preview');
                        }
                      }}
                      className="w-full text-left p-3 rounded-lg transition-all border"
                      style={{
                        background: selectedFile === file.name ? 'rgba(0, 82, 204, 0.05)' : 'transparent',
                        borderColor: file.hasQualityIssues ? 'var(--color-warning)' : selectedFile === file.name ? 'var(--color-primary-blue)' : 'var(--color-gray-200)',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-gray-400)' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate" style={{ color: 'var(--color-gray-900)' }}>
                            {file.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {getStatusIcon(file.status)}
                            <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                              {getStatusText(file.status)}
                            </span>
                            {file.status === 'processing' && file.progress && (
                              <span className="text-xs font-mono" style={{ color: 'var(--color-warning)' }}>
                                {file.progress}%
                              </span>
                            )}
                          </div>
                          {file.status === 'completed' && (
                            <div className="text-xs mt-1.5 space-y-0.5" style={{ color: 'var(--color-gray-400)' }}>
                              <div>{file.entities} 實體 • {file.chunks} 分塊</div>
                              {file.hasQualityIssues && (
                                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-warning)' }}>
                                  <AlertTriangle className="w-3 h-3" />
                                  {file.qualityIssueCount} 個問題
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                  <button className="btn-primary w-full text-sm">
                    + 上傳文件
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4">
                  <div 
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-opacity-100 transition-all"
                    style={{ 
                      borderColor: 'var(--color-gray-300)',
                      background: 'var(--color-gray-50)'
                    }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(0, 82, 204, 0.1)' }}
                      >
                        <Upload className="w-6 h-6" style={{ color: 'var(--color-primary-blue)' }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-gray-900)' }}>
                          拖放圖片或點擊上傳
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                          支援 PNG, JPG, JPEG, WEBP 格式
                        </div>
                      </div>
                      <button className="btn-primary text-sm px-4 py-2">
                        選擇圖片
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {[
                      { id: 1, name: '產品說明書_頁面1.png', status: 'completed' },
                      { id: 2, name: '財報圖表.jpg', status: 'processing', progress: 45 }
                    ].map((img) => (
                      <div
                        key={img.id}
                        className="p-3 rounded-lg border"
                        style={{
                          borderColor: 'var(--color-gray-200)',
                          background: 'var(--color-bg-white)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Image className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-gray-400)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate" style={{ color: 'var(--color-gray-900)' }}>
                              {img.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusIcon(img.status)}
                              <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                                {getStatusText(img.status)}
                              </span>
                              {img.status === 'processing' && img.progress && (
                                <span className="text-xs font-mono" style={{ color: 'var(--color-warning)' }}>
                                  {img.progress}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h4 style={{ color: 'var(--color-gray-900)' }}>解析策略配置</h4>
                <Settings className="w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
              </div>
            </div>
            <div className="p-4 space-y-4">
              {sourceType === 'document' ? (
                <>
                  <div>
                    <label className="text-xs mb-2 block" style={{ color: 'var(--color-gray-700)' }}>
                      Chunk Size (字符數)
                    </label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded border"
                      style={{ 
                        borderColor: 'var(--color-gray-200)',
                        background: 'var(--color-bg-white)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-2 block" style={{ color: 'var(--color-gray-700)' }}>
                      Overlap (字符數)
                    </label>
                    <input
                      type="number"
                      value={overlap}
                      onChange={(e) => setOverlap(parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded border"
                      style={{ 
                        borderColor: 'var(--color-gray-200)',
                        background: 'var(--color-bg-white)'
                      }}
                    />
                  </div>
                  <div className="pt-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
                    <div className="text-xs mb-2" style={{ color: 'var(--color-gray-700)' }}>啟用功能</div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span style={{ color: 'var(--color-gray-600)' }}>啟用 OCR (圖片文字)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span style={{ color: 'var(--color-gray-600)' }}>保留文件結構</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" className="rounded" />
                        <span style={{ color: 'var(--color-gray-600)' }}>忽略頁首頁尾</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                      background: 'rgba(0, 82, 204, 0.1)' 
                    }}>
                      <FileText className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>解析引擎</div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                        IBM Docling
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="pt-1">
                    <div className="text-xs mb-3 font-medium" style={{ color: 'var(--color-gray-700)' }}>啟用功能</div>
                    <div className="space-y-2.5">
                      <label 
                        className="flex items-center gap-2.5 text-xs cursor-pointer p-2.5 rounded transition-colors hover:bg-gray-50"
                        style={{
                          background: imageParseMode === 'OCR' ? 'rgba(0, 82, 204, 0.05)' : 'transparent'
                        }}
                      >
                        <input 
                          type="radio" 
                          name="imageParseMode" 
                          checked={imageParseMode === 'OCR'}
                          onChange={() => setImageParseMode('OCR')}
                          className="w-4 h-4"
                          style={{ accentColor: 'var(--color-primary-blue)' }}
                        />
                        <span style={{ color: 'var(--color-gray-700)', fontWeight: imageParseMode === 'OCR' ? 600 : 400 }}>
                          OCR
                        </span>
                      </label>
                      <label 
                        className="flex items-center gap-2.5 text-xs cursor-pointer p-2.5 rounded transition-colors hover:bg-gray-50"
                        style={{
                          background: imageParseMode === 'VLM' ? 'rgba(0, 82, 204, 0.05)' : 'transparent'
                        }}
                      >
                        <input 
                          type="radio" 
                          name="imageParseMode" 
                          checked={imageParseMode === 'VLM'}
                          onChange={() => setImageParseMode('VLM')}
                          className="w-4 h-4"
                          style={{ accentColor: 'var(--color-primary-blue)' }}
                        />
                        <span style={{ color: 'var(--color-gray-700)', fontWeight: imageParseMode === 'VLM' ? 600 : 400 }}>
                          VLM
                        </span>
                      </label>
                      <label 
                        className="flex items-center gap-2.5 text-xs cursor-pointer p-2.5 rounded transition-colors hover:bg-gray-50"
                        style={{
                          background: imageParseMode === 'OCR+VLM' ? 'rgba(0, 82, 204, 0.05)' : 'transparent'
                        }}
                      >
                        <input 
                          type="radio" 
                          name="imageParseMode" 
                          checked={imageParseMode === 'OCR+VLM'}
                          onChange={() => setImageParseMode('OCR+VLM')}
                          className="w-4 h-4"
                          style={{ accentColor: 'var(--color-primary-blue)' }}
                        />
                        <span style={{ color: 'var(--color-gray-700)', fontWeight: imageParseMode === 'OCR+VLM' ? 600 : 400 }}>
                          OCR+VLM
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                      background: 'rgba(0, 184, 217, 0.1)' 
                    }}>
                      <Image className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>解析引擎</div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-gray-900)' }}>
                        Gemma3
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {renderContent()}
    </div>
  );
}