import React, { useState, useRef, useMemo } from "react";
import {
  Brain,
  Activity,
  Zap,
  Settings,
  BarChart3,
  Eye,
  Wrench,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Upload,
  Download,
  Plus,
  FileUp,
  Tag,
  FileText,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

export function ModelOpsDashboard() {
  const models = [
    {
      id: "llama-3.3-70b",
      name: "Llama 3.3 70B",
      version: "v1.2.0",
      versionHistory: ["v1.2.0", "v1.1.5", "v1.1.0", "v1.0.3", "v1.0.0"],
      status: "Active",
      type: "LLM",
      provider: "vLLM",
      providerColor: "#76B900",
      contextWindow: "128K",
      temperature: 0.7,
      maxTokens: 4096,
      requests: 1247,
      avgLatency: 234,
      p95Latency: 412,
      p99Latency: 587,
      errorRate: 0.5,
    },
    {
      id: "nemotron",
      name: "Llama-3.3-Nemotron",
      version: "v2.0.1",
      versionHistory: ["v2.0.1", "v2.0.0", "v1.9.8", "v1.9.5", "v1.9.0"],
      status: "Active",
      type: "LLM",
      provider: "Azure OpenAI",
      providerColor: "#0078D4",
      contextWindow: "128K",
      temperature: 0.8,
      maxTokens: 4096,
      requests: 892,
      avgLatency: 312,
      p95Latency: 523,
      p99Latency: 698,
      errorRate: 1.2,
    },
    {
      id: "gpt-oss-120b",
      name: "GPT-oss-120B",
      version: "v3.1.0",
      versionHistory: ["v3.1.0", "v3.0.8", "v3.0.5", "v3.0.0", "v2.9.0"],
      status: "Active",
      type: "LLM",
      provider: "AWS Bedrock",
      providerColor: "#FF9900",
      contextWindow: "256K",
      temperature: 0.6,
      maxTokens: 8192,
      requests: 563,
      avgLatency: 456,
      p95Latency: 789,
      p99Latency: 1024,
      errorRate: 0.8,
    },
    {
      id: "gemma-3-27b",
      name: "Gemma 3 27B",
      version: "v1.5.2",
      versionHistory: ["v1.5.2", "v1.5.0", "v1.4.8", "v1.4.5", "v1.4.0"],
      status: "Active",
      type: "VLM",
      provider: "HuggingFace",
      providerColor: "#FFD21E",
      contextWindow: "64K",
      temperature: 0.5,
      maxTokens: 2048,
      requests: 324,
      avgLatency: 187,
      p95Latency: 298,
      p99Latency: 412,
      errorRate: 0.3,
    },
  ];

  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configModelId, setConfigModelId] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'Instance' | 'LLM'>('LLM');
  const [uploadName, setUploadName] = useState('');
  const [uploadTag, setUploadTag] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetUploadForm = () => {
    setUploadType('LLM'); setUploadName(''); setUploadTag('');
    setUploadDesc(''); setUploadFile(null); setDragOver(false);
    setUploading(false); setUploadDone(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setUploadFile(f);
  };

  const handleUpload = () => {
    if (!uploadName || !uploadTag || !uploadDesc) return;
    setUploading(true);
    setTimeout(() => { setUploading(false); setUploadDone(true); }, 1800);
  };

  // Mock traffic data with input/output token split
  const generateTrafficData = () => {
    const data = [];
    for (let i = 0; i < 20; i++) {
      const totalTokens = 2000 + Math.random() * 1500;
      data.push({
        time: `${14 + Math.floor(i / 4)}:${(i % 4) * 15}`.padEnd(
          5,
          "0",
        ),
        inputTokens: totalTokens * 0.3,
        outputTokens: totalTokens * 0.7,
        p95Latency: 350 + Math.random() * 150,
        p99Latency: 550 + Math.random() * 200,
        requests: 50 + Math.random() * 100,
        errors: Math.random() * 3,
      });
    }
    return data;
  };

  const trafficData = useMemo(() => generateTrafficData(), []);

  // Routing strategies
  const routingPolicies = [
    {
      name: "負載均衡策略",
      value: "Least Latency",
      options: [
        "Round Robin",
        "Least Latency",
        "Random",
        "Weighted",
      ],
    },
    {
      name: "Fallback 設定",
      value: "GPT-oss-120B",
      description: "Llama 3.3 失敗時自動轉發",
    },
    {
      name: "參數上限控制",
      maxTemp: 1.0,
      maxTokens: 8192,
    },
  ];

  const auditLogs = [
    {
      user: "user-1247",
      model: "Llama 3.3 70B",
      inputTokens: 847,
      outputTokens: 2000,
      time: "10:23:45",
      cost: 0.12,
      latency: 234,
      status: 200,
    },
    {
      user: "user-892",
      model: "Nemotron",
      inputTokens: 523,
      outputTokens: 1000,
      time: "10:22:31",
      cost: 0.08,
      latency: 312,
      status: 200,
    },
    {
      user: "user-563",
      model: "GPT-oss-120B",
      inputTokens: 1125,
      outputTokens: 3000,
      time: "10:21:18",
      cost: 0.19,
      latency: 456,
      status: 200,
    },
    {
      user: "user-324",
      model: "Gemma 3 27B",
      inputTokens: 392,
      outputTokens: 500,
      time: "10:20:05",
      cost: 0.04,
      latency: 187,
      status: 429,
    },
  ];

  const avgErrorRate =
    models.reduce((sum, m) => sum + m.errorRate, 0) /
    models.length;

  const currentConfigModel = configModelId ? models.find(m => m.id === configModelId) : null;

  return (
    <div className="space-y-6">
      {/* Top Section: Model Registry */}
      <div>
        <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: "var(--color-gray-900)" }}>模型註冊中心</h3>
            <button
              onClick={() => { resetUploadForm(); setUploadModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
              style={{ background: "var(--color-primary-blue)", color: "white", border: "none", cursor: "pointer" }}
            >
              <Plus className="w-4 h-4" />
              上傳模型
            </button>
          </div>

          {/* Model List */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>模型</th>
                    <th>類型</th>
                    <th>版本</th>
                    <th>狀態</th>
                    <th>供應商</th>
                    <th>Context</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      style={{
                        background: selectedModel === model.id ? "rgba(0,82,204,0.04)" : undefined,
                        cursor: "pointer",
                      }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: model.type === "VLM" ? "rgba(0,184,217,0.1)" : "rgba(0,82,204,0.1)" }}
                          >
                            {model.type === "VLM"
                              ? <Eye className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
                              : <Brain className="w-4 h-4" style={{ color: "var(--color-primary-blue)" }} />}
                          </div>
                          <span className="font-medium text-sm" style={{ color: "var(--color-gray-900)" }}>{model.name}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: model.type === "VLM" ? "rgba(0,184,217,0.1)" : "rgba(0,82,204,0.1)", color: model.type === "VLM" ? "var(--color-teal)" : "var(--color-primary-blue)" }}
                        >{model.type}</span>
                      </td>
                      <td>
                        <span className="text-xs font-mono" style={{ color: "var(--color-gray-600)" }}>{model.version}</span>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: "10px" }}>Active</span>
                      </td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: `${model.providerColor}15`, color: model.providerColor }}>{model.provider}</span>
                      </td>
                      <td>
                        <span className="text-xs font-mono" style={{ color: "var(--color-gray-700)" }}>{model.contextWindow}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:shadow-sm"
                            style={{ background: "rgba(0,82,204,0.08)", color: "var(--color-primary-blue)", border: "none", cursor: "pointer" }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            下載
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </div>

      {/* Upload Model Modal */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(100,116,139,0.45)" }}
          onClick={() => { setUploadModalOpen(false); resetUploadForm(); }}
        >
          <div
            className="relative w-full max-w-xl rounded-xl shadow-2xl"
            style={{ background: "var(--color-bg-white)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-7 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-gray-200)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,82,204,0.1)" }}>
                  <Upload className="w-5 h-5" style={{ color: "var(--color-primary-blue)" }} />
                </div>
                <div>
                  <h3 style={{ color: "var(--color-gray-900)" }}>上傳模型</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-gray-400)" }}>將模型上傳至模型註冊中心</p>
                </div>
              </div>
              <button onClick={() => { setUploadModalOpen(false); resetUploadForm(); }} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ border: "none", cursor: "pointer", background: "transparent" }}>
                <X className="w-5 h-5" style={{ color: "var(--color-gray-400)" }} />
              </button>
            </div>

            <div className="px-7 py-6 space-y-5">
              {/* Model Type */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: "var(--color-gray-700)" }}>
                  模型類型 <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <div className="flex gap-3">
                  {(["Instance", "LLM"] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border-2 flex-1 transition-all" style={{ borderColor: uploadType === t ? "var(--color-primary-blue)" : "var(--color-gray-200)", background: uploadType === t ? "rgba(0,82,204,0.04)" : "transparent" }}>
                      <input type="radio" name="uploadType" checked={uploadType === t} onChange={() => setUploadType(t)} style={{ accentColor: "var(--color-primary-blue)" }} />
                      <span className="text-sm font-medium" style={{ color: uploadType === t ? "var(--color-primary-blue)" : "var(--color-gray-700)" }}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Name + Tag (side-by-side) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--color-gray-700)" }}>
                    模型名稱 <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    placeholder="例如：MyCustomLLM"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ borderColor: "var(--color-gray-300)", background: "var(--color-bg-white)", color: "var(--color-gray-700)" }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--color-gray-700)" }}>
                    模型標籤 <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-gray-400)" }} />
                    <input
                      type="text"
                      value={uploadTag}
                      onChange={e => setUploadTag(e.target.value)}
                      placeholder="例如：v1.0.0"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm font-mono"
                      style={{ borderColor: "var(--color-gray-300)", background: "var(--color-bg-white)", color: "var(--color-gray-700)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--color-gray-700)" }}>
                  模型描述 <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="請描述此模型的用途、架構或特色..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none"
                  style={{ borderColor: "var(--color-gray-300)", background: "var(--color-bg-white)", color: "var(--color-gray-700)" }}
                />
              </div>

              {/* File Upload Zone */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--color-gray-700)" }}>上傳模型檔案</label>
                <div
                  className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 transition-all cursor-pointer"
                  style={{
                    borderColor: dragOver ? "var(--color-primary-blue)" : "var(--color-gray-300)",
                    background: dragOver ? "rgba(0,82,204,0.04)" : "var(--color-gray-50)",
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".bin,.pt,.safetensors,.gguf,.onnx,.pkl"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
                  />
                  {uploadFile ? (
                    <>
                      <FileUp className="w-8 h-8 mb-2" style={{ color: "var(--color-primary-blue)" }} />
                      <div className="text-sm font-medium" style={{ color: "var(--color-primary-blue)" }}>{uploadFile.name}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--color-gray-400)" }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    </>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 mb-2" style={{ color: "var(--color-gray-400)" }} />
                      <div className="text-sm" style={{ color: "var(--color-gray-600)" }}>點擊選擇檔案或拖放至此</div>
                      <div className="text-xs mt-1" style={{ color: "var(--color-gray-400)" }}>.bin · .pt · .safetensors · .gguf · .onnx · .pkl</div>
                    </>
                  )}
                </div>
              </div>

              {/* Upload Done message */}
              {uploadDone && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: "rgba(54,179,126,0.08)", border: "1px solid rgba(54,179,126,0.25)" }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-success)" }} />
                  <span className="text-sm" style={{ color: "var(--color-success)" }}>模型「{uploadName}」已成功上傳至模型註冊中心</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: "var(--color-gray-200)" }}>
              <button
                onClick={() => { setUploadModalOpen(false); resetUploadForm(); }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--color-gray-100)", color: "var(--color-gray-700)", border: "none", cursor: "pointer" }}
              >
                關閉
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadName || !uploadTag || !uploadDesc || uploading || uploadDone}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: (!uploadName || !uploadTag || !uploadDesc || uploading || uploadDone) ? "var(--color-gray-300)" : "var(--color-primary-blue)",
                  color: "white", border: "none",
                  cursor: (!uploadName || !uploadTag || !uploadDesc || uploading || uploadDone) ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.75 : 1,
                }}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "上傳中..." : uploadDone ? "已上傳" : "上傳模型"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {configModalOpen && currentConfigModel && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(100, 116, 139, 0.4)" }}
          onClick={() => setConfigModalOpen(false)}
        >
          <div 
            className="card max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
          >
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: currentConfigModel.type === "VLM" 
                        ? "rgba(0, 184, 217, 0.1)" 
                        : "rgba(0, 82, 204, 0.1)"
                    }}
                  >
                    {currentConfigModel.type === "VLM" ? (
                      <Eye className="w-5 h-5" style={{ color: "var(--color-teal)" }} />
                    ) : (
                      <Brain className="w-5 h-5" style={{ color: "var(--color-primary-blue)" }} />
                    )}
                  </div>
                  <div>
                    <h4 style={{ color: "var(--color-gray-900)" }}>
                      {currentConfigModel.name} 配置
                    </h4>
                    <div className="text-xs" style={{ color: "var(--color-gray-400)" }}>
                      {currentConfigModel.version} • {currentConfigModel.provider}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setConfigModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" style={{ color: "var(--color-gray-400)" }} />
                </button>
              </div>
            </div>
            
            <div className="card-body space-y-6">
              {/* Basic Settings */}
              <div>
                <h5 className="font-medium mb-3" style={{ color: "var(--color-gray-900)" }}>
                  基本設定
                </h5>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm mb-2 block" style={{ color: "var(--color-gray-700)" }}>
                      模型版本
                    </label>
                    <select
                      defaultValue={currentConfigModel.version}
                      className="w-full px-3 py-2 text-sm rounded-lg border"
                      style={{ 
                        borderColor: "var(--color-gray-200)",
                        background: "var(--color-bg-white)"
                      }}
                    >
                      {currentConfigModel.versionHistory.map((version, idx) => (
                        <option key={idx} value={version}>
                          {version} {idx === 0 ? '(最新版本)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs mt-1.5" style={{ color: "var(--color-gray-400)" }}>
                      共 {currentConfigModel.versionHistory.length} 個歷史版本可用
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm mb-2 block" style={{ color: "var(--color-gray-700)" }}>
                      推論供應商
                    </label>
                    <select
                      defaultValue={currentConfigModel.provider}
                      className="w-full px-3 py-2 text-sm rounded-lg border"
                      style={{ 
                        borderColor: "var(--color-gray-200)",
                        background: "var(--color-bg-white)"
                      }}
                    >
                      <option value="vLLM">vLLM</option>
                      <option value="Azure OpenAI">Azure OpenAI</option>
                      <option value="AWS Bedrock">AWS Bedrock</option>
                      <option value="HuggingFace">HuggingFace</option>
                      <option value="Ollama">Ollama</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GPU Settings */}
              <div>
                <h5 className="font-medium mb-3" style={{ color: "var(--color-gray-900)" }}>
                  GPU 配置
                </h5>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: "var(--color-gray-700)" }}>
                        GPU 類型
                      </label>
                      <select
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ 
                          borderColor: "var(--color-gray-200)",
                          background: "var(--color-bg-white)"
                        }}
                      >
                        <option value="H200">NVIDIA H200</option>
                        <option value="H100">NVIDIA H100</option>
                        <option value="A100">NVIDIA A100</option>
                        <option value="V100">NVIDIA V100</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: "var(--color-gray-700)" }}>
                        GPU 數量
                      </label>
                      <input
                        type="number"
                        defaultValue={4}
                        min={1}
                        max={8}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ 
                          borderColor: "var(--color-gray-200)",
                          background: "var(--color-bg-white)"
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm" style={{ color: "var(--color-gray-700)" }}>
                        模型 API
                      </label>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--color-gray-100)", color: "var(--color-gray-400)" }}>
                        系統自動產生
                      </span>
                    </div>
                    <div
                      className="w-full px-3 py-2 text-sm rounded-lg border font-mono select-all"
                      style={{
                        borderColor: "var(--color-gray-200)",
                        background: "var(--color-gray-50)",
                        color: "var(--color-gray-500)",
                        cursor: "default",
                        userSelect: "all"
                      }}
                    >
                      {`https://api.platform.internal/v1/models/${currentConfigModel?.id}`}
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: "var(--color-gray-400)" }}>
                      此端點由系統自動配發，無法手動修改
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div 
              className="px-6 py-4 border-t flex items-center justify-end gap-3"
              style={{ borderColor: "var(--color-gray-200)" }}
            >
              <button
                onClick={() => setConfigModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "var(--color-gray-100)",
                  color: "var(--color-gray-700)"
                }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  // Save configuration logic here
                  setConfigModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{
                  background: "var(--color-primary-blue)",
                  color: "white"
                }}
              >
                <Save className="w-4 h-4" />
                儲存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}