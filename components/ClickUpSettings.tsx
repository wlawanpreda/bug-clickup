
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clickUpService } from '../services/clickUpService';
import { ClickUpConfig, Workspace, List, RecentBoard } from '../types';

interface Props {
  onConfigSaved: (config: ClickUpConfig) => void;
  onCancel?: () => void;
  initialConfig?: ClickUpConfig | null;
}

const ClickUpSettings: React.FC<Props> = ({ onConfigSaved, onCancel, initialConfig }) => {
  const [token, setToken] = useState(initialConfig?.apiToken || '');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(initialConfig?.workspaceId || '');
  const [selectedList, setSelectedList] = useState(initialConfig?.listId || '');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>(initialConfig?.recentBoards || []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef<string>('');

  const fetchWorkspaces = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse) return;
    setLoading(true);
    setError(null);
    try {
      const data = await clickUpService.getWorkspaces(tokenToUse);
      setWorkspaces(data);
      return data;
    } catch (err) {
      setError('API Token ไม่ถูกต้อง หรือเกิดข้อผิดพลาดในการเชื่อมต่อ');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (initialConfig?.apiToken) {
      fetchWorkspaces(initialConfig.apiToken);
      // Only set lastSavedRef on the very first load or if explicitly changed from outside
      if (!lastSavedRef.current) {
        lastSavedRef.current = JSON.stringify({
          apiToken: initialConfig.apiToken,
          workspaceId: initialConfig.workspaceId,
          listId: initialConfig.listId
        });
      }
    }
  }, [initialConfig?.apiToken, fetchWorkspaces]); // Depend ONLY on token to prevent loops from workspace/list changes

  // Load List when Workspace changes
  useEffect(() => {
    if (selectedWorkspace && token) {
      const fetchLists = async () => {
        setListLoading(true);
        setLists([]);
        try {
          const data = await clickUpService.getAllLists(token, selectedWorkspace);
          setLists(data);
        } catch (err) {
          setError('ไม่สามารถดึงข้อมูลรายการ (List) ได้');
        } finally {
          setListLoading(false);
        }
      };
      fetchLists();
    }
  }, [selectedWorkspace, token]);

  // Auto-save logic
  useEffect(() => {
    if (token && selectedWorkspace && selectedList) {
      const configObj = {
        apiToken: token,
        workspaceId: selectedWorkspace,
        listId: selectedList
      };
      const configStr = JSON.stringify(configObj);
      
      if (configStr !== lastSavedRef.current) {
        // Find the name of the selected list
        const listName = lists.find(l => l.id === selectedList)?.name || 
                         recentBoards.find(rb => rb.listId === selectedList)?.name || 
                         'Unknown Board';

        const existingRecentIndex = recentBoards.findIndex(rb => rb.listId === selectedList);
        let updatedRecent = [...recentBoards];

        const newEntry: RecentBoard = {
          listId: selectedList,
          workspaceId: selectedWorkspace,
          name: listName,
          lastUsed: new Date().toISOString()
        };

        if (existingRecentIndex > -1) {
          updatedRecent.splice(existingRecentIndex, 1);
        }
        updatedRecent.unshift(newEntry);
        updatedRecent = updatedRecent.slice(0, 5); // Keep last 5

        const currentConfig: ClickUpConfig = {
          ...configObj,
          recentBoards: updatedRecent
        };
        
        onConfigSaved(currentConfig);
        setRecentBoards(updatedRecent);
        lastSavedRef.current = configStr;
        setAutoSaved(true);
        const timer = setTimeout(() => setAutoSaved(false), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [token, selectedWorkspace, selectedList, onConfigSaved, lists, recentBoards]);

  const handleRemoveRecent = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    const updated = recentBoards.filter(rb => rb.listId !== listId);
    setRecentBoards(updated);
    
    const currentConfig: ClickUpConfig = {
      apiToken: token,
      workspaceId: selectedWorkspace,
      listId: selectedList,
      recentBoards: updated
    };
    onConfigSaved(currentConfig);
  };

  const handleSelectRecent = (rb: RecentBoard) => {
    setSelectedWorkspace(rb.workspaceId);
    setSelectedList(rb.listId);
  };

  const handleExportJSON = () => {
    const configData = {
      apiToken: token,
      workspaceId: selectedWorkspace,
      listId: selectedList,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clickup-config-${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.apiToken) {
          setToken(json.apiToken);
          const ws = await fetchWorkspaces(json.apiToken);
          if (ws && json.workspaceId) {
            setSelectedWorkspace(json.workspaceId);
            if (json.listId) {
              setSelectedList(json.listId);
            }
          }
          alert('นำเข้าการตั้งค่าเรียบร้อยแล้ว');
        } else {
          throw new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFinish = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const filteredLists = lists.filter(l => 
    l.name.toLowerCase().includes(listSearch.toLowerCase())
  );

  return (
    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-300 w-full max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <img src="https://clickup.com/favicon.ico" className="w-8 h-8" alt="ClickUp" />
          ตั้งค่าการเชื่อมต่อ
        </h2>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        )}
      </div>
      
      <div className="space-y-6">
        <div className="flex gap-2 mb-2">
          <button 
            onClick={handleExportJSON}
            className="flex-1 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Export JSON
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Import JSON
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".json" 
            className="hidden" 
            onChange={handleImportJSON}
          />
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-900 mb-2 uppercase tracking-wide flex justify-between">
            <span>Personal API Token</span>
            {autoSaved && <span className="text-green-600 animate-pulse text-[10px] normal-case">✓ บันทึกอัตโนมัติแล้ว</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 bg-white border-2 border-gray-400 rounded-xl px-4 py-3 text-base font-bold text-black focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition placeholder-gray-500 shadow-sm"
              placeholder="pk_..."
            />
            <button
              onClick={() => fetchWorkspaces(token)}
              className="bg-purple-700 text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-purple-800 transition shadow-md active:scale-95 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? '...' : 'ตรวจสอบ'}
            </button>
          </div>
        </div>

        {recentBoards.length > 0 && (
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">ใช้บอร์ดที่เพิ่งเปิดอีกล่าสุด</label>
            <div className="flex flex-wrap gap-2">
              {recentBoards.map((rb) => (
                <div 
                  key={rb.listId}
                  onClick={() => handleSelectRecent(rb)}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition cursor-pointer text-xs font-bold ${
                    selectedList === rb.listId 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'
                  }`}
                >
                  <span className="max-w-[120px] truncate">{rb.name.split(' > ').pop()}</span>
                  <button 
                    onClick={(e) => handleRemoveRecent(e, rb.listId)}
                    className={`p-0.5 rounded-full hover:bg-red-500 hover:text-white transition ${
                      selectedList === rb.listId ? 'text-indigo-200' : 'text-gray-300'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-extrabold text-gray-900 mb-2 uppercase tracking-wide">เลือก Workspace</label>
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="w-full bg-white border-2 border-gray-400 rounded-xl px-4 py-3 text-base font-bold text-black focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition shadow-sm"
            >
              <option value="">-- เลือก Workspace --</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedWorkspace && (
          <div className="animate-in fade-in slide-in-from-top-2 relative space-y-3">
            <div className="flex justify-between items-end">
              <label className="block text-sm font-extrabold text-gray-900 uppercase tracking-wide">ค้นหาบอร์ด / ทีม / ปี</label>
              {listLoading && <div className="text-[10px] font-black text-indigo-600 animate-pulse uppercase">กำลังดึงข้อมูลบอร์ดทั้งหมด...</div>}
            </div>
            
            <div className="relative">
              <input 
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="พิมพ์ ปี (2026) หรือ ชื่อทีม (Brooklyn)..."
                className="w-full bg-indigo-50/50 border-2 border-indigo-200 rounded-xl px-4 py-2 text-sm font-bold text-indigo-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition placeholder-indigo-300"
              />
              <div className="absolute right-3 top-2.5 text-indigo-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>

            <div className="relative">
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                disabled={listLoading}
                className={`w-full bg-white border-2 border-gray-400 rounded-xl px-4 py-3 text-sm font-bold text-black focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition shadow-sm ${listLoading ? 'opacity-50' : ''}`}
              >
                <option value="">{listLoading ? 'กำลังโหลด...' : `-- เลือกรายการ (${filteredLists.length}) --`}</option>
                {filteredLists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {listLoading && (
                <div className="absolute left-0 right-0 -bottom-1 h-1 bg-indigo-100 overflow-hidden rounded-full">
                  <div className="h-full bg-indigo-600 animate-[loading_1.5s_infinite] w-1/3"></div>
                </div>
              )}
            </div>
            {listSearch && filteredLists.length === 0 && !listLoading && (
              <p className="text-[10px] font-bold text-red-500">❌ ไม่พบบอร์ดที่ตรงกับคำค้นหา "{listSearch}"</p>
            )}
          </div>
        )}

        {error && <p className="text-red-700 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-200 mt-2">{error}</p>}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleFinish}
            disabled={!selectedList || loading || listLoading}
            className="w-full bg-indigo-700 text-white py-4 rounded-xl font-black text-lg hover:bg-indigo-800 disabled:opacity-50 transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            {autoSaved ? (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                บันทึกเรียบร้อย เริ่มใช้งานเลย
              </>
            ) : (
              'พร้อมใช้งานแล้ว'
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default ClickUpSettings;
