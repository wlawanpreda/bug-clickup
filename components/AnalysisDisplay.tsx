
import React, { useState, useEffect } from 'react';
import { SystemAnalysis, ClickUpConfig, ClickUpCustomField } from '../types';
import { clickUpService } from '../services/clickUpService';

interface Props {
  analysis: SystemAnalysis;
  config: ClickUpConfig;
  images: string[];
  onQuestionAnswered: (answer: string) => void;
  onReset: () => void;
  onTaskCreated: () => void;
}

const AnalysisDisplay: React.FC<Props> = ({ analysis, config, images, onQuestionAnswered, onReset, onTaskCreated }) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  
  const [customFields, setCustomFields] = useState<ClickUpCustomField[]>([]);
  const [selectedFieldValues, setSelectedFieldValues] = useState<Record<string, string[]>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);

  const [editableSystem, setEditableSystem] = useState(analysis.system);
  const [editableFeature, setEditableFeature] = useState(analysis.feature);
  const [editableTopic, setEditableTopic] = useState(analysis.topic);
  const [createSubtasks, setCreateSubtasks] = useState(true);
  const [showSlidePreview, setShowSlidePreview] = useState(false);

  const systems = ['business', 'backoffice', 'advertising funnel', 'salehere', 'other'] as const;

  useEffect(() => {
    const fetchFields = async () => {
      setFieldsLoading(true);
      try {
        const fields = await clickUpService.getCustomFields(config.apiToken, config.listId);
        setCustomFields(fields.filter(f => f.type === 'labels' || f.type === 'drop_down'));
      } catch (err) {
        console.error("Failed to fetch custom fields", err);
      } finally {
        setFieldsLoading(false);
      }
    };
    fetchFields();
  }, [config]);

  const toggleOption = (fieldId: string, optionId: string) => {
    setSelectedFieldValues(prev => {
      const current = prev[fieldId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [fieldId]: current.filter(id => id !== optionId) };
      } else {
        return { ...prev, [fieldId]: [...current, optionId] };
      }
    });
  };

  const formatSystem = (s: string) => {
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const prefix = `{${formatSystem(editableSystem)} - ${editableFeature}}`;
  const finalTitle = `${prefix} ${editableTopic}`;

  const handleSendToClickUp = async () => {
    setSending(true);
    try {
      const markdown = `
# ${finalTitle}

## 💡 AI Recommendations
- **Priority:** ${analysis.priorityLabel}
- **Story Points:** ${analysis.storyPoints}

## 📋 เกณฑ์การยอมรับ (Acceptance Criteria)
${analysis.acceptanceCriteria.map((ac, i) => `### Scenario ${i+1}\n- **GIVEN:** ${ac.given}\n- **WHEN:** ${ac.when}\n- **THEN:** ${ac.then}`).join('\n\n')}

## 🛠 รายการงานแนะนำ (Suggested Tasks)
${analysis.categories.map(c => `### ${c.name}\n${c.details.map(d => `- ${d}`).join('\n')}`).join('\n\n')}

## ✅ Definition of Done (DoD)
${analysis.definitionOfDone.map(d => `- [] ${d}`).join('\n')}

## 📊 โครงร่างสำหรับการนำเสนอ
${analysis.keynoteSlides.map(s => `### ${s.title}\n${s.content.map(c => `- ${c}`).join('\n')}`).join('\n\n')}
      `;

      const task = await clickUpService.createTask(config.apiToken, config.listId, finalTitle, markdown, analysis.priorityLevel);
      
      if (task?.id) {
        // อัปโหลดรูปภาพทั้งหมด
        if (images && images.length > 0) {
          const uploadPromises = images.map(img => 
            clickUpService.uploadAttachment(config.apiToken, task.id, img)
          );
          await Promise.all(uploadPromises);
        }

        // สร้าง Sub-tasks ถ้าเลือกไว้
        if (createSubtasks && analysis.categories.length > 0) {
           for (const cat of analysis.categories) {
              const subtaskTitle = `[${cat.name}] ${editableFeature}`;
              const subtaskMarkdown = `### งานที่ต้องทำในส่วนนี้\n${cat.details.map(d => `- ${d}`).join('\n')}`;
              await clickUpService.createSubtask(config.apiToken, task.id, subtaskTitle, subtaskMarkdown, analysis.priorityLevel);
           }
        }

        const fieldPromises = (Object.entries(selectedFieldValues) as [string, string[]][]).map(([fieldId, values]) => {
          if (values.length === 0) return Promise.resolve();
          return clickUpService.setCustomFieldValue(config.apiToken, task.id, fieldId, values);
        });
        await Promise.all(fieldPromises);
      }
      
      setSent(true);
      setTimeout(() => {
        onTaskCreated();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถส่งข้อมูลไปยัง ClickUp ได้');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-200">
        
        <div className="mb-8 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
              ปรับแต่งหัวข้อ Task ก่อนสร้าง (Task Preview)
            </h3>
            <button
              onClick={onReset}
              className="text-[10px] bg-white border border-gray-200 text-gray-500 hover:text-red-500 font-bold px-3 py-1 rounded-lg transition uppercase"
            >
              Reset AI
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">System (ระบบ)</label>
              <select 
                value={editableSystem}
                onChange={(e) => setEditableSystem(e.target.value as any)}
                className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-200 outline-none"
              >
                {systems.map(s => (
                  <option key={s} value={s}>{formatSystem(s)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Feature (ฟีเจอร์)</label>
              <input 
                type="text"
                value={editableFeature}
                onChange={(e) => setEditableFeature(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder="Feature name..."
              />
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Topic (หัวข้อ)</label>
              <input 
                type="text"
                value={editableTopic}
                onChange={(e) => setEditableTopic(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder="Topic..."
              />
            </div>
          </div>

          {!fieldsLoading && customFields.length > 0 && (
            <div className="mb-6 space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-t border-indigo-100 pt-4">เลือกแท็ก / Custom Fields</h4>
              <div className="space-y-4">
                {customFields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-[11px] font-black text-indigo-800">{field.name}</label>
                    <div className="flex flex-wrap gap-2">
                      {field.type_config.options?.map(option => {
                        const isSelected = (selectedFieldValues[field.id] || []).includes(option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => toggleOption(field.id, option.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black transition border-2 ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'
                            }`}
                          >
                            {option.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-xl border-2 border-dashed border-indigo-200">
             <span className="text-[9px] font-black text-gray-400 uppercase mb-1 block">ชื่อที่จะปรากฏใน ClickUp</span>
             <p className="text-lg font-black text-indigo-950 break-all">{finalTitle}</p>
          </div>
        </div>

          {analysis.acceptanceCriteria && analysis.acceptanceCriteria.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-emerald-900 border-l-4 border-emerald-500 pl-4 uppercase tracking-tight">เกณฑ์การยอมรับ (Acceptance Criteria)</h2>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">สำหรับ Dev & Tester</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysis.acceptanceCriteria.map((ac, i) => (
                  <div key={i} className="bg-white border-2 border-emerald-100 p-6 rounded-3xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-emerald-900 font-black text-4xl">#{i+1}</div>
                    <div className="text-[10px] font-black text-emerald-600 mb-4 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg inline-block border border-emerald-100">SCENARIO {i+1}</div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded shadow-sm">GIVEN</span>
                           <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest italic">บริบทเบื้องต้น</span>
                        </div>
                        <p className="text-[13px] font-bold text-emerald-900 leading-relaxed pl-2 border-l-2 border-emerald-200 ml-1">{ac.given}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded shadow-sm">WHEN</span>
                           <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest italic">สิ่งที่เกิดขึ้น / การกระทำ</span>
                        </div>
                        <p className="text-[13px] font-bold text-indigo-900 leading-relaxed pl-2 border-l-2 border-indigo-200 ml-1">{ac.when}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-white bg-rose-500 px-2 py-0.5 rounded shadow-sm">THEN</span>
                           <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest italic">ผลลัพธ์ที่คาดหวัง</span>
                        </div>
                        <p className="text-[13px] font-bold text-rose-900 leading-relaxed pl-2 border-l-2 border-rose-200 ml-1">{ac.then}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/40 transition"></div>
                 <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-2">AI Implementation Strategy</h3>
                 <h2 className="text-2xl font-black mb-6">คำแนะนำเชิงเทคนิคและการประเมิน (AI Recommendation)</h2>
                 
                 <div className="grid grid-cols-2 gap-6 relative z-10">
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                       <span className="text-[10px] font-black text-white/50 uppercase block mb-1">ความเร่งด่วน (Priority)</span>
                       <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                             analysis.priorityLevel === 1 ? 'bg-red-500' : 
                             analysis.priorityLevel === 2 ? 'bg-amber-500' :
                             analysis.priorityLevel === 3 ? 'bg-blue-500' : 'bg-gray-500'
                          }`}></span>
                          <span className="text-lg font-black">{analysis.priorityLabel}</span>
                       </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                       <span className="text-[10px] font-black text-white/50 uppercase block mb-1">Story Points (ประเมิน)</span>
                       <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-indigo-400 leading-none">{analysis.storyPoints}</span>
                          <span className="text-[10px] font-bold text-white/60">Complexity Units</span>
                       </div>
                    </div>
                 </div>

                 <div className="mt-8">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">เกณฑ์การตรวจสอบงานเสร็จ (Definition of Done)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                       {analysis.definitionOfDone.map((dod, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] font-bold text-white/80">
                             <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                             {dod}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-8 rounded-[2rem] text-white shadow-xl flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:scale-[1.02] transition" onClick={() => setShowSlidePreview(!showSlidePreview)}>
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl mb-2 backdrop-blur-sm group-hover:rotate-12 transition">📽️</div>
                  <h3 className="text-xl font-black">Presentation Preview</h3>
                  <p className="text-xs font-medium text-white/80 leading-relaxed">ดูโครงร่างเนื้อหาสำหรับนำเสนอ Sprint Planning หรือ Showcase งาน</p>
                  <button className="bg-white text-indigo-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg group-hover:bg-indigo-50 transition">Preview Slide</button>
              </div>
          </div>

          {showSlidePreview && (
             <div className="mb-10 bg-slate-50 p-8 rounded-[2rem] border-2 border-indigo-100 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-xl font-black text-indigo-900 flex items-center gap-3">
                      <span className="text-2xl">🪄</span> Presentation Slide Preview
                   </h2>
                   <button onClick={() => setShowSlidePreview(false)} className="text-gray-400 hover:text-black font-black text-[10px] uppercase">Hide</button>
                </div>
                <div className="flex gap-6 overflow-x-auto pb-6 snap-x">
                   {analysis.keynoteSlides.map((slide, i) => (
                      <div key={i} className="min-w-[300px] aspect-[16/9] bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 flex flex-col snap-center relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-4 font-black opacity-5 text-4xl">SLIDE {i+1}</div>
                         <h4 className="text-indigo-600 text-[10px] font-black uppercase mb-3">Agenda #{i+1}</h4>
                         <h3 className="text-lg font-black text-gray-900 mb-4">{slide.title}</h3>
                         <ul className="space-y-2 flex-1">
                            {slide.content.map((c, j) => (
                               <li key={j} className="text-[10px] font-medium text-gray-600 list-disc list-inside marker:text-indigo-400">{c}</li>
                            ))}
                         </ul>
                         <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                            <span className="text-[8px] font-black text-gray-300 uppercase">ClickUp Project Assistant</span>
                            <span className="text-[8px] font-black text-gray-300">{i+1} / {analysis.keynoteSlides.length}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          <div className="mb-10 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xl font-black text-gray-900 border-l-4 border-indigo-600 pl-4 uppercase tracking-tight">รายการงานแยกตามหมวดหมู่</h2>
                 <label className="flex items-center gap-3 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-indigo-50 transition">
                    <input 
                       type="checkbox" 
                       checked={createSubtasks} 
                       onChange={(e) => setCreateSubtasks(e.target.checked)}
                       className="w-5 h-5 accent-indigo-600 rounded"
                    />
                    <div className="flex flex-col">
                       <span className="text-[11px] font-black text-gray-900 leading-none">สร้างเป็น Sub-tasks</span>
                       <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">Auto-generate in ClickUp</span>
                    </div>
                 </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analysis.categories.map((cat, i) => (
                  <div key={i} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 hover:border-indigo-200 transition-all hover:bg-white hover:shadow-lg group">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-lg mb-4 font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">{i+1}</div>
                    <h4 className="font-black text-indigo-900 mb-4 uppercase text-[11px] tracking-widest">{cat.name}</h4>
                    <ul className="space-y-3">
                      {cat.details.map((detail, j) => (
                        <li key={j} className="text-xs font-bold text-gray-700 flex gap-3 leading-relaxed">
                          <span className="text-indigo-400 font-black flex-shrink-0">•</span> {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
          </div>

          {analysis.followUpQuestions.length > 0 && !sent && (
            <div className="mb-10 bg-amber-50 border-2 border-amber-300 p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 animate-pulse text-amber-900 text-5xl font-black">?</div>
              <h3 className="text-amber-900 text-lg font-black mb-6 flex items-center gap-3">
                <span className="bg-amber-600 text-white rounded-2xl w-10 h-10 flex items-center justify-center text-xl shadow-lg border-2 border-white">!</span>
                AI ต้องการข้อมูลเชิงลึกเพิ่มเติม (Follow-up)
              </h3>
              <div className="space-y-4 mb-8">
                {analysis.followUpQuestions.map((q, i) => (
                  <div key={i} className="bg-white/60 p-4 rounded-2xl border border-amber-200 text-sm font-bold text-amber-950 shadow-sm">
                    {q}
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="ระบุรายละเอียดเพิ่มเติมเพื่อแม่นยำขึ้น..."
                  className="flex-1 bg-white border-2 border-amber-200 rounded-2xl px-6 py-4 text-sm font-bold text-black focus:ring-4 focus:ring-amber-200 focus:border-amber-600 outline-none shadow-sm placeholder-gray-400 transition-all"
                />
                <button
                  onClick={() => {
                     onQuestionAnswered(userAnswer);
                     setUserAnswer('');
                  }}
                  className="bg-amber-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-amber-700 transition shadow-lg active:scale-95 whitespace-nowrap border-b-4 border-amber-800"
                >
                  วิเคราะห์ใหม่
                </button>
              </div>
            </div>
          )}

        <div className="mt-12 pt-8 border-t-2 border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 bg-gray-50 px-5 py-3 rounded-2xl border border-gray-200">
             <img src="https://clickup.com/favicon.ico" className="w-8 h-8 opacity-70" alt="ClickUp" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">ส่งไปยังบอร์ด</span>
                <span className="text-xs font-black text-gray-700 leading-none truncate max-w-[200px]">{config.listId}</span>
             </div>
          </div>
          <button
            onClick={handleSendToClickUp}
            disabled={sending || sent}
            className={`w-full sm:w-auto px-12 py-5 rounded-2xl font-black text-xl text-white transition transform active:scale-95 shadow-xl ${
              sent ? 'bg-green-700 ring-4 ring-green-100' : 'bg-gradient-to-br from-indigo-700 to-indigo-900 hover:from-indigo-800 hover:to-black'
            }`}
          >
            {sending ? 'กำลังส่งข้อมูล...' : sent ? '✓ สร้าง Task แล้ว!' : 'เพิ่มเป็น Task บนบอร์ด'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDisplay;
