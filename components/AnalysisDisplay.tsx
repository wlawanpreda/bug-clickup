
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

## 📋 เกณฑ์การยอมรับ (Acceptance Criteria)
${analysis.acceptanceCriteria.map((ac, i) => `### Scenario ${i+1}\n- **GIVEN:** ${ac.given}\n- **WHEN:** ${ac.when}\n- **THEN:** ${ac.then}`).join('\n\n')}

## 🛠 รายการงานแนะนำ (Suggested Tasks)
${analysis.categories.map(c => `### ${c.name}\n${c.details.map(d => `- ${d}`).join('\n')}`).join('\n\n')}

## 📊 โครงร่างสำหรับการนำเสนอ
${analysis.keynoteSlides.map(s => `### ${s.title}\n${s.content.map(c => `- ${c}`).join('\n')}`).join('\n\n')}
      `;

      const task = await clickUpService.createTask(config.apiToken, config.listId, finalTitle, markdown);
      
      if (task?.id) {
        // อัปโหลดรูปภาพทั้งหมด
        if (images && images.length > 0) {
          const uploadPromises = images.map(img => 
            clickUpService.uploadAttachment(config.apiToken, task.id, img)
          );
          await Promise.all(uploadPromises);
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
            <h2 className="text-xl font-black text-emerald-900 mb-6 border-l-4 border-emerald-500 pl-4 uppercase tracking-tight">เกณฑ์การยอมรับ (Acceptance Criteria)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.acceptanceCriteria.map((ac, i) => (
                <div key={i} className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
                  <div className="text-[10px] font-black text-emerald-600 mb-3 uppercase tracking-tighter bg-white px-2 py-0.5 rounded-full inline-block border border-emerald-200">Scenario {i+1}</div>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <span className="text-[10px] font-black text-white bg-emerald-600 px-1.5 py-0.5 rounded h-fit">GIVEN</span>
                      <p className="text-xs font-bold text-emerald-900 leading-relaxed">{ac.given}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-black text-white bg-indigo-600 px-1.5 py-0.5 rounded h-fit">WHEN</span>
                      <p className="text-xs font-bold text-indigo-900 leading-relaxed">{ac.when}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-black text-white bg-rose-600 px-1.5 py-0.5 rounded h-fit">THEN</span>
                      <p className="text-xs font-bold text-rose-900 leading-relaxed">{ac.then}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {analysis.followUpQuestions.length > 0 && !sent && (
          <div className="mb-10 bg-amber-50 border-2 border-amber-300 p-6 rounded-2xl shadow-inner">
            <h3 className="text-amber-900 text-lg font-black mb-4 flex items-center gap-2">
              <span className="bg-amber-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-md">?</span>
              ต้องการข้อมูลเพิ่มเติม:
            </h3>
            <ul className="list-disc ml-6 space-y-3 text-amber-950 font-bold mb-6">
              {analysis.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
            <div className="flex gap-3">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="ระบุคำตอบที่นี่..."
                className="flex-1 bg-white border-2 border-amber-400 rounded-xl px-4 py-3 text-sm font-bold text-black focus:ring-4 focus:ring-amber-100 focus:border-amber-600 outline-none shadow-sm placeholder-gray-400"
              />
              <button
                onClick={() => {
                   onQuestionAnswered(userAnswer);
                   setUserAnswer('');
                }}
                className="bg-amber-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-amber-700 transition shadow-md active:scale-95 whitespace-nowrap"
              >
                วิเคราะห์ใหม่
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-6 border-l-4 border-indigo-600 pl-4 uppercase tracking-tight">รายการงานแนะนำ</h2>
            <div className="space-y-8">
              {analysis.categories.map((cat, i) => (
                <div key={i} className="group">
                  <h4 className="font-black text-indigo-800 mb-3 uppercase text-[11px] tracking-widest bg-indigo-50 inline-block px-2 py-1 rounded">{cat.name}</h4>
                  <ul className="space-y-3">
                    {cat.details.map((detail, j) => (
                      <li key={j} className="text-sm font-bold text-gray-800 flex gap-3 leading-relaxed border-b border-gray-50 pb-2">
                        <span className="text-indigo-400 font-black flex-shrink-0 mt-1">✓</span> {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-6 border-l-4 border-purple-600 pl-4 uppercase tracking-tight">โครงร่างสรุปผลงาน</h2>
            <div className="space-y-6">
              {analysis.keynoteSlides.map((slide, i) => (
                <div key={i} className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-purple-300 transition group">
                  <h4 className="font-black text-gray-900 text-sm mb-3 flex items-center gap-2">
                    <span className="text-purple-600 text-[10px] font-black border border-purple-200 px-1.5 py-0.5 rounded uppercase">ส่วนที่ {i+1}</span>
                    {slide.title}
                  </h4>
                  <ul className="space-y-2">
                    {slide.content.map((item, j) => (
                      <li key={j} className="text-xs font-bold text-gray-600 leading-relaxed list-inside list-disc marker:text-purple-400">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

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
