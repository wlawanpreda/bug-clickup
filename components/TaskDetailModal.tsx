
import React, { useState, useEffect, useRef, JSX, useCallback } from 'react';
import { clickUpService } from '../services/clickUpService';
import { geminiService } from '../services/geminiService';
import { ClickUpConfig, ClickUpTask, ClickUpComment, ClickUpReaction } from '../types';

interface Props {
  taskId: string;
  config: ClickUpConfig;
  onClose: () => void;
}

type CommentFilter = 'all' | 'waiting-assign' | 'dev-fixing' | 'waiting-test' | 'tested';

// ใช้ Emoji Character โดยตรงเพื่อให้ API ของ ClickUp ทำงานได้เสถียรที่สุด
const EMOJI_OPTIONS = [
  { name: 'check', icon: '✅' },
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
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editSubtaskName, setEditSubtaskName] = useState('');
  const [editSubtaskDesc, setEditSubtaskDesc] = useState('');
  const [editSubtaskAssignees, setEditSubtaskAssignees] = useState<number[]>([]);
  const [isSavingSubtask, setIsSavingSubtask] = useState(false);
  const [subtaskSortBy, setSubtaskSortBy] = useState<'date' | 'name' | 'status'>('date');
  const [listMembers, setListMembers] = useState<any[]>([]);
  
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
      
      // Fetch list members if we have list ID
      if (t.list?.id) {
        const members = await clickUpService.getListMembers(config.apiToken, t.list.id);
        setListMembers(members);
      }
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

  const handleAddReaction = async (commentId: string, emoji: string) => {
    try {
      await clickUpService.addReaction(config.apiToken, commentId, emoji);
      await fetchDetails(false);
    } catch (err) {
      console.error('Reaction Error:', err);
      // ถ้า Error เพราะมี Reaction อยู่แล้ว (400) ไม่ต้องแจ้งเตือนผู้ใช้ให้ตกใจ
      if (err instanceof Error && !err.message.includes('already exists')) {
        alert('ไม่สามารถกด Reaction ได้: ' + err.message);
      } else if (!(err instanceof Error)) {
         alert('ไม่สามารถกด Reaction ได้');
      }
    }
  };

  const handleSummarize = async () => {
    if (comments.length === 0) return;
    setIsSummarizing(true);
    try {
      const summary = await geminiService.summarizeComments(comments);
      setSummaryText(summary);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถสรุปข้อมูลได้');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleStartEditSubtask = (s: ClickUpTask) => {
    setEditingSubtaskId(s.id);
    setEditSubtaskName(s.name);
    setEditSubtaskDesc(s.description || s.markdown_description || '');
    setEditSubtaskAssignees(s.assignees?.map(u => u.id) || []);
  };

  const handleSaveSubtask = async () => {
    if (!editingSubtaskId) return;
    setIsSavingSubtask(true);
    try {
      await clickUpService.updateTask(config.apiToken, editingSubtaskId, {
        name: editSubtaskName,
        description: editSubtaskDesc,
        assignees: editSubtaskAssignees
      });
      setEditingSubtaskId(null);
      await fetchDetails(false);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถบันทึกการเปลี่ยนแปลงได้');
    } finally {
      setIsSavingSubtask(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบ Subtask นี้?')) return;
    try {
      await clickUpService.deleteTask(config.apiToken, subtaskId);
      await fetchDetails(false);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถลบ Subtask ได้');
    }
  };

  const toggleSubtaskAssignee = (userId: number) => {
    setEditSubtaskAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
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
      // วิเคราะห์หาลำดับคอมเมนต์ที่เป็นประวัติบัค/ปัญหา เพื่อส่งให้ AI วิเคราะห์บริบท
      const bugRelatedHistory = comments
        .filter(c => {
          const text = c.comment_text.toLowerCase();
          const reactions = (c.reactions || []).map(r => r.reaction.toLowerCase());
          return (
            text.includes('🚨') || 
            text.includes('บัค') || 
            text.includes('bug') || 
            text.includes('error') || 
            text.includes('ปัญหา') || 
            text.includes('fail') ||
            reactions.some(r => r === '❌' || r === 'bug' || r.includes('alert') || r === 'caution')
          );
        })
        .slice(0, 10); // เอาเฉพาะ 10 คอมเมนต์ล่าสุดที่เกี่ยวข้อง

      const analysis = await geminiService.generateBugReport(
        bugDescription, 
        bugImages[0] || undefined, 
        bugRelatedHistory
      );
      
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

  const checkWaitingAssign = (c: ClickUpComment) => !c.assignee;
  const checkDevFixing = (c: ClickUpComment) => !!c.assignee && !checkResolved(c);
  const checkWaitingTest = (c: ClickUpComment) => !!c.assignee && checkResolved(c) && !checkTested(c);

  const isTested = comments.some(checkTested);
  const isResolved = comments.some(checkResolved);
  const isRejected = comments.some(checkDevFixing);
  const waitingAssignCount = comments.filter(checkWaitingAssign).length;
  const devFixingCount = comments.filter(checkDevFixing).length;
  const waitingTestCount = comments.filter(checkWaitingTest).length;
  const testedCount = comments.filter(checkTested).length;
  const totalComments = comments.length;
  const progressPercent = totalComments > 0 ? (testedCount / totalComments) * 100 : 0;

  const filteredComments = comments.filter(c => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'waiting-assign') return checkWaitingAssign(c);
    if (activeFilter === 'dev-fixing') return checkDevFixing(c);
    if (activeFilter === 'waiting-test') return checkWaitingTest(c);
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
            <h2 className="text-2xl font-black text-gray-900 leading-tight mb-2">{task.name}</h2>
            
            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assignees:</span>
                <div className="flex -space-x-2">
                  {task.assignees.map((u) => (
                    <div 
                      key={u.id} 
                      className="w-7 h-7 rounded-full border-2 border-white bg-indigo-600 flex items-center justify-center text-[9px] font-black text-white shadow-sm ring-1 ring-gray-100"
                      style={{ backgroundColor: u.color }}
                      title={u.username}
                    >
                      {u.initials}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 ml-1">
                   {task.assignees.map(u => (
                      <span key={u.id} className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{u.username}</span>
                   ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open(task?.url, '_blank')}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black text-gray-500 hover:text-indigo-600 hover:border-indigo-600 transition flex items-center gap-2"
            >
              <img src="https://clickup.com/favicon.ico" className="w-3 h-3" alt="ClickUp" />
              Open in ClickUp
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            {/* Status Stepper */}
            <div className="flex items-center justify-between gap-2 bg-gray-50/50 p-4 rounded-3xl border border-gray-100 mb-6 flex-wrap sm:flex-nowrap">
                {[
                    { label: 'Backlog', icon: '📥', active: true },
                    { label: 'Development', icon: '💻', active: isResolved || isRejected || testedCount > 0 },
                    { label: 'Testing', icon: '🧪', active: isResolved || testedCount > 0 },
                    { label: 'Done', icon: '🎉', active: progressPercent === 100 && totalComments > 0 }
                ].map((step, i, arr) => (
                    <React.Fragment key={step.label}>
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-[60px]">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm transition-all duration-500 ${step.active ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-gray-300 border border-gray-100'}`}>
                                {step.icon}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-tighter ${step.active ? 'text-indigo-600' : 'text-gray-300'}`}>{step.label}</span>
                        </div>
                        {i < arr.length - 1 && (
                            <div className={`hidden sm:block h-0.5 flex-1 mx-2 rounded-full transition-all duration-1000 ${step.active && arr[i+1].active ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Description */}
            <section>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Description รายละเอียด</h3>
              <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 min-h-[100px] text-sm text-gray-700 font-medium whitespace-pre-wrap">
                {task.description || task.markdown_description || "ไม่มีรายละเอียดเพิ่มเติม"}
              </div>
            </section>

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Subtasks งานย่อย ({task.subtasks.length})</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400">Sort by:</span>
                    <select 
                      value={subtaskSortBy} 
                      onChange={(e) => setSubtaskSortBy(e.target.value as any)}
                      className="text-[10px] font-black bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-indigo-600"
                    >
                      <option value="date">วันที่สร้าง</option>
                      <option value="name">ชื่อ</option>
                      <option value="status">สถานะ</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  {[...task.subtasks].sort((a, b) => {
                    if (subtaskSortBy === 'name') return a.name.localeCompare(b.name);
                    if (subtaskSortBy === 'status') return a.status.status.localeCompare(b.status.status);
                    return parseInt(b.date_created || '0') - parseInt(a.date_created || '0');
                  }).map(s => (
                    <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition group">
                      {editingSubtaskId === s.id ? (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <input 
                              type="text" 
                              value={editSubtaskName} 
                              onChange={(e) => setEditSubtaskName(e.target.value)} 
                              className="w-full text-sm font-black text-gray-900 border-b-2 border-indigo-600 focus:outline-none bg-indigo-50/30 p-1"
                              placeholder="ชื่อ Subtask..."
                            />
                            <textarea 
                              value={editSubtaskDesc} 
                              onChange={(e) => setEditSubtaskDesc(e.target.value)} 
                              className="w-full text-xs font-medium text-gray-600 focus:outline-none bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[80px]"
                              placeholder="รายละเอียด (Markdown)..."
                            />
                          </div>
                          
                          <div className="space-y-2">
                             <span className="text-[10px] font-black text-gray-400 uppercase">มอบหมายงานให้:</span>
                             <div className="flex flex-wrap gap-2">
                                {listMembers.map(m => {
                                  const isSelected = editSubtaskAssignees.includes(m.id || m.user?.id);
                                  const userId = m.id || m.user?.id;
                                  const userData = m.user || m;
                                  return (
                                    <button 
                                      key={userId} 
                                      onClick={() => toggleSubtaskAssignee(userId)}
                                      className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-300'}`}
                                    >
                                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-black text-white`} style={{ backgroundColor: isSelected ? 'transparent' : userData.color }}>{userData.initials}</div>
                                      <span className="text-[9px] font-bold">{userData.username}</span>
                                    </button>
                                  );
                                })}
                             </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button 
                              onClick={() => setEditingSubtaskId(null)} 
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black text-gray-400 hover:bg-gray-100"
                            >
                              ยกเลิก
                            </button>
                            <button 
                              onClick={handleSaveSubtask} 
                              disabled={isSavingSubtask}
                              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black shadow-lg disabled:opacity-50"
                            >
                              {isSavingSubtask ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase text-white" style={{ backgroundColor: s.status.color }}>{s.status.status}</span>
                               <h4 className="text-sm font-black text-gray-900">{s.name}</h4>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button 
                                onClick={() => handleStartEditSubtask(s)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition"
                                title="แก้ไข"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                              </button>
                              <button 
                                onClick={() => handleDeleteSubtask(s.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition"
                                title="ลบ"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="text-[11px] font-medium text-gray-500 whitespace-pre-wrap ml-1 underline-offset-4 decoration-gray-200 decoration-dotted">
                            {s.description || s.markdown_description || <span className="italic text-gray-300">ไม่มีรายละเอียด</span>}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex -space-x-1 overflow-hidden">
                                {s.assignees && s.assignees.length > 0 ? s.assignees.map(u => (
                                    <div key={u.id} className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-white" style={{ backgroundColor: u.color }} title={u.username}>{u.initials}</div>
                                )) : (
                                    <span className="text-[8px] font-bold text-gray-300 uppercase italic">Unassigned</span>
                                )}
                            </div>
                            <span className="text-[8px] text-gray-300 font-bold uppercase">Created {s.date_created ? new Date(parseInt(s.date_created)).toLocaleDateString() : 'Unknown'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Comments Area */}
            <section>
              <div className="flex flex-col mb-8 gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-3 flex-1">
                    <div className="flex items-center justify-between pr-4">
                      <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                        <span>💬</span> Comments ({comments.length})
                      </h3>
                      {comments.length >= 2 && (
                        <button 
                          onClick={handleSummarize} 
                          disabled={isSummarizing || loading}
                          className="text-[10px] font-black bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1.5 rounded-full hover:shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isSummarizing ? "⏳ กำลังสรุป..." : "✨ AI สรุปบทสนทนา"}
                        </button>
                      )}
                    </div>
                    {summaryText && (
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[2rem] border border-indigo-100 relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl font-black uppercase pointer-events-none">AI SUMMARY</div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">✨</div>
                          <h4 className="text-xs font-black text-indigo-900 uppercase">AI สรุปใจความสำคัญจากคอมเมนต์</h4>
                          <button onClick={() => setSummaryText('')} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="text-xs text-indigo-950 font-bold leading-relaxed whitespace-pre-wrap">
                          {summaryText}
                        </div>
                      </div>
                    )}
                    <div className="bg-gray-100 p-1 rounded-2xl flex flex-wrap gap-1 border border-gray-200 w-fit">
                      {[
                        { id: 'all', label: 'ทั้งหมด', icon: '📁' },
                        { id: 'waiting-assign', label: 'รอ assign', icon: '⌛', count: waitingAssignCount },
                        { id: 'dev-fixing', label: 'Dev กำลังแก้', icon: '🚨', count: devFixingCount },
                        { id: 'waiting-test', label: 'รอทดสอบ', icon: '🚀', count: waitingTestCount },
                        { id: 'tested', label: 'ทดสอบแล้ว', icon: '✅', count: testedCount },
                      ].map(tab => (
                        <button 
                          key={tab.id} 
                          onClick={() => setActiveFilter(tab.id as CommentFilter)} 
                          className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeFilter === tab.id ? 'bg-white text-indigo-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-white/50'}`}
                        >
                          <span className={activeFilter === tab.id ? '' : 'grayscale'}>{tab.icon}</span>
                          <span className={activeFilter === tab.id ? '' : 'opacity-70'}>{tab.label}</span>
                          {tab.count !== undefined && tab.count > 0 && (
                            <span className={`px-1.5 rounded-full text-[8px] border ${activeFilter === tab.id ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-200 border-gray-300'}`}>{tab.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 self-start">
                    <button onClick={() => setReportMode(!reportMode)} className={`text-xs font-black px-4 py-2 rounded-xl transition flex items-center justify-center gap-2 min-w-[140px] ${reportMode ? 'bg-red-50 text-red-600 border border-red-200 font-bold' : 'bg-red-600 text-white shadow-lg hover:bg-red-700'}`}>
                      {reportMode ? '❌ ยกเลิกรายงาน' : '🚨 แจ้งบัค (Reject)'}
                    </button>
                    <button onClick={handleExportCSV} className="text-[10px] font-black px-4 py-2 rounded-xl transition border border-gray-200 bg-white text-gray-400 hover:text-indigo-600 hover:border-indigo-600 flex items-center justify-center gap-2 shadow-sm">
                       📥 Export CSV
                    </button>
                  </div>
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
                {filteredComments.length === 0 ? (
                    <div className="bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                        <div className="text-4xl mb-4 grayscale opacity-40">💬</div>
                        <p className="font-black text-gray-400 text-sm mb-1">ยังไม่มีคอมเมนต์ในหมวดหมู่นี้</p>
                        <p className="text-xs text-gray-300 font-bold">พิมพ์โต้ตอบด้านล่างเพื่อเริ่มการสนทนา</p>
                    </div>
                ) : filteredComments.map(c => {
                  const isDevTask = checkDevFixing(c);
                  const isTesterTask = checkWaitingTest(c);
                  const isWaitingAssign = checkWaitingAssign(c);
                  const reactionGroups = (c.reactions || []).reduce((acc: Record<string, { count: number, users: { id: number, username: string }[] }>, curr) => {
                     if (!acc[curr.reaction]) {
                        acc[curr.reaction] = { count: 0, users: [] };
                     }
                     acc[curr.reaction].count += 1;
                     // หลีกเลี่ยงผู้ใช้ซ้ำในรายการสำหรับปุ่มเดียวถ้ากดย้ำ (ถึงแม้ ClickUp จะไม่น่าให้ทำ)
                     if (!acc[curr.reaction].users.find(u => u.id === curr.user.id)) {
                        acc[curr.reaction].users.push(curr.user);
                     }
                     return acc;
                  }, {});

                  return (
                    <div key={c.id} className={`p-4 rounded-2xl border transition group ${isDevTask ? 'border-rose-400 bg-rose-50/20' : isTesterTask ? 'border-amber-400 bg-amber-50/20' : isWaitingAssign ? 'border-gray-300 bg-gray-50/10' : 'bg-white border-gray-100 shadow-sm'}`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black overflow-hidden bg-gray-100 shadow-sm border border-white" style={{ backgroundColor: c.user.color }}>
                          {c.user.initials}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-xs font-black text-gray-900">{c.user.username} <span className="text-[10px] font-bold text-gray-400 ml-1">#เจ้าของคอมเมนต์</span></span>
                            {c.assignee && (
                              <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[8px] font-black border border-indigo-100 animate-in fade-in zoom-in-95">
                                <span>🎯 มอบหมายให้: {c.assignee.username}</span>
                              </div>
                            )}
                            {!c.assignee && (
                              <span className="text-[8px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-black uppercase border border-dashed border-gray-300 italic">⚠️ ยังไม่มีการมอบหมาย</span>
                            )}
                            {c.resolved && <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Resolved</span>}
                            {isDevTask && <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Developing</span>}
                          </div>
                          <span className="text-[9px] text-gray-400 font-bold">{new Date(parseInt(c.date)).toLocaleString()}</span>
                        </div>
                        {/* Reaction Picker on Hover */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition p-1 bg-gray-50 rounded-lg border shadow-sm">
                           {EMOJI_OPTIONS.map(opt => (
                             <button 
                               key={opt.name} 
                               onClick={() => handleAddReaction(c.id, opt.icon)} 
                               className="text-sm p-1 hover:bg-white hover:scale-125 transition rounded-md shadow-sm active:scale-95" 
                               title={opt.name}
                             >
                               {opt.icon}
                             </button>
                           ))}
                        </div>
                      </div>
                      <div className="pl-11 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {renderFormattedContent(c.comment_text)}
                      </div>
                      {Object.keys(reactionGroups).length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-11 mt-3">
                          {(Object.entries(reactionGroups) as [string, { count: number, users: { id: number, username: string }[] }][]).map(([reaction, data]) => (
                            <button 
                              key={reaction} 
                              onClick={() => handleAddReaction(c.id, reaction)} 
                              className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full hover:bg-white hover:border-indigo-400 transition-all shadow-sm group/react"
                              title={data.users.map(u => u.username).join(', ')}
                            >
                              <span className="text-xs group-hover/react:scale-110 transition">{getEmojiIcon(reaction)}</span>
                              
                              <div className="flex -space-x-2 overflow-hidden mr-1">
                                {data.users.slice(0, 3).map((u) => (
                                  <div 
                                    key={u.id} 
                                    className="w-4 h-4 rounded-full border border-white bg-indigo-600 flex items-center justify-center text-[6px] font-black text-white shadow-sm"
                                    title={u.username}
                                  >
                                    {u.username.substring(0, 1).toUpperCase()}
                                  </div>
                                ))}
                                {data.users.length > 3 && (
                                  <div className="w-4 h-4 rounded-full border border-white bg-gray-400 flex items-center justify-center text-[5px] font-black text-white">
                                    +{data.users.length - 3}
                                  </div>
                                )}
                              </div>

                              <span className="text-[10px] font-black text-indigo-600">{data.count}</span>
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
          <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
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

            <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 space-y-5">
              <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">ความคืบหน้าการทดสอบ</h4>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isRejected ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}>
                  {isRejected ? 'ISSUES FOUND' : 'HEALTHY'}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-gray-500">Quality Indicator</span>
                    <span className={isRejected ? 'text-red-600' : 'text-emerald-600'}>
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full ${isRejected ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase">
                  <div className="bg-white/50 p-2 rounded-lg border border-indigo-100">
                    <p className="text-gray-400 mb-1">Testing Stats</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total</span>
                        <span className="text-gray-900">{totalComments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Passed</span>
                        <span className="text-emerald-600">{testedCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isRejected ? 'bg-red-100/50 border-red-200' : 'bg-white/50 border-indigo-100'}`}>
                    <p className="text-gray-400 mb-1">Risk Level</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span className={isRejected ? 'text-red-700' : 'text-gray-500'}>Fixing</span>
                        <span className={isRejected ? 'text-red-700' : 'text-gray-900'}>{devFixingCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-600 font-black">Waiting Test</span>
                        <span className="text-amber-600">{waitingTestCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-indigo-100 pt-3">
                   <div className="flex justify-between items-center text-[10px] font-bold">
                     <span className="text-gray-500">Tested</span>
                     <span className={isTested ? "text-emerald-600" : "text-gray-400"}>{isTested ? "YES ✅" : "NO"}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-bold">
                     <span className="text-gray-500">Resolved</span>
                     <span className={isResolved ? "text-indigo-600" : "text-gray-400"}>{isResolved ? "YES 🚀" : "NO"}</span>
                   </div>
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
