import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, RefreshCw, X, Building2, Check } from 'lucide-react';

type TabType = 'civil' | 'self';
type RoleType = 'admin' | 'applicant' | 'user';

interface UserAccount {
  id: string;
  username: string;
  email: string;
  department: string;
  role: RoleType;
  source: 'civil' | 'self';
  status: 'active' | 'inactive';
  lastLogin: string;
}

const ROLE_CONFIG: Record<RoleType, { label: string; bg: string; color: string }> = {
  admin:     { label: '管理者',     bg: '#DEEBFF', color: '#0052CC' },
  applicant: { label: '專案申請者', bg: '#FFF0B3', color: '#FF8B00' },
  user:      { label: '一般使用者', bg: '#F4F5F7', color: '#505F79' },
};

const INITIAL_CIVIL: UserAccount[] = [
  { id: 'c1', username: '王大明', email: 'wang.dm@gov.tw',   department: '資訊處',    role: 'admin',     source: 'civil', status: 'active',   lastLogin: '2026-07-09 09:32' },
  { id: 'c2', username: '李小華', email: 'li.xh@gov.tw',    department: '企劃處',    role: 'applicant', source: 'civil', status: 'active',   lastLogin: '2026-07-08 14:17' },
  { id: 'c3', username: '陳志偉', email: 'chen.zw@gov.tw',  department: '研究發展處', role: 'applicant', source: 'civil', status: 'active',   lastLogin: '2026-07-07 10:05' },
  { id: 'c4', username: '林美玲', email: 'lin.ml@gov.tw',   department: '行政處',    role: 'user',      source: 'civil', status: 'active',   lastLogin: '2026-07-06 16:48' },
  { id: 'c5', username: '黃建國', email: 'huang.jg@gov.tw', department: '資訊處',    role: 'user',      source: 'civil', status: 'inactive', lastLogin: '2026-06-20 11:23' },
  { id: 'c6', username: '張淑芬', email: 'zhang.sf@gov.tw', department: '政策規劃處', role: 'applicant', source: 'civil', status: 'active',   lastLogin: '2026-07-09 08:14' },
  { id: 'c7', username: '吳宗翰', email: 'wu.zh@gov.tw',    department: '研究發展處', role: 'user',      source: 'civil', status: 'active',   lastLogin: '2026-07-05 13:37' },
];

const INITIAL_SELF: UserAccount[] = [
  { id: 's1', username: 'admin_sys',      email: 'admin@aiplatform.tw', department: '平台維運',  role: 'admin', source: 'self', status: 'active',   lastLogin: '2026-07-09 07:00' },
  { id: 's2', username: 'contractor_01',  email: 'c01@vendor.com',      department: '外包廠商 A', role: 'user',  source: 'self', status: 'active',   lastLogin: '2026-07-08 09:20' },
  { id: 's3', username: 'test_user_beta', email: 'beta@aiplatform.tw',  department: '測試帳號',  role: 'user',  source: 'self', status: 'inactive', lastLogin: '2026-06-30 15:00' },
];

const BLANK_NEW = { username: '', email: '', department: '', role: 'user' as RoleType };

