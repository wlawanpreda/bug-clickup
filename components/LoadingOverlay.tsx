
import React, { useState, useEffect } from 'react';

const messages = [
  "กำลังอ่านข้อมูลและวิเคราะห์ภาพ...",
  "จัดหมวดหมู่งานและประเมินความเสี่ยง...",
  "ร่างโครงสร้างรายงานและสไลด์นำเสนอ...",
  "เตรียมคำถามเพิ่มเติมเพื่อความแม่นยำ...",
  "กำลังจัดระเบียบ Action Items ให้คุณ..."
];

const LoadingOverlay: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="max-w-md w-full p-8 text-center space-y-6">
        <div className="relative flex justify-center">
          {/* Animated Brain/AI Icon */}
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <span className="text-3xl animate-bounce">🤖</span>
            </div>
          </div>
          {/* Scanning Line Effect */}
          <div className="absolute top-0 w-24 h-1 bg-indigo-400/30 rounded-full animate-[scan_2s_infinite]"></div>
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-black text-gray-900 leading-tight">PM's Sidekick กำลังทำงาน</h3>
          <p className="text-lg font-bold text-indigo-700 transition-all duration-500 min-h-[1.5rem]">
            {messages[messageIndex]}
          </p>
        </div>

        <div className="flex justify-center gap-1.5">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
        </div>

        <style>{`
          @keyframes scan {
            0% { transform: translateY(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(96px); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LoadingOverlay;
