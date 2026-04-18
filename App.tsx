
import React, { useState, useEffect, useRef } from 'react';
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
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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

  const handleConfigSaved = async (newConfig: ClickUpConfig) => {
    setConfig(newConfig);
    if (user) {
      try {
        await saveUserSettings(user.uid, newConfig);
        setUserSettings(newConfig);
      } catch (err) {
        console.error("Error saving settings to Firestore", err);
      }
    }
  };

  const closeSettings = () => {
    setIsEditingConfig(false);
  };

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
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt && images.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.analyzeSystem(finalPrompt, images.length > 0 ? images : undefined);
      setAnalysis(result);
      setViewMode('analysis');
    } catch (err) {
      setError('การวิเคราะห์ล้มเหลว กรุณาลองใหม่อีกครั้ง');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionAnswered = (answer: string) => {
    const combinedPrompt = `ข้อความก่อนหน้า: ${prompt}\n\nข้อมูลเพิ่มเติมจาก PM: ${answer}`;
    runAnalysis(combinedPrompt);
  };

  const handleReset = () => {
    setAnalysis(null);
    setPrompt('');
    setImages([]);
    setViewMode('board');
  };

  const handleTaskCreated = () => {
    setBoardRefreshKey(prev => prev + 1);
    handleReset();
  };

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
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Project Board</h2>
                <p className="text-sm font-bold text-gray-500 mt-1">รายการงานทั้งหมดในบอร์ด ClickUp</p>
              </div>
              <button 
                onClick={() => setViewMode('analysis')}
                className="bg-indigo-700 hover:bg-indigo-800 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 flex items-center gap-2 transition transform active:scale-95"
              >
                <span>🤖</span> ใช้ AI ช่วยจัดการงาน
              </button>
            </div>
            
            <BoardView config={config} refreshTrigger={boardRefreshKey} />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full">
            {!analysis ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-4">
                  <h2 className="text-4xl font-black text-gray-900 leading-tight">
                    PM's Sidekick AI <br/> 
                    <span className="text-indigo-700">ผู้ช่วยวิเคราะห์และแตก Task งาน</span>
                  </h2>
                  <p className="text-gray-700 text-lg font-medium max-w-xl mx-auto">
                    สรุปบันทึกการประชุม, รายงานความคืบหน้า หรือร่างแผนงานจากข้อความและรูปภาพของคุณ
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-200 space-y-6 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-black text-gray-900 mb-2 uppercase tracking-wide">1. อัปโหลดข้อมูลภาพ</label>
                      <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center transition h-56 relative overflow-hidden ${
                          isDragging ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        {images.length === 0 ? (
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center cursor-pointer w-full h-full"
                          >
                            <svg className={`w-12 h-12 mb-2 transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <p className="text-xs font-bold text-gray-500">ลากวาง หรือคลิกเพื่ออัปโหลด Screenshot</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">รองรับหลายภาพพร้อมกัน</p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col">
                             <div className="flex-1 overflow-y-auto scrollbar-hide">
                                <div className="grid grid-cols-3 gap-2 p-1">
                                  {images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-indigo-200 bg-white group shadow-sm">
                                      <img src={img} className="w-full h-full object-cover" alt={`Preview ${idx}`} />
                                      <button 
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                      </button>
                                    </div>
                                  ))}
                                  <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square border-2 border-dashed border-indigo-300 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-100/50 transition bg-white"
                                  >
                                    <span className="text-xl text-indigo-400">＋</span>
                                  </div>
                                </div>
                             </div>
                             <button onClick={() => setImages([])} className="mt-2 text-[10px] font-black text-red-500 hover:text-red-700 uppercase self-end">ล้างรูปภาพทั้งหมด</button>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-gray-900 mb-2 uppercase tracking-wide">2. ระบุรายละเอียด/โจทย์</label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="เช่น 'สรุปงานจากแชทนี้' หรือ 'ร่าง Task จาก Diagram'..."
                        className="w-full h-56 bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-sm font-bold text-black focus:ring-4 focus:ring-indigo-100 focus:border-indigo-700 outline-none transition placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {error && <p className="text-red-700 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}

                  <div className="flex gap-4">
                    <button
                      onClick={() => setViewMode('board')}
                      className="px-6 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                      กลับไปที่บอร์ด
                    </button>
                    <button
                      onClick={() => runAnalysis()}
                      disabled={loading || (!prompt && images.length === 0)}
                      className={`flex-1 py-4 rounded-2xl font-black text-xl text-white transition transform active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-700 hover:bg-indigo-800 shadow-indigo-200'}`}
                    >
                      <span>🤖</span> วิเคราะห์ข้อมูลงาน
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <AnalysisDisplay 
                analysis={analysis} 
                config={config} 
                images={images}
                onQuestionAnswered={handleQuestionAnswered}
                onReset={handleReset}
                onTaskCreated={handleTaskCreated}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