export function AccountManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('civil');
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [newUser, setNewUser]     = useState(BLANK_NEW);
  const [civil, setCivil]         = useState(INITIAL_CIVIL);
  const [self, setSelf]           = useState(INITIAL_SELF);

  const setList = activeTab === 'civil' ? setCivil : setSelf;
  const list    = (activeTab === 'civil' ? civil : self).filter(a =>
    [a.username, a.email, a.department].some(v => v.includes(search))
  );
  const all = [...civil, ...self];

  const openAdd = () => { setEditId(null); setNewUser(BLANK_NEW); setShowModal(true); };
  const openEdit = (a: UserAccount) => {
    setEditId(a.id);
    setNewUser({ username: a.username, email: a.email, department: a.department, role: a.role });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!newUser.username || !newUser.email) return;
    if (editId) {
      setList(prev => prev.map(a => a.id === editId ? { ...a, ...newUser } : a));
    } else {
      const entry: UserAccount = { id: `s${Date.now()}`, ...newUser, source: 'self', status: 'active', lastLogin: '—' };
      setSelf(prev => [...prev, entry]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => setList(prev => prev.filter(a => a.id !== id));

  const tabs = [
    { key: 'civil' as TabType, label: '介接公務系統', count: civil.length },
    { key: 'self'  as TabType, label: '系統自管帳號', count: self.length  },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '總帳號數',   value: all.length,                              sub: `公務 ${civil.length} ／ 自管 ${self.length}`,              color: 'var(--color-gray-900)' },
          { label: '作用中',    value: all.filter(a => a.status === 'active').length,   sub: `已停用 ${all.filter(a => a.status === 'inactive').length}`, color: '#006644' },
          { label: '管理者',    value: all.filter(a => a.role === 'admin').length,       sub: '具全域管理權限',                                          color: 'var(--color-primary-blue)' },
          { label: '專案申請者', value: all.filter(a => a.role === 'applicant').length,  sub: '可提交算力申請',                                          color: '#FF8B00' },
        ].map(s => (
          <div key={s.label} className="card card-body">
            <div className="text-xs mb-1" style={{ color: 'var(--color-gray-400)' }}>{s.label}</div>
            <div className="text-2xl" style={{ color: s.color, fontWeight: 700 }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="card">
        {/* Tabs */}
        <div className="border-b flex items-center justify-between px-5 pt-4" style={{ borderColor: 'var(--color-gray-200)' }}>
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 16px 12px',
                  color: activeTab === tab.key ? 'var(--color-primary-blue)' : 'var(--color-gray-500)',
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  borderBottom: activeTab === tab.key ? '2px solid var(--color-primary-blue)' : '2px solid transparent',
                  fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {tab.label}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 9999, padding: '1px 8px', fontSize: 11, minWidth: 22,
                  background: activeTab === tab.key ? '#DEEBFF' : 'var(--color-gray-100)',
                  color: activeTab === tab.key ? 'var(--color-primary-blue)' : 'var(--color-gray-500)',
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="pb-3">
            {activeTab === 'civil' ? (
              <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-gray-400)' }}>
                <RefreshCw className="w-3 h-3" />
                最後同步：2026-07-09 06:00（唯讀）
              </span>
            ) : (
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white"
                style={{ background: 'var(--color-primary-blue)', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                <Plus className="w-4 h-4" />新增使用者
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-gray-100)' }}>
          <div className="relative" style={{ maxWidth: 320 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-gray-400)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋使用者名稱、部門、郵件…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--color-gray-200)', outline: 'none', color: 'var(--color-gray-700)' }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                {['使用者名稱', '電子郵件', '部門', '角色', '帳號來源', '狀態', '最後登入', '操作'].map(col => (
                  <th key={col} className="text-left px-5 py-3 text-xs"
                    style={{ color: 'var(--color-gray-400)', fontWeight: 600, background: 'var(--color-gray-50)' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a, idx) => {
                const rc = ROLE_CONFIG[a.role];
                const isCivil = activeTab === 'civil';
                return (
                  <tr key={a.id}
                    style={{ borderBottom: idx < list.length - 1 ? '1px solid var(--color-gray-100)' : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-gray-50)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-gray-900)', fontWeight: 500 }}>{a.username}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-gray-500)' }}>{a.email}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--color-gray-600)' }}>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--color-gray-400)' }} />
                        {a.department}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs"
                        style={{ background: rc.bg, color: rc.color, fontWeight: 600 }}>
                        {rc.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs"
                        style={{
                          background: a.source === 'civil' ? '#E3FCEF' : '#EAE6FF',
                          color: a.source === 'civil' ? '#006644' : '#403294',
                          fontWeight: 500,
                        }}>
                        {a.source === 'civil' ? '公務系統' : '系統自管'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: a.status === 'active' ? '#006644' : 'var(--color-gray-400)' }}>
                        <span className="w-1.5 h-1.5 rounded-full"
                          style={{ background: a.status === 'active' ? '#57D9A3' : 'var(--color-gray-300)' }} />
                        {a.status === 'active' ? '啟用中' : '已停用'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-gray-400)' }}>{a.lastLogin}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-0.5">
                        <button
                          disabled={isCivil}
                          onClick={() => !isCivil && openEdit(a)}
                          title={isCivil ? '公務系統帳號唯讀' : '編輯'}
                          className="p-1.5 rounded transition-colors"
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-gray-400)', cursor: isCivil ? 'not-allowed' : 'pointer', opacity: isCivil ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!isCivil) e.currentTarget.style.color = 'var(--color-primary-blue)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-gray-400)'; }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          disabled={isCivil}
                          onClick={() => !isCivil && handleDelete(a.id)}
                          title={isCivil ? '公務系統帳號唯讀' : '刪除'}
                          className="p-1.5 rounded transition-colors"
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-gray-400)', cursor: isCivil ? 'not-allowed' : 'pointer', opacity: isCivil ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!isCivil) e.currentTarget.style.color = '#DE350B'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-gray-400)'; }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--color-gray-400)' }}>
              無符合條件的帳號
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full p-6" style={{ maxWidth: 440, border: '1px solid var(--color-gray-200)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ color: 'var(--color-gray-900)' }}>{editId ? '編輯帳號資訊' : '新增自管使用者'}</h3>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-gray-400)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: '使用者名稱 *', key: 'username', type: 'text', placeholder: '輸入帳號名稱' },
                { label: '電子郵件 *',  key: 'email',    type: 'email', placeholder: 'user@example.com' },
                { label: '所屬部門',    key: 'department', type: 'text', placeholder: '例如：資訊處' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--color-gray-700)', fontWeight: 500 }}>{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(newUser as Record<string, string>)[f.key]}
                    onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ border: '1px solid var(--color-gray-200)', outline: 'none', color: 'var(--color-gray-900)' }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-gray-700)', fontWeight: 500 }}>角色</label>
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as RoleType }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid var(--color-gray-200)', outline: 'none', color: 'var(--color-gray-900)', background: 'white' }}>
                  <option value="user">一般使用者</option>
                  <option value="applicant">專案申請者</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', color: 'var(--color-gray-700)' }}>
                取消
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white"
                style={{ background: newUser.username && newUser.email ? 'var(--color-primary-blue)' : 'var(--color-gray-300)', border: 'none', cursor: newUser.username && newUser.email ? 'pointer' : 'not-allowed', fontWeight: 500 }}>
                <Check className="w-4 h-4" />
                {editId ? '儲存變更' : '確認新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
