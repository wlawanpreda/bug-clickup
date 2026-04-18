
import React, { useState, useEffect, useRef, JSX, useCallback } from 'react';
import { clickUpService } from '../services/clickUpService';
import { geminiService } from '../services/geminiService';
import { ClickUpConfig, ClickUpTask, ClickUpComment, ClickUpReaction } from '../types';

interface Props {
  taskId: string;
  config: ClickUpConfig;
  onClose: () => void;
}

type CommentFilter = 'all' | 'dev-todo' | 'tester-todo' | 'bug' | 'assigned' | 'resolved' | 'tested';

// ใช้ Shortcode ของ Emoji เพื่อให้ API ของ ClickUp ยอมรับ (เลิกใช้ Unicode Character ตรงๆ ในฟิลด์ name)
const EMOJI_OPTIONS = [
  { name: 'white_check_mark', icon: '✅' },
  { name: 'rocket', icon: '🚀' },
  { name: 'eyes', icon: '👀' },
  { name: 'heart', icon: '❤️' },
  { name: 'x', icon: '❌' },
  { name: 'fire', icon: '🔥' },
  { name: 'thumbsup', icon: '👍' }
];

const TaskDetailModal: React.FC<Props> = ({ taskId, config, onClose }) => {
  const [task, setTask] = useState<ClickUpTask | null>(null);
  const [comments, setComments] = useState<ClickUpComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportMode, setReportMode] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugImages, setBugImages] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CommentFilter>('all');
  const [copied, setCopied] = useState(false);
  const [quickComment, setQuickComment] = useState('');
  const [sendingQuickComment, setSendingQuickComment] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDetails = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [t, c] = await Promise.all([
        clickUpService.getTaskDetails(config.apiToken, taskId),
        clickUpService.getTaskComments(config.apiToken, taskId)
      ]);
      setTask(t);
      setComments(c);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [config.apiToken, taskId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const fileList = Array.from(files);
    
    fileList.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setBugImages(prev => [...prev, reader.result as string]);
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

  const removeBugImage = (index: number) => {
    setBugImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickComment = async () => {
    if (!quickComment.trim()) return;
    setSendingQuickComment(true);
    try {
      await clickUpService.addTaskComment(config.apiToken, taskId, quickComment);
      setQuickComment('');
      await fetchDetails(false);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถส่งฟีดแบ็คได้ กรุณาลองใหม่');
    } finally {
      setSendingQuickComment(false);
    }
  };

  const handleAddReaction = async (commentId: string, reactionName: string) => {
    try {
      await clickUpService.addReaction(config.apiToken, commentId, reactionName);
      await fetchDetails(false);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถกด Reaction ได้: ' + (err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleExportCSV = () => {
    if (comments.length === 0) return;

    const sanitize = (text: string) => {
      if (!text) return '';
      const stringified = String(text).replace(/"/g, '""');
      return `"${stringified}"`;
    };

    const headers = ['Comment ID', 'Date', 'User', 'Text', 'Resolved', 'Assignee', 'Reactions'];
    const rows = comments.map(c => [
      c.id,
      new Date(parseInt(c.date)).toLocaleString(),
      c.user.username,
      c.comment_text,
      c.resolved ? 'Yes' : 'No',
      c.assignee?.username || 'None',
      (c.reactions || []).map(r => r.reaction).join('|')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(sanitize).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `comments-task-${taskId}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submitBugReport = async () => {
    if (!bugDescription && bugImages.length === 0) return;
    setReporting(true);
    try {
      const analysis = await geminiService.generateBugReport(bugDescription, bugImages[0] || undefined);
      
      const attachmentUrls: string[] = [];
      if (bugImages.length > 0) {
        const uploadPromises = bugImages.map(img => 
          clickUpService.uploadAttachment(config.apiToken, taskId, img)
        );
        const results = await Promise.all(uploadPromises);
        results.forEach(res => {
          if (res.url) attachmentUrls.push(res.url);
        });
      }
      
      const imageLinksSection = attachmentUrls.length > 0 
        ? `🖼️ **Evidence Links:**\n${attachmentUrls.map((url, i) => `${i+1}. ${url}`).join('\n')}\n\n` 
        : '';
        
      const commentText = `${imageLinksSection}${analysis.markdown}\n\n🚨 *แจ้งบัคโดย AI Sidekick*`;
      
      await clickUpService.addTaskComment(config.apiToken, taskId, commentText);
      
      setBugDescription('');
      setBugImages([]);
      setReportMode(false);
      fetchDetails();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งรายงานบัค กรุณาลองใหม่อีกครั้ง');
    } finally {
      setReporting(false);
    }
  };

  // Helper เพื่อหาไอคอนที่ใช้แสดงผลจากชื่อ Reaction
  const getEmojiIcon = (reactionName: string) => {
    const found = EMOJI_OPTIONS.find(opt => opt.name === reactionName.toLowerCase());
    if (found) return found.icon;
    const name = reactionName.toLowerCase();
    if (name === 'checkmark' || name === 'check_mark' || name === 'white_check_mark' || name === 'check' || name === '✅') return '✅';
    if (name === 'rocket' || name === '🚀') return '🚀';
    if (name === 'eyes' || name === '👀') return '👀';
    if (name === 'heart' || name === '❤️') return '❤️';
    if (name === 'x' || name === '❌') return '❌';
    if (name === 'fire' || name === '🔥') return '🔥';
    if (name === 'thumbsup' || name === 'plusone' || name === '👍') return '👍';
    return reactionName;
  }

  const isSuccessReaction = (r: ClickUpReaction) => {
    const name = r.reaction.toLowerCase();
    return (
      name === '✅' || 
      name.includes('check') || 
      name === 'success' || 
      name === 'thumbsup' ||
      name === '👍'
    );
  };

  const isIssueReaction = (r: ClickUpReaction) => {
    const name = r.reaction.toLowerCase();
    return name === '❌' || name === 'x' || name === 'alert' || name === 'bug' || name.includes('bug');
  };

  const checkResolved = (c: ClickUpComment) => {
    const nameStr = c.comment_text;
    const reactions = c.reactions || [];
    return (
      c.resolved === true || 
      nameStr.includes('🚀') || 
      reactions.some(r => r.reaction.toLowerCase() === 'rocket' || r.reaction.toLowerCase() === '🚀')
    );
  }

  const checkTested = (c: ClickUpComment) => {
    return (c.reactions || []).some(isSuccessReaction);
  }

  const checkDevTodo = (c: ClickUpComment) => {
    const nameStr = c.comment_text;
    const reactions = c.reactions || [];
    const isIssue = nameStr.includes('🚨') || nameStr.includes('❌') || reactions.some(isIssueReaction);
    const isFixed = c.resolved === true || reactions.some(isSuccessReaction);
    return isIssue && !isFixed;
  };

  const checkTesterTodo = (c: ClickUpComment) => {
    const isDevResolved = checkResolved(c);
    const hasAnySuccessReaction = (c.reactions || []).some(isSuccessReaction);
    return isDevResolved && !hasAnySuccessReaction;
  };

  const isTested = comments.some(checkTested);
  const isResolved = comments.some(checkResolved);
  const isRejected = comments.some(checkDevTodo);
  const devTodoCount = comments.filter(checkDevTodo).length;
  const testerTodoCount = comments.filter(checkTesterTodo).length;

  const filteredComments = comments.filter(c => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'dev-todo') return checkDevTodo(c);
    if (activeFilter === 'tester-todo') return checkTesterTodo(c);
    if (activeFilter === 'bug') return c.comment_text.includes('🚨') || c.comment_text.includes('บัค');
    if (activeFilter === 'assigned') return !!c.assignee;
    if (activeFilter === 'resolved') return checkResolved(c);
    if (activeFilter === 'tested') return checkTested(c);
    return true;
  });

  const renderFormattedContent = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      const imgMatch = line.match(/!\[.*?\]\((.*?)\)/);
      const rawUrlMatch = line.match(/(https?:\/\/[\w\d.-]+\.clickup-attachments\.com\/[\w\d\/\.-]+(?:\?[\w\d=&%-]*)?)/i);
      const imageUrl = imgMatch ? imgMatch[1] : (rawUrlMatch ? rawUrlMatch[0] : null);

      if (imageUrl) {
        elements.push(
          <div key={`img-${index}`} className="my-4 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg max-w-full inline-block group relative">
            <img src={imageUrl} alt="Attachment" className="max-h-96 w-auto object-contain cursor-zoom-in" onClick={() => window.open(imageUrl, '_blank')} />
          </div>
        );
        if (rawUrlMatch && line.trim() === rawUrlMatch[0]) return;
      }

      if (line.startsWith('###')) {
        elements.push(<h3 key={`h3-${index}`} className="text-sm font-black text-indigo-900 mt-4 mb-2 uppercase">{line.replace('###', '').trim()}</h3>);
        return;
      }

      if (line.trim()) {
        elements.push(<p key={`p-${index}`} className="text-sm font-medium text-gray-700 leading-relaxed mb-1">{line}</p>);
      } else {
        elements.push(<div key={`br-${index}`} className="h-2"></div>);
      }
    });

    return elements;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-gray-500">กำลังโหลดรายละเอียดงาน...</p>
        </div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-start bg-gray-50 sticky top-0 z-10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
               <span className="text-[10px] font-black text-gray-400 bg-white px-2 py-0.5 border rounded uppercase">Task #{task.id}</span>
               <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase text-white shadow-sm" style={{ backgroundColor: task.status.color }}>{task.status.status}</span>
               {isTested && <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase flex items-center gap-1">✅ Tested</span>}
               {isResolved && <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase flex items-center gap-1">🚀 Resolved</span>}
               {isRejected && <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase flex items-center gap-1">🚨 Issue Detected</span>}
            </div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">{task.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            {/* Description */}
            <section>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Description รายละเอียด</h3>
              <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 min-h-[100px] text-sm text-gray-700 font-medium whitespace-pre-wrap">
                {task.description || task.markdown_description || "ไม่มีรายละเอียดเพิ่มเติม"}
              </div>
            </section>

            {/* Comments Area */}
            <section>
              <div className="flex flex-col mb-6 gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <span>💬</span> Comments ({comments.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setActiveFilter('all')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border-2 ${activeFilter === 'all' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-500'}`}>ทั้งหมด</button>
                      <button onClick={() => setActiveFilter('dev-todo')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border-2 flex items-center gap-1.5 ${activeFilter === 'dev-todo' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50'}`}>
                        <span>🚨 Dev: ต้องแก้ไข</span>
                        {devTodoCount > 0 && <span className="bg-rose-200 text-rose-800 px-1.5 rounded-full">{devTodoCount}</span>}
                      </button>
                      <button onClick={() => setActiveFilter('tester-todo')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border-2 flex items-center gap-1.5 ${activeFilter === 'tester-todo' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50'}`}>
                        <span>🚀 Tester: ต้องตรวจ</span>
                        {testerTodoCount > 0 && <span className="bg-amber-200 text-amber-800 px-1.5 rounded-full">{testerTodoCount}</span>}
                      </button>
                      <button onClick={handleExportCSV} className="text-[10px] font-black px-3 py-1.5 rounded-lg transition border-2 bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-500 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        CSV
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setReportMode(!reportMode)} className={`text-xs font-black px-4 py-2 rounded-xl transition flex items-center gap-2 h-fit ${reportMode ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}>
                    {reportMode ? '❌ ยกเลิก' : '🚨 แจ้งบัค (Reject)'}
                  </button>
                </div>
              </div>

              {reportMode && (
                <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`mb-8 p-6 rounded-2xl border-2 transition-all ${isDragging ? 'bg-red-100 border-red-500' : 'bg-red-50 border-red-100'}`}>
                  <h4 className="font-black text-red-700 text-sm mb-4 uppercase">👾 AI Bug Reporter</h4>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 mb-4">
                      {bugImages.map((img, idx) => (
                        <div key={idx} className="w-20 h-20 rounded-xl border-2 border-red-200 relative overflow-hidden group">
                          <img src={img} className="w-full h-full object-cover" />
                          <button onClick={() => removeBugImage(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition">×</button>
                        </div>
                      ))}
                      <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-red-300 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-red-50 transition">
                         <span className="text-[20px]">＋</span>
                         <span className="text-[9px] font-bold text-red-400">รูป</span>
                      </div>
                    </div>
                    <textarea value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} placeholder="เล่าอาการบัคสั้นๆ..." className="w-full bg-white border-2 border-red-100 rounded-xl p-4 text-sm font-bold focus:border-red-400 outline-none min-h-[100px]" />
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                    <button onClick={submitBugReport} disabled={reporting || (!bugDescription && bugImages.length === 0)} className="w-full bg-red-600 text-white py-3 rounded-xl font-black shadow-lg disabled:opacity-50">
                      {reporting ? 'กำลังวิเคราะห์และส่ง...' : '🚀 ส่งรายงานบัค'}
                    </button>
                  </div>
                </div>
              )}

              {/* Comment List */}
              <div className="space-y-4">
                {filteredComments.map(c => {
                  const isDevTask = checkDevTodo(c);
                  const isTesterTask = checkTesterTodo(c);
                  const reactionGroups = (c.reactions || []).reduce((acc: any, curr) => {
                     acc[curr.reaction] = (acc[curr.reaction] || 0) + 1;
                     return acc;
                  }, {});

                  return (
                    <div key={c.id} className={`p-4 rounded-2xl border transition group ${isDevTask ? 'border-rose-400 bg-rose-50/20' : isTesterTask ? 'border-amber-400 bg-amber-50/20' : 'bg-white border-gray-100 shadow-sm'}`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black" style={{ backgroundColor: c.user.color }}>{c.user.initials}</div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black">{c.user.username}</span>
                            {c.resolved && <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Resolved</span>}
                            {isDevTask && <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Action Req.</span>}
                          </div>
                          <span className="text-[9px] text-gray-400 font-bold">{new Date(parseInt(c.date)).toLocaleString()}</span>
                        </div>
                        {/* Reaction Picker on Hover */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition p-1 bg-gray-50 rounded-lg border">
                           {EMOJI_OPTIONS.map(opt => (
                             <button key={opt.name} onClick={() => handleAddReaction(c.id, opt.name)} className="text-sm hover:scale-125 transition" title={opt.name}>{opt.icon}</button>
                           ))}
                        </div>
                      </div>
                      <div className="pl-11 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {renderFormattedContent(c.comment_text)}
                      </div>
                      {Object.keys(reactionGroups).length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-11 mt-3">
                          {Object.entries(reactionGroups).map(([reaction, count]) => (
                            <button key={reaction} onClick={() => handleAddReaction(c.id, reaction)} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg hover:bg-indigo-100 transition">
                              <span className="text-xs">{getEmojiIcon(reaction)}</span>
                              <span className="text-[10px] font-black text-indigo-600">{(count as number)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 space-y-6 flex-shrink-0">
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">ผู้รับผิดชอบ</h4>
              <div className="space-y-2">
                {task.assignees?.map(u => (
                  <div key={u.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-[8px] font-black text-white" style={{ backgroundColor: u.color }}>{u.initials}</div>
                    <span className="text-xs font-black">{u.username}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2">สถานะ AI</h4>
              <div className="space-y-3">
                 <div className="flex justify-between items-center text-[11px] font-bold">
                   <span className="text-gray-500">Tested</span>
                   <span className={isTested ? "text-emerald-600" : "text-gray-400"}>{isTested ? "YES ✅" : "NO"}</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-bold">
                   <span className="text-gray-500">Resolved</span>
                   <span className={isResolved ? "text-indigo-600" : "text-gray-400"}>{isResolved ? "YES 🚀" : "NO"}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Quick Input */}
        <div className="p-6 border-t bg-gray-50 sticky bottom-0 z-10">
          <div className="flex gap-3">
            <textarea value={quickComment} onChange={(e) => setQuickComment(e.target.value)} placeholder="พิมพ์โต้ตอบ..." className="flex-1 bg-white border-2 border-gray-200 rounded-2xl p-4 text-sm font-bold focus:border-indigo-600 outline-none h-20 transition" />
            <button onClick={handleQuickComment} disabled={sendingQuickComment || !quickComment.trim()} className="bg-indigo-700 text-white px-8 rounded-2xl font-black text-sm hover:bg-indigo-800 disabled:opacity-50 transition active:scale-95">
              {sendingQuickComment ? "..." : "ส่ง"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
