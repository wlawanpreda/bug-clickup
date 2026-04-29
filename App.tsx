
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClickUpConfig, SystemAnalysis } from './types';
import ClickUpSettings from './components/ClickUpSettings';
import AnalysisDisplay from './components/AnalysisDisplay';
import LoadingOverlay from './components/LoadingOverlay';
import BoardView from './components/BoardView';
import { geminiService } from './services/geminiService';
import { useAuth } from './components/AuthContext';
import { signInWithGoogle, logOut, saveUserSettings } from './services/firebase';

const App: React.FC = () => {
  const { user, loading: authLoading, userSettings, setUserSettings } = useAuth();
  const [config, setConfig] = useState<ClickUpConfig | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [analysis, setAnalysis] = useState<SystemAnalysis | null>(null);
  const [prompt, setPrompt] = useState('');
  const [purpose, setPurpose] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'board' | 'analysis'>('board');
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with Firebase userSettings
  useEffect(() => {
    if (userSettings) {
      setConfig(userSettings);
    }
  }, [userSettings]);

  const handleConfigSaved = useCallback(async (newConfig: ClickUpConfig) => {
    setConfig(newConfig);
    if (user) {
      try {
        await saveUserSettings(user.uid, newConfig);
        setUserSettings(newConfig);
      } catch (err) {
        console.error("Error saving settings to Firestore", err);
      }
    }
  }, [user, setUserSettings]);

  const closeSettings = useCallback(() => {
    setIsEditingConfig(false);
  }, []);

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const fileList = Array.from(files);
    
    fileList.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const runAnalysis = async (customPrompt?: string) => {
    if (!prompt && images.length === 0 && !purpose) return;

    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.analyzeSystem(customPrompt || prompt, purpose, images.length > 0 ? images : undefined);
      setAnalysis(result);
      setViewMode('analysis');
    } catch (err) {
      setError('การวิเคราะห์ล้มเหลว กรุณาลองใหม่อีกครั้ง');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImprovePrompt = async () => {
    if (!prompt.trim()) return;
    setIsImprovingPrompt(true);
    setError(null);
    try {
      const improved = await geminiService.improvePrompt(prompt, purpose);
      setPrompt(improved);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถปรับปรุงคำพูดได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const handleQuestionAnswered = (answer: string) => {
    const combinedPrompt = `ข้อความก่อนหน้า: ${prompt}\n\nข้อมูลเพิ่มเติมจาก PM: ${answer}`;
    runAnalysis(combinedPrompt);
  };

  const handleReset = () => {
    setAnalysis(null);
    setPrompt('');
    setPurpose('');
    setImages([]);
    setViewMode('board');
  };

  const handleTaskCreated = () => {
    setBoardRefreshKey(prev => prev + 1);
    handleReset();
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Switch to Board View: Alt + B
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setViewMode('board');
      }
      // Switch to AI Sidekick: Alt + N
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setViewMode('analysis');
      }
      // Toggle/Close Settings: Esc
      if (e.key === 'Escape') {
        if (isEditingConfig) {
          setIsEditingConfig(false);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isEditingConfig]);

  const handleLogout = async () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      try {
        await logOut();
        setConfig(null);
        setAnalysis(null);
      } catch (err) {
        console.error("Logout failed", err);
      }
    }
  };

  if (authLoading) {
    return <LoadingOverlay />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#E4E3E0] font-sans">
        <div className="max-w-md w-full bg-white border-2 border-black p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center space-y-8">
          <div className="w-20 h-20 bg-indigo-700 border-2 border-black flex items-center justify-center text-white text-4xl font-black rotate-3">P</div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-black tracking-tighter uppercase">PM's Sidekick AI</h1>
            <p className="text-sm font-bold text-gray-600 italic">"The scientific instrument for project precision."</p>
          </div>
          
          <div className="w-full h-px bg-black opacity-10"></div>
          
          <button 
            onClick={() => signInWithGoogle()}
            className="w-full bg-white hover:bg-black hover:text-white border-2 border-black py-4 px-6 rounded-none flex items-center justify-center gap-3 transition-all duration-200 group active:translate-x-1 active:translate-y-1 active:shadow-none font-black text-lg uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <svg className="w-6 h-6 group-hover:invert duration-200" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Login with Google
          </button>
          
          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-12">System Build v1.0.42 // Asia-Southeast1</p>
        </div>
      </div>
    );
  }

  if (!config || isEditingConfig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 font-sans">
        <div className="mb-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
             <img src={user.photoURL || ''} className="w-12 h-12 rounded-full border-2 border-black" alt="" />
             <div className="text-left">
               <p className="text-[10px] font-black text-indigo-700 uppercase">Authenticated As</p>
               <p className="font-bold text-gray-900">{user.displayName || user.email}</p>
             </div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">ClickUp Configuration</h1>
          <p className="text-gray-600 font-bold max-w-sm">เชื่อมต่อ API Token และเลือก List งานที่คุณต้องการจัดการ</p>
        </div>
        <ClickUpSettings 
          onConfigSaved={handleConfigSaved} 
          initialConfig={config}
          onCancel={config ? closeSettings : undefined}
        />
        <button 
          onClick={() => logOut()}
          className="mt-8 text-xs font-black text-gray-400 hover:text-black uppercase tracking-widest border-b border-transparent hover:border-black transition-all"
        >
          Not you? Switch account
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {loading && <LoadingOverlay />}
      
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">P</div>
              <h1 className="font-bold text-lg tracking-tight text-gray-900 hidden sm:block">PM Dashboard</h1>
            </div>
            
            <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('board')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition ${viewMode === 'board' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                KANBAN BOARD
              </button>
              <button 
                onClick={() => setViewMode('analysis')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition ${viewMode === 'analysis' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                AI SIDEKICK {analysis && <span className="ml-1 w-2 h-2 bg-indigo-600 rounded-full inline-block animate-pulse"></span>}
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end mr-2">
              <span className="text-[10px] font-black text-indigo-700 uppercase leading-none">{user?.displayName}</span>
              <span className="text-[9px] font-bold text-gray-400 leading-none mt-1 uppercase">Project Manager</span>
            </div>
            {user?.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full border border-gray-200" alt="" />}
            <div className="w-px h-10 bg-gray-100 hidden md:block"></div>
            <button 
              onClick={() => setIsEditingConfig(true)}
              className="text-[10px] font-black text-gray-500 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-wider transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Settings
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button 
               onClick={handleLogout}
               className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider transition"
             >
               Logout
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-[1600px] mx-auto w-full px-6 py-8">
        {viewMode === 'board' ? (
          <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-2">Project Board</h2>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Board Context:</p>
                  <div className="flex flex-wrap gap-2">
                    {config?.recentBoards?.map((rb) => (
                      <div 
                        key={rb.listId}
                        className="group relative flex items-center"
                      >
                        <button 
                          onClick={() => handleConfigSaved({...config, listId: rb.listId, workspaceId: rb.workspaceId, recentBoards: config.recentBoards})}
                          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all duration-200 border-2 ${config.listId === rb.listId ? 'bg-indigo-700 border-indigo-700 text-white shadow-lg shadow-indigo-200' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-400 hover:text-indigo-600'}`}
                        >
                          {rb.name.split(' > ').pop()}
                        </button>
                        {config.listId !== rb.listId && (
                           <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = config.recentBoards?.filter(r => r.listId !== rb.listId);
                              handleConfigSaved({...config, recentBoards: updated});
                            }}
                            className="absolute -top-1 -right-1 bg-white border border-gray-100 text-gray-400 hover:text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm z-10"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button 
                      onClick={() => setIsEditingConfig(true)}
                      className="w-8 h-8 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-indigo-400 hover:text-indigo-400 hover:bg-indigo-50 transition-all duration-200"
                    >
                      <span className="text-lg">＋</span>
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setViewMode('analysis')}
                className="bg-indigo-700 hover:bg-indigo-800 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 flex items-center gap-3 transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 active:scale-95 group"
              >
                <span className="text-xl group-hover:rotate-12 transition-transform">🤖</span> 
                <span>ใช้ AI ช่วยจัดการงาน</span>
              </button>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl shadow-indigo-50/50 p-1 flex-1 overflow-hidden min-h-[600px]">
               <BoardView config={config} refreshTrigger={boardRefreshKey} />
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full pb-20">
            {!analysis ? (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 mb-2">
                     <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                     <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">AI Sidekick Analysis Mode</span>
                  </div>
                  <h2 className="text-5xl font-black text-gray-900 leading-[1.1] tracking-tight">
                    เปลี่ยนไอเดียให้เป็น <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-600">แผนงานระดับมืออาชีพ</span>
                  </h2>
                  <p className="text-gray-500 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                    เพียงอัปโหลดภาพ หรือระบุสิ่งที่ต้องการ AI จะช่วยวิเคราะห์ สรุป <br className="hidden md:block"/> และแตกย่อยเป็น Task พร้อมทีมไปทำงานต่อได้ทันที
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Visual Inputs */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100/50 hover:shadow-2xl transition-shadow duration-500">
                      <label className="flex items-center gap-2 text-[11px] font-black text-indigo-600 mb-4 uppercase tracking-[0.15em]">
                         <span className="w-5 h-5 bg-indigo-700 text-white rounded-md flex items-center justify-center text-[9px]">1</span>
                         อัปโหลดข้อมูลภาพ
                      </label>
                      <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`border-3 border-dashed rounded-[1.5rem] p-4 flex flex-col items-center justify-center transition-all duration-300 h-64 relative overflow-hidden ${
                          isDragging ? 'border-indigo-600 bg-indigo-50/50 scale-[1.02] shadow-inner' : 'border-gray-100 bg-gray-50/50 hover:border-indigo-200'
                        }`}
                      >
                        {images.length === 0 ? (
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center cursor-pointer w-full h-full group"
                          >
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                               <svg className={`w-8 h-8 transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-300 group-hover:text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-center px-4">ลากวางรูปภาพ หรือคลิกที่นี่</p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col pt-2">
                             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <div className="grid grid-cols-2 gap-3 pb-4">
                                  {images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white bg-white group shadow-md transform hover:rotate-1 transition-all">
                                      <img src={img} className="w-full h-full object-cover" alt={`Preview ${idx}`} />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                         <button 
                                          onClick={() => removeImage(idx)}
                                          className="bg-red-500 text-white p-2 rounded-xl shadow-xl transform scale-75 group-hover:scale-100 transition-transform"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-indigo-50/50 transition-all bg-white group"
                                  >
                                    <span className="text-2xl text-indigo-300 group-hover:scale-125 transition-transform">＋</span>
                                  </div>
                                </div>
                             </div>
                             <div className="pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 -mx-4 -mb-4 p-3 px-4">
                                <span className="text-[10px] font-black text-gray-400">{images.length} ไฟล์ที่เลือก</span>
                                <button onClick={() => setImages([])} className="text-[10px] font-black text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors uppercase">ล้างทั้งหมด</button>
                             </div>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                    </div>
                  </div>

                  {/* Right Column: Detailed Context */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100/50 flex flex-col h-full">
                       <div className="grid grid-cols-1 gap-6 mb-8">
                          <div className="space-y-2">
                             <label className="flex items-center gap-2 text-[11px] font-black text-indigo-600 uppercase tracking-[0.15em]">
                                <span className="w-5 h-5 bg-indigo-700 text-white rounded-md flex items-center justify-center text-[9px]">2</span>
                                เพื่อ (วัตถุประสงค์)
                             </label>
                             <input 
                                type="text"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                placeholder="เช่น เพื่อเสนอผู้บริหาร, เพื่อสรุปความคืบหน้า..."
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-700 outline-none transition-all placeholder-gray-300 shadow-sm"
                             />
                          </div>
                       </div>

                       <div className="flex-1 space-y-2 flex flex-col">
                          <label className="flex items-center gap-2 text-[11px] font-black text-indigo-600 uppercase tracking-[0.15em]">
                             <span className="w-5 h-5 bg-indigo-700 text-white rounded-md flex items-center justify-center text-[9px]">4</span>
                             ระบุรายละเอียด/โจทย์
                          </label>
                          <div className="relative flex-1 flex flex-col group">
                            <textarea
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              placeholder="เช่น 'สรุปงานจากภาพถ่ายแชทนี้และแตกเป็น Task ย่อยให้หน่อย โดยอ้างอิงจากประวัติการคุย'..."
                              className="flex-1 min-h-[250px] w-full bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] p-5 text-base font-bold text-gray-900 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-700 outline-none transition-all placeholder-gray-300 shadow-sm resize-none"
                            />
                            {prompt.trim() && (
                              <button 
                                onClick={handleImprovePrompt}
                                disabled={isImprovingPrompt || loading}
                                className="absolute bottom-4 right-4 bg-white border border-indigo-100 hover:border-indigo-600 hover:bg-indigo-600 text-indigo-700 hover:text-white px-4 py-2 rounded-2xl shadow-lg transition-all duration-300 flex items-center gap-2 group/btn z-10 disabled:opacity-50"
                                title="ปรับปรุงคำด้วย AI"
                              >
                                <span className={`text-[10px] font-black uppercase tracking-widest overflow-hidden transition-all duration-500 whitespace-nowrap ${isImprovingPrompt ? 'max-w-[200px]' : 'max-w-0 group-hover/btn:max-w-[200px]'}`}>
                                  {isImprovingPrompt ? 'กำลังปรับปรุง...' : 'ปรับปรุงคำ/Prompt'}
                                </span>
                                <span className={`${isImprovingPrompt ? 'animate-pulse' : 'group-hover/btn:rotate-12 transition-transform'}`}>✨</span>
                              </button>
                            )}
                          </div>
                       </div>

                       {error && (
                         <div className="mt-4 flex items-center gap-3 bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 animate-in zoom-in duration-300">
                           <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                           <p className="text-sm font-black">{error}</p>
                         </div>
                       )}

                       <div className="flex flex-col sm:flex-row gap-4 mt-8">
                        <button
                          onClick={() => setViewMode('board')}
                          className="px-8 py-4 rounded-2xl font-black text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all active:scale-95 text-sm uppercase tracking-widest"
                        >
                          กลับไปที่บอร์ด
                        </button>
                        <button
                          onClick={() => runAnalysis()}
                          disabled={loading || (!prompt && images.length === 0 && !purpose)}
                          className={`flex-1 py-5 rounded-[1.5rem] font-black text-xl text-white transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-4 shadow-2xl ${loading ? 'bg-indigo-300 cursor-not-allowed opacity-70' : 'bg-indigo-700 hover:bg-indigo-800 shadow-indigo-200 hover:-translate-y-1'}`}
                        >
                          {loading ? (
                            <div className="flex items-center gap-3">
                               <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                               <span className="text-base uppercase tracking-[0.2em]">กำลังวิเคราะห์ข้อมูล...</span>
                            </div>
                          ) : (
                            <>
                              <span className="text-2xl animate-bounce">🤖</span> 
                              <span>เริ่มวิเคราะห์และแตก Task</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 pt-10">
                   <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2">📋</div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Smart Summary</span>
                   </div>
                   <div className="w-12 h-px bg-gray-100"></div>
                   <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-2">⚡</div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto Breakdowns</span>
                   </div>
                   <div className="w-12 h-px bg-gray-100"></div>
                   <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-2">✨</div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acceptance Criteria</span>
                   </div>
                </div>
              </div>
            ) : (
              <AnalysisDisplay 
                analysis={analysis} 
                config={config} 
                images={images}
                purpose={purpose}
                onQuestionAnswered={handleQuestionAnswered}
                onReset={handleReset}
                onTaskCreated={handleTaskCreated}
              />
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-100 border-t py-2 px-6">
        <div className="max-w-[1600px] mx-auto flex flex-wrap justify-center gap-6 text-[9px] font-black text-gray-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5"><span className="bg-white border rounded px-1.5 py-0.5 text-gray-600 shadow-sm">Alt + B</span> Board View</div>
          <div className="flex items-center gap-1.5"><span className="bg-white border rounded px-1.5 py-0.5 text-gray-600 shadow-sm">Alt + N</span> AI Analysis</div>
          <div className="flex items-center gap-1.5"><span className="bg-white border rounded px-1.5 py-0.5 text-gray-600 shadow-sm">/</span> or <span className="bg-white border rounded px-1.5 py-0.5 text-gray-600 shadow-sm">Ctrl + K</span> Search</div>
          <div className="flex items-center gap-1.5"><span className="bg-white border rounded px-1.5 py-0.5 text-gray-600 shadow-sm">Esc</span> Close Modal</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
