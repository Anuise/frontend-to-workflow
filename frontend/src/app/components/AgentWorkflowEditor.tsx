import React, { useState } from 'react';
import { GitBranch, Workflow, Brain, Wrench, Database, MessageSquare, Settings, Play, Save, Zap, ChevronDown, Upload, Eye, CheckCircle, XCircle, Clock, AlertTriangle, Code, Globe, FileText, Server, Link2, Activity } from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'model' | 'prompt' | 'decision';
  label: string;
  x: number;
  y: number;
  color: string;
  icon: React.ReactNode;
}

interface Connection {
  from: string;
  to: string;
  type?: 'standard' | 'conditional';
  condition?: string;
}

export function AgentWorkflowEditor() {
  const [selectedNode, setSelectedNode] = useState<string | null>('planner');
  const [isDragging, setIsDragging] = useState(false);
  const [showTraceView, setShowTraceView] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const nodes: WorkflowNode[] = [
    {
      id: 'planner',
      type: 'agent',
      label: 'Planner Agent',
      x: 20,
      y: 180,
      color: 'var(--color-primary-blue)',
      icon: <Brain className="w-5 h-5" />,
    },
    {
      id: 'text2sql',
      type: 'tool',
      label: 'Text2SQL Tool',
      x: 280,
      y: 180,
      color: 'var(--color-teal)',
      icon: <Wrench className="w-5 h-5" />,
    },
    {
      id: 'executor',
      type: 'agent',
      label: 'Executor Agent',
      x: 540,
      y: 180,
      color: 'var(--color-primary-blue)',
      icon: <Brain className="w-5 h-5" />,
    },
    {
      id: 'decision',
      type: 'decision',
      label: 'Quality Check',
      x: 410,
      y: 320,
      color: 'var(--color-warning)',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      id: 'reviewer',
      type: 'agent',
      label: 'Reviewer Agent',
      x: 280,
      y: 400,
      color: 'var(--color-success)',
      icon: <Brain className="w-5 h-5" />,
    },
  ];

  const connections: Connection[] = [
    { from: 'planner', to: 'text2sql', type: 'standard' },
    { from: 'text2sql', to: 'executor', type: 'standard' },
    { from: 'executor', to: 'decision', type: 'standard' },
    { from: 'decision', to: 'reviewer', type: 'conditional', condition: 'quality >= 0.8' },
    { from: 'decision', to: 'planner', type: 'conditional', condition: 'quality < 0.8' },
  ];

  const componentLibrary = [
    { 
      category: 'Prompts', 
      items: [
        { name: 'System Prompt', icon: <MessageSquare className="w-4 h-4" />, color: 'var(--color-gray-400)' },
        { name: 'User Message', icon: <MessageSquare className="w-4 h-4" />, color: 'var(--color-gray-400)' },
        { name: 'Few-Shot Examples', icon: <MessageSquare className="w-4 h-4" />, color: 'var(--color-gray-400)' },
        { name: 'Output Parser', icon: <Code className="w-4 h-4" />, color: 'var(--color-gray-400)', tag: 'NEW' },
      ]
    },
    { 
      category: 'Models', 
      items: [
        { name: 'Llama-3.3-Nemotron', icon: <Brain className="w-4 h-4" />, color: 'var(--color-primary-blue)' },
        { name: 'GPT-oss-120B', icon: <Brain className="w-4 h-4" />, color: 'var(--color-primary-blue)' },
        { name: 'Gemma 3 27B', icon: <Brain className="w-4 h-4" />, color: 'var(--color-primary-blue)' },
      ]
    },
    { 
      category: 'Tools', 
      items: [
        { name: 'Text2SQL', icon: <Database className="w-4 h-4" />, color: 'var(--color-teal)' },
        { name: 'Web Search', icon: <Globe className="w-4 h-4" />, color: 'var(--color-teal)' },
        { name: 'Document Retrieval', icon: <FileText className="w-4 h-4" />, color: 'var(--color-teal)' },
        { name: 'Custom API', icon: <Link2 className="w-4 h-4" />, color: 'var(--color-teal)', tag: 'NEW' },
      ]
    },
    { 
      category: 'Memories', 
      items: [
        { name: 'Conversation Buffer', icon: <MessageSquare className="w-4 h-4" />, color: 'var(--color-warning)' },
        { name: 'Vector Store', icon: <Database className="w-4 h-4" />, color: 'var(--color-warning)' },
        { name: 'Knowledge Graph', icon: <GitBranch className="w-4 h-4" />, color: 'var(--color-warning)' },
      ]
    },
  ];

  const nodeProperties = {
    planner: {
      title: 'Planner Agent (規劃者)',
      description: '分析使用者意圖並規劃執行策略',
      settings: [
        { label: 'Model', value: 'Llama-3.3-Nemotron', type: 'select', options: ['Llama-3.3-Nemotron', 'GPT-oss-120B', 'Gemma 3 27B'] },
        { label: 'Temperature', value: 0.7, type: 'slider', min: 0, max: 1, step: 0.1 },
        { label: 'Max Iterations', value: 5, type: 'number', description: '防止遞迴死循環', tag: 'NEW' },
        { label: 'System Prompt', value: '你是智慧規劃助手。可用變數: {schema}, {user_query}', type: 'textarea', expandable: true },
        { label: 'Tools Binding', value: ['Text2SQL', 'Web Search'], type: 'multiselect', tag: 'NEW' },
      ]
    },
    text2sql: {
      title: 'Text2SQL Tool',
      description: '將自然語言轉換為 SQL 查詢',
      settings: [
        { label: 'Database Connection', value: 'postgresql://prod_db', type: 'text', icon: <Server className="w-4 h-4" /> },
        { label: 'Schema Upload', value: null, type: 'file', accept: '.sql,.ddl', tag: 'NEW' },
        { label: 'DDL Preview', value: null, type: 'button', action: 'showDDL', tag: 'NEW' },
        { label: 'Max Tokens', value: 512, type: 'number' },
        { label: 'SQL Validation', value: true, type: 'checkbox' },
      ]
    },
    executor: {
      title: 'Executor Agent (執行者)',
      description: '執行查詢並處理結果',
      settings: [
        { label: 'Model', value: 'Llama-3.3-Nemotron', type: 'select', options: ['Llama-3.3-Nemotron', 'GPT-oss-120B'] },
        { label: 'Temperature', value: 0.3, type: 'slider', min: 0, max: 1, step: 0.1 },
        { label: 'Timeout', value: 30, type: 'number', unit: 'seconds' },
        { label: 'Max Iterations', value: 3, type: 'number' },
      ]
    },
    decision: {
      title: 'Quality Check (決策節點)',
      description: '條件路由：根據輸出品質決定下一步',
      settings: [
        { label: 'Condition Field', value: 'quality_score', type: 'text' },
        { label: 'Pass Threshold', value: 0.8, type: 'slider', min: 0, max: 1, step: 0.05 },
        { label: 'Pass Route', value: 'Reviewer Agent', type: 'select', options: ['Reviewer Agent', 'End'] },
        { label: 'Fail Route', value: 'Planner Agent (Retry)', type: 'select', options: ['Planner Agent (Retry)', 'End with Error'] },
      ]
    },
    reviewer: {
      title: 'Reviewer Agent (審核者)',
      description: '驗證輸出品質並提供回饋',
      settings: [
        { label: 'Model', value: 'GPT-oss-120B', type: 'select', options: ['GPT-oss-120B', 'Gemma 3 27B'] },
        { label: 'Temperature', value: 0.2, type: 'slider', min: 0, max: 1, step: 0.1 },
        { label: 'Quality Threshold', value: 0.85, type: 'slider', min: 0, max: 1, step: 0.05 },
        { label: 'Human-in-the-loop', value: true, type: 'checkbox', description: '需要人工批准', tag: 'NEW' },
      ]
    },
  };

  const traceSteps = [
    { 
      step: 1, 
      node: 'Planner Agent', 
      status: 'completed',
      input: '查詢上個月銷售額',
      output: '分析：需要查詢 sales 表，時間範圍為上個月',
      latency: '234ms',
      timestamp: '10:23:45'
    },
    { 
      step: 2, 
      node: 'Text2SQL Tool', 
      status: 'completed',
      input: '查詢 sales 表，時間範圍為上個月',
      output: 'SELECT SUM(amount) FROM sales WHERE date >= DATE_TRUNC(\'month\', CURRENT_DATE - INTERVAL \'1 month\')',
      latency: '156ms',
      timestamp: '10:23:46'
    },
    { 
      step: 3, 
      node: 'Executor Agent', 
      status: 'completed',
      input: 'SQL: SELECT SUM(amount) FROM sales...',
      output: '結果：NT$ 12,458,392',
      latency: '512ms',
      timestamp: '10:23:47'
    },
    { 
      step: 4, 
      node: 'Quality Check', 
      status: 'completed',
      input: 'quality_score: 0.92',
      output: 'PASS → Reviewer Agent',
      latency: '12ms',
      timestamp: '10:23:47'
    },
    { 
      step: 5, 
      node: 'Reviewer Agent', 
      status: 'waiting_approval',
      input: '結果：NT$ 12,458,392',
      output: '等待人工審核...',
      latency: '-',
      timestamp: '10:23:47'
    },
  ];

  const currentNodeProps = selectedNode ? nodeProperties[selectedNode as keyof typeof nodeProperties] : null;

  const handleExecute = () => {
    setIsExecuting(true);
    setShowTraceView(true);
    // Simulate execution
    setTimeout(() => setIsExecuting(false), 3000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] gap-4">
      {/* Main Workspace */}
      <div className="grid grid-cols-12 gap-4 flex-1">
        {/* Left Sidebar: Component Library */}
        <div className="col-span-2 card overflow-y-auto">
          <div className="card-header">
            <h4 style={{ color: 'var(--color-gray-900)' }}>元件庫</h4>
          </div>
          <div className="p-3 space-y-4">
            {componentLibrary.map((category, idx) => (
              <div key={idx}>
                <div className="text-xs font-medium mb-2 px-2" style={{ 
                  color: 'var(--color-gray-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {category.category}
                </div>
                <div className="space-y-1">
                  {category.items.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      className="w-full text-left px-3 py-2 rounded-lg transition-all hover:shadow-sm relative"
                      style={{
                        background: 'var(--color-gray-50)',
                        border: '1px solid var(--color-gray-200)',
                      }}
                      draggable
                      onDragStart={() => setIsDragging(true)}
                      onDragEnd={() => setIsDragging(false)}
                    >
                      <div className="flex items-center gap-2">
                        <div style={{ color: item.color }}>
                          {item.icon}
                        </div>
                        <span className="text-xs flex-1" style={{ color: 'var(--color-gray-700)' }}>
                          {item.name}
                        </span>
                        {item.tag && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{
                            background: 'var(--color-success)',
                            color: 'white',
                          }}>
                            {item.tag}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Canvas */}
        <div className="col-span-7 card relative overflow-hidden">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 border-b flex items-center justify-between" style={{ 
            background: 'var(--color-bg-white)',
            borderColor: 'var(--color-gray-200)' 
          }}>
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5" style={{ color: 'var(--color-primary-blue)' }} />
              <h4 style={{ color: 'var(--color-gray-900)' }}>流程設計畫布</h4>
              <span className="badge badge-info" style={{ fontSize: '10px' }}>5 節點</span>
              <span className="badge badge-warning" style={{ fontSize: '10px' }}>循環流程</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all hover:shadow-sm" 
                style={{ 
                  background: 'var(--color-gray-50)',
                  border: '1px solid var(--color-gray-200)',
                  color: 'var(--color-gray-700)'
                }}
              >
                <Save className="w-3.5 h-3.5" />
                儲存
              </button>
              <button 
                className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all" 
                style={{ 
                  background: 'var(--color-success)',
                  color: 'white',
                  border: 'none'
                }}
                onClick={handleExecute}
              >
                <Play className="w-3.5 h-3.5" />
                執行測試
              </button>
            </div>
          </div>

          {/* Dot Grid Background */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, var(--color-gray-300) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
              opacity: 0.3,
            }}
          />

          {/* Canvas Content */}
          <div className="absolute inset-0 pt-16 pb-4">
            <svg width="100%" height="100%" className="absolute inset-0">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3, 0 6"
                    fill="var(--color-gray-400)"
                  />
                </marker>
                <marker
                  id="arrowhead-conditional"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3, 0 6"
                    fill="var(--color-warning)"
                  />
                </marker>
              </defs>
              
              {/* Draw connections */}
              {connections.map((conn, idx) => {
                const fromNode = nodes.find(n => n.id === conn.from);
                const toNode = nodes.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                
                const x1 = fromNode.x + 125;
                const y1 = fromNode.y + 50;
                const x2 = toNode.x;
                const y2 = toNode.y + 50;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                
                const isConditional = conn.type === 'conditional';
                
                return (
                  <g key={idx}>
                    <path
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                      stroke={isConditional ? 'var(--color-warning)' : 'var(--color-gray-400)'}
                      strokeWidth="2"
                      strokeDasharray={isConditional ? '5,5' : '0'}
                      fill="none"
                      markerEnd={isConditional ? 'url(#arrowhead-conditional)' : 'url(#arrowhead)'}
                    />
                    {/* Condition Label */}
                    {isConditional && conn.condition && (
                      <g>
                        <rect
                          x={midX - 40}
                          y={midY - 10}
                          width="80"
                          height="20"
                          rx="4"
                          fill="var(--color-bg-white)"
                          stroke="var(--color-warning)"
                          strokeWidth="1"
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          style={{ 
                            fontSize: '10px', 
                            fill: 'var(--color-warning)',
                            fontFamily: 'monospace'
                          }}
                        >
                          {conn.condition}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Draw nodes */}
            {nodes.map((node) => (
              <div
                key={node.id}
                className="absolute cursor-move transition-all hover:shadow-lg"
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.type === 'decision' ? 120 : 250,
                }}
                onClick={() => setSelectedNode(node.id)}
              >
                {node.type === 'decision' ? (
                  /* Diamond Decision Node */
                  <div className="relative" style={{ height: 100 }}>
                    <svg width="120" height="100" className="absolute inset-0">
                      <polygon
                        points="60,10 110,50 60,90 10,50"
                        fill="var(--color-bg-white)"
                        stroke={selectedNode === node.id ? node.color : 'var(--color-gray-300)'}
                        strokeWidth={selectedNode === node.id ? '3' : '2'}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div style={{ color: node.color }}>
                        {node.icon}
                      </div>
                      <div className="text-xs font-medium text-center mt-1" style={{ color: 'var(--color-gray-900)' }}>
                        {node.label}
                      </div>
                    </div>
                    {/* Connection points */}
                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-white" 
                      style={{ borderColor: node.color }} 
                    />
                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-white" 
                      style={{ borderColor: node.color }} 
                    />
                  </div>
                ) : (
                  /* Regular Node */
                  <div 
                    className="rounded-lg p-4 border-2"
                    style={{
                      background: 'var(--color-bg-white)',
                      borderColor: selectedNode === node.id ? node.color : 'var(--color-gray-300)',
                      boxShadow: selectedNode === node.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${node.color}15`, color: node.color }}
                      >
                        {node.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-gray-900)' }}>
                          {node.label}
                        </div>
                        <span 
                          className="badge"
                          style={{ 
                            background: `${node.color}15`,
                            color: node.color,
                            fontSize: '10px',
                            padding: '2px 8px'
                          }}
                        >
                          {node.type === 'agent' ? 'Agent' : node.type === 'tool' ? 'Tool' : node.type}
                        </span>
                      </div>
                      <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                    </div>

                    {/* Connection points */}
                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-white" 
                      style={{ borderColor: node.color }} 
                    />
                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-white" 
                      style={{ borderColor: node.color }} 
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <div className="col-span-3 card overflow-y-auto">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
              <h4 style={{ color: 'var(--color-gray-900)' }}>屬性設定</h4>
            </div>
          </div>
          
          {currentNodeProps ? (
            <div className="p-4 space-y-4">
              {/* Node Info */}
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0, 82, 204, 0.05)' }}>
                <div className="font-medium mb-1" style={{ color: 'var(--color-gray-900)' }}>
                  {currentNodeProps.title}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                  {currentNodeProps.description}
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                {currentNodeProps.settings.map((setting: any, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--color-gray-700)' }}>
                        {setting.icon && <span style={{ color: 'var(--color-gray-400)' }}>{setting.icon}</span>}
                        {setting.label}
                        {setting.tag && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium ml-1" style={{
                            background: 'var(--color-success)',
                            color: 'white',
                          }}>
                            {setting.tag}
                          </span>
                        )}
                      </label>
                      {setting.unit && (
                        <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                          {setting.unit}
                        </span>
                      )}
                    </div>
                    
                    {setting.description && (
                      <div className="text-xs mb-2" style={{ color: 'var(--color-gray-400)' }}>
                        {setting.description}
                      </div>
                    )}
                    
                    {setting.type === 'select' && (
                      <select 
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ 
                          borderColor: 'var(--color-gray-300)',
                          background: 'var(--color-bg-white)'
                        }}
                        defaultValue={setting.value as string}
                      >
                        {setting.options?.map((opt: string, i: number) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    
                    {setting.type === 'multiselect' && (
                      <div className="space-y-2">
                        {['Text2SQL', 'Web Search', 'Document Retrieval', 'Custom API'].map((tool, i) => (
                          <label key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked={(setting.value as string[]).includes(tool)}
                              className="w-4 h-4 rounded"
                              style={{ accentColor: 'var(--color-primary-blue)' }}
                            />
                            <span className="text-sm" style={{ color: 'var(--color-gray-700)' }}>
                              {tool}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {setting.type === 'text' && (
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                        style={{ 
                          borderColor: 'var(--color-gray-300)',
                          background: 'var(--color-bg-white)'
                        }}
                        defaultValue={setting.value as string}
                        placeholder="輸入連接字串..."
                      />
                    )}
                    
                    {setting.type === 'file' && (
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
                        style={{ borderColor: 'var(--color-gray-300)' }}
                      >
                        <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-gray-400)' }} />
                        <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                          上傳 Schema 定義檔案
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-gray-300)' }}>
                          支援 .sql, .ddl 格式
                        </div>
                      </div>
                    )}
                    
                    {setting.type === 'button' && (
                      <button className="w-full px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-all hover:shadow-sm" style={{ 
                        background: 'var(--color-gray-50)',
                        border: '1px solid var(--color-gray-200)',
                        color: 'var(--color-gray-700)'
                      }}>
                        <Eye className="w-4 h-4" />
                        查看 DDL 預覽
                      </button>
                    )}
                    
                    {setting.type === 'slider' && (
                      <div>
                        <input
                          type="range"
                          min={setting.min}
                          max={setting.max}
                          step={setting.step}
                          defaultValue={setting.value as number}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, var(--color-primary-blue) 0%, var(--color-primary-blue) ${((setting.value as number) / (setting.max || 1)) * 100}%, var(--color-gray-200) ${((setting.value as number) / (setting.max || 1)) * 100}%, var(--color-gray-200) 100%)`,
                          }}
                        />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                            {setting.min}
                          </span>
                          <span className="text-xs font-mono" style={{ color: 'var(--color-primary-blue)' }}>
                            {setting.value}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                            {setting.max}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {setting.type === 'textarea' && (
                      <div>
                        <textarea
                          className="w-full px-3 py-2 rounded-lg text-xs border resize-none font-mono"
                          style={{ 
                            borderColor: 'var(--color-gray-300)',
                            background: 'var(--color-bg-white)',
                            minHeight: setting.expandable ? '120px' : '80px'
                          }}
                          value={setting.value as string}
                          readOnly
                        />
                        <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>
                          💡 提示：使用 {'{'}變數名{'}'} 插入動態內容
                        </div>
                      </div>
                    )}
                    
                    {setting.type === 'number' && (
                      <input
                        type="number"
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ 
                          borderColor: 'var(--color-gray-300)',
                          background: 'var(--color-bg-white)'
                        }}
                        defaultValue={setting.value as number}
                      />
                    )}
                    
                    {setting.type === 'checkbox' && (
                      <label className="flex items-center gap-2 p-3 rounded-lg cursor-pointer hover:bg-gray-50" style={{
                        border: '1px solid var(--color-gray-200)'
                      }}>
                        <input
                          type="checkbox"
                          defaultChecked={setting.value as boolean}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: 'var(--color-primary-blue)' }}
                        />
                        <span className="text-sm flex-1" style={{ color: 'var(--color-gray-700)' }}>
                          啟用此功能
                        </span>
                        {setting.description && (
                          <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                            ({setting.description})
                          </span>
                        )}
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-gray-200)' }}>
                <button className="btn-primary w-full text-sm">
                  套用變更
                </button>
                <button className="w-full px-4 py-2 rounded-lg text-sm transition-all" style={{ 
                  background: 'var(--color-gray-50)',
                  border: '1px solid var(--color-gray-200)',
                  color: 'var(--color-gray-700)'
                }}>
                  重設為預設值
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Workflow className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-gray-300)' }} />
              <div className="text-sm" style={{ color: 'var(--color-gray-400)' }}>
                請選擇一個節點<br/>來查看其屬性設定
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Trace View Panel */}
      {showTraceView && (
        <div className="card" style={{ height: '300px' }}>
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
                <h4 style={{ color: 'var(--color-gray-900)' }}>執行軌跡檢視 (Trace View)</h4>
                {isExecuting && (
                  <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                    執行中...
                  </span>
                )}
              </div>
              <button 
                className="text-xs" 
                style={{ color: 'var(--color-gray-400)' }}
                onClick={() => setShowTraceView(false)}
              >
                收起
              </button>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
            <div className="p-4 space-y-3">
              {traceSteps.map((trace, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg border"
                  style={{ 
                    borderColor: trace.status === 'completed' ? 'var(--color-success)' : 
                                 trace.status === 'waiting_approval' ? 'var(--color-warning)' : 
                                 'var(--color-gray-200)',
                    background: trace.status === 'waiting_approval' ? 'rgba(255, 171, 0, 0.05)' : 'var(--color-gray-50)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Step Number */}
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                      style={{ 
                        background: trace.status === 'completed' ? 'var(--color-success)' : 
                                   trace.status === 'waiting_approval' ? 'var(--color-warning)' : 
                                   'var(--color-gray-300)',
                        color: 'white'
                      }}
                    >
                      {trace.step}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm" style={{ color: 'var(--color-gray-900)' }}>
                          {trace.node}
                        </span>
                        {trace.status === 'completed' && (
                          <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                        )}
                        {trace.status === 'waiting_approval' && (
                          <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                        )}
                        <span className="text-xs font-mono ml-auto" style={{ color: 'var(--color-gray-400)' }}>
                          {trace.latency}
                        </span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="text-xs">
                          <span style={{ color: 'var(--color-gray-400)' }}>Input: </span>
                          <span className="font-mono" style={{ color: 'var(--color-gray-700)' }}>
                            {trace.input}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span style={{ color: 'var(--color-gray-400)' }}>Output: </span>
                          <span className="font-mono" style={{ color: 'var(--color-primary-blue)' }}>
                            {trace.output}
                          </span>
                        </div>
                      </div>
                      
                      {trace.status === 'waiting_approval' && (
                        <div className="flex items-center gap-2 mt-3">
                          <button className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{
                            background: 'var(--color-success)',
                            color: 'white',
                            border: 'none'
                          }}>
                            <CheckCircle className="w-3.5 h-3.5" />
                            批准通過
                          </button>
                          <button className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{
                            background: 'var(--color-danger)',
                            color: 'white',
                            border: 'none'
                          }}>
                            <XCircle className="w-3.5 h-3.5" />
                            駁回重做
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
      )}
    </div>
  );
}