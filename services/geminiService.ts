
import { GoogleGenAI, Type } from "@google/genai";
import { SystemAnalysis, BugReportResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiService = {
  generateBugReport: async (description: string, mediaFiles?: { data: string, mimeType: string }[], history?: any[]): Promise<BugReportResult> => {
    const historyContext = history && history.length > 0 
      ? `\n\n**ประวัติการพูดคุยที่เกี่ยวข้อง:**\n${history.map(h => `${h.user.username}: ${h.comment_text}`).join('\n---\n')}`
      : '';

    const systemInstruction = `
      คุณคือ 'QA Sidekick' ผู้เชี่ยวชาญด้านการทดสอบซอฟต์แวร์
      หน้าที่ของคุณคือเปลี่ยนข้อมูลดิบจาก Tester (รูปภาพ, วิดีโอ และข้อความสั้นๆ) ให้กลายเป็น Bug Report ระดับมืออาชีพที่ Developer เข้าใจและแก้ไขได้ทันที
      
      **บริบทเพิ่มเติม:** 
      คุณจะได้รับประวัติการพูดคุย (History) ของคอมเมนต์ที่เกี่ยวข้องด้วย หากมีการพูดคุยถึงวิธีแก้ปัญหา หรืออาการที่เคยเกิดขึ้นมาก่อน ให้นำมาวิเคราะห์ประกอบเพื่อให้รายงานละเอียดยิ่งขึ้น (เช่น ระบุว่าเคยพบอาการนี้มาก่อนไหม หรือเคยลองแก้ด้วยวิธีไหนแล้วไม่ได้ผล)
      
      **ต้องตอบเป็นภาษาไทยเท่านั้น**
      โครงสร้างรายงานต้องประกอบด้วย:
      1. 🚨 **สรุปปัญหา (Summary):** หัวข้อสั้นๆ ที่บอกว่าเกิดอะไรขึ้น
      2. 📱 **สภาพแวดล้อม (Environment):** เดาจากสื่อหรือข้อมูล (เช่น iOS, Android, Desktop)
      3. 🛠 **ขั้นตอนการเกิดปัญหา (Steps to Reproduce):** ลำดับ 1, 2, 3...
      4. ❌ **ผลลัพธ์ที่พบ (Actual Result):** สิ่งที่เกิดขึ้นจริงในปัจจุบัน
      5. ✅ **ผลลัพธ์ที่ควรจะเป็น (Expected Result):** สิ่งที่ควรจะเกิดขึ้นถ้าไม่มีบัค
      6. 🔍 **บทวิเคราะห์เพิ่มเติม (Additional Context/History):** ข้อมูลที่ได้จากการวิเคราะห์ประวัติการสนทนา (ถ้ามี) เช่น นี่เป็นบัคซ้ำซ้อน หรือเคยมีความพยายามแก้ไขแล้วแต่ยังพบปัญหาอยู่
      
      ใช้ภาษาไทยที่เป็นทางการกึ่งเทคนิค (Tech-Thai) เน้นความชัดเจน
      ส่งออกเป็น JSON ที่มี markdown (เนื้อหาทั้งหมด) และ summary (หัวข้อสั้นๆ)
    `;

    const contents: any[] = [{ text: `รายละเอียดจาก Tester: ${description}${historyContext}` }];
    
    if (mediaFiles && mediaFiles.length > 0) {
      mediaFiles.forEach(file => {
        contents.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data.includes(',') ? file.data.split(',')[1] : file.data,
          },
        });
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            markdown: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ['markdown', 'summary'],
        },
      },
    });

    try {
      const responseText = typeof response.text === 'string' ? response.text : JSON.stringify(response.text);
      // Clean up potential markdown blocks if AI ignored responseMimeType (rare but happens)
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse Gemini bug report response:", response.text);
      throw new Error(`รูปแบบการตอบกลับจาก AI ไม่ถูกต้อง: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  },

  analyzeSystem: async (prompt: string, purpose?: string, imagesBase64?: string[]): Promise<SystemAnalysis> => {
    const systemInstruction = `
      คุณคือ 'PM's Sidekick' เป็นผู้ช่วย AI ระดับผู้เชี่ยวชาญสำหรับ Project Manager ของทีมพัฒนาซอฟต์แวร์โดยเฉพาะ

      **เป้าหมายหลักของคุณ:**
      ช่วยให้ Project Manager ทำงานได้อย่างมีประสิทธิภาพ, ประหยัดเวลา, และสื่อสารกับทีมได้ดียิ่งขึ้น

      **ต้องตอบเนื้อหาทั้งหมดเป็นภาษาไทยเท่านั้น**

      **ภารกิจของคุณในการวิเคราะห์ครั้งนี้:**
      1. **วิเคราะห์ระบบและฟีเจอร์:** จำแนกข้อมูลที่ได้รับให้อยู่ในระบบ (System) [business, backoffice, advertising funnel, salehere, other] และระบุชื่อ 'feature' สั้นๆ
      2. **การประเมินและการแตก Task (Dev Focus):**
         - วิเคราะห์ความเร่งด่วน ('priorityLabel') และ Story Points ('storyPoints')
         - แตกรายการงานแยกตามหมวดหมู่เทคนิค (UI/UX, Backend, Logic) ให้กระชับ เข้าใจง่าย
      3. ** Acceptance Criteria & DoD:** สร้างเงื่อนไขการยอมรับ (GIVEN/WHEN/THEN) และรายการตรวจสอบมาตรฐาน (DoD) เป็นภาษาไทยที่ชัดเจน
      4. **ขัดเกลาวัตถุประสงค์ (Refine Purpose):** นำข้อมูล 'purpose' จากผู้ใช้มาสรุปและขัดเกลาให้ดูเป็นมืออาชีพ ( Professional Tone) ใส่ในฟิลด์ 'refinedPurpose'
      5. **ลดเนื้อหาส่วนเกิน:** ไม่ต้องอธิบายยืดเยื้อ เน้นข้อมูลที่ Developer นำไปใช้งานได้ทันที

      **การส่งออกข้อมูล (Output Schema):**
      จงนำการวิเคราะห์ของคุณมาใส่ในรูปแบบ JSON ดังนี้:
      - 'topic': หัวข้อหลักเป็นภาษาไทย (ไม่ต้องใส่ prefix)
      - 'system': เลือกจาก [business, backoffice, advertising funnel, salehere, other]
      - 'feature': ชื่อฟีเจอร์สั้นๆ
      - 'priorityLabel': [Urgent, High, Normal, Low]
      - 'priorityLevel': ตัวเลข 1-4
      - 'storyPoints': ตัวเลข 1-13
      - 'suggestedTags': อาร์เรย์ของแท็กภาษาอังกฤษสั้นๆ
      - 'categories': รายการวิเคราะห์แยกตามหมวดหมู่ (ชื่อหมวดและรายละเอียดเป็นภาษาไทย)
      - 'acceptanceCriteria': อาร์เรย์ของวัตถุที่มี 'given', 'when', 'then' เป็นภาษาไทย
      - 'definitionOfDone': อาร์เรย์ของสตริง (ภาษาไทย)
      - 'refinedPurpose': วัตถุประสงค์ที่ขัดเกลาแล้ว (ภาษาไทย)
    `;

    const fullPrompt = `
      วัตถุประสงค์ของผู้ใช้: ${purpose || 'ไม่ได้ระบุ'}
      
      โจทย์/รายละเอียด:
      ${prompt}
    `;

    const parts: any[] = [{ text: fullPrompt }];
    
    if (imagesBase64 && imagesBase64.length > 0) {
      imagesBase64.forEach(img => {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: img.split(',')[1] || img,
          },
        });
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            system: { 
              type: Type.STRING, 
              description: "Choose one: business, backoffice, advertising funnel, salehere, other" 
            },
            feature: { type: Type.STRING },
            priorityLevel: { type: Type.NUMBER },
            priorityLabel: { type: Type.STRING },
            storyPoints: { type: Type.NUMBER },
            suggestedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'details'],
              },
            },
            acceptanceCriteria: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  given: { type: Type.STRING },
                  when: { type: Type.STRING },
                  then: { type: Type.STRING },
                },
                required: ['given', 'when', 'then'],
              },
            },
            definitionOfDone: { type: Type.ARRAY, items: { type: Type.STRING } },
            refinedPurpose: { type: Type.STRING },
          },
          required: ['topic', 'system', 'feature', 'priorityLabel', 'priorityLevel', 'storyPoints', 'suggestedTags', 'categories', 'acceptanceCriteria', 'definitionOfDone', 'refinedPurpose'],
        },
      },
    });

    try {
      const responseText = typeof response.text === 'string' ? response.text : JSON.stringify(response.text);
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse Gemini response:", response.text);
      throw new Error(`รูปแบบการตอบกลับจาก AI ไม่ถูกต้อง: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  },

  summarizeComments: async (comments: any[]): Promise<string> => {
    const context = comments.map(c => `${c.user.username}: ${c.comment_text}`).join('\n---\n');
    const systemInstruction = `
      คุณคือ Senior Project Manager ผู้เชี่ยวชาญ
      หน้าที่ของคุณคือสรุปประเด็นสำคัญจากบทสนทนา (Comments) ใน Task งาน
      
      กรุณาสรุปเป็นภาษาไทยในรูปแบบดังนี้:
      1. 📍 **สรุปสถานะปัจจุบัน:** (ใครกำลังทำอะไรอยู่ หรือติดตรงไหน)
      2. ⚠️ **ประเด็นปัญหา/บัค:** (ถ้ามีระบุไว้ในบทสนทนา)
      3. 🚀 **สิ่งที่ควรทำต่อไป (Next Steps):** (คำแนะนำสั้นๆ สำหรับ PM)
      
      ข้อความต้องกระชับ (ไม่เกิน 5-7 บรรทัด) และใช้ภาษาที่เข้าใจง่ายแต่เป็นมืออาชีพ
    `;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `กรุณาสรุปประเด็นจากคอมเมนต์เหล่านี้:\n${context}` }] },
        config: { systemInstruction },
      });
      return response.text;
    } catch (error) {
      console.error("Summary error:", error);
      return "ไม่สามารถสรุปข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
    }
  },

  improveBugDescription: async (description: string): Promise<string> => {
    const systemInstruction = `
      คุณคือ 'Prompt Optimizer' หน้าที่ของคุณคือรับคำอธิบายบัคหรือปัญหาจากผู้ใช้ 
      แล้วปรับปรุงให้มีความชัดเจน มีโครงสร้าง และเป็นมืออาชีพมากขึ้น (Professional Bug Report)
      
      สิ่งที่ควรปรับปรุง:
      1. ภาษา: ปรับให้เป็นทางการและชัดเจนขึ้น
      2. โครงสร้าง: แบ่งเป็นส่วนๆ เช่น สิ่งที่เกิดขึ้น (Observed), สิ่งที่ควรจะเป็น (Expected), และขั้นตอนการพบ (Steps) ถ้าเป็นไปได้
      3. รายละเอียด: ตัดคำฟุ่มเฟือยออกแต่รักษาใจความสำคัญ
      
      **เงื่อนไข:**
      - ตอบกลับเฉพาะเนื้อหาคำอธิบายที่ปรับปรุงแล้วเท่านั้น ไม่ต้องมีคำเกริ่นนำ
      - ใช้ภาษาไทยเป็นหลัก แต่ใช้คำศัพท์เทคนิคภาษาอังกฤษตามความเหมาะสม
      - รักษาความกระชับ
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `ช่วยปรับปรุงข้อความนี้ให้เป็นรายงานบัคที่สมบูรณ์ขึ้น: ${description}` }] },
        config: { systemInstruction },
      });
      return response.text.trim();
    } catch (error) {
      console.error("Improve description error:", error);
      throw new Error("ไม่สามารถปรับปรุงข้อความได้ในขณะนี้");
    }
  },

  improvePrompt: async (prompt: string, purpose?: string): Promise<string> => {
    const systemInstruction = `
      คุณคือ 'PM's Prompt Optimizer' หน้าที่ของคุณคือรับ 'รายละเอียด/โจทย์' จาก PM 
      แล้วปรับปรุงให้มีความชัดเจน มีโครงสร้าง และเป็นประโยชน์ต่อการนำไปวิเคราะห์ต่อให้มากที่สุด
      
      สิ่งที่ควรปรับปรุง:
      1. ความชัดเจน: ปรับประโยคให้อ่านง่ายและตรงประเด็น
      2. โครงสร้าง: หากรายละเอียดซับซ้อน ให้จัดกลุ่มหรือแบ่งเป็นหัวข้อ
      3. บริบท (Context): หากมี 'วัตถุประสงค์' (Purpose) ให้เชื่อมโยงรายละเอียดเข้ากับความต้องการนั้นให้ลงตัว
      
      **เงื่อนไข:**
      - ตอบกลับเฉพาะเนื้อหาที่ปรับปรุงแล้วเท่านั้น ไม่ต้องมีคำเกริ่นนำ
      - ใช้ภาษาไทยเป็นหลัก
      - รักษาความกระชับ แต่ครอบคลุมประเด็นสำคัญ
    `;

    const input = purpose 
      ? `วัตถุประสงค์: ${purpose}\nรายละเอียดที่ต้องการให้ปรับปรุง: ${prompt}`
      : `รายละเอียดที่ต้องการให้ปรับปรุง: ${prompt}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: input }] },
        config: { systemInstruction },
      });
      return response.text.trim();
    } catch (error) {
      console.error("Improve prompt error:", error);
      throw new Error("ไม่สามารถปรับปรุงข้อความได้ในขณะนี้");
    }
  },

  generateIDEPrompt: async (taskName: string, description: string, subtasks?: any[]): Promise<string> => {
    const subtasksContext = subtasks && subtasks.length > 0
      ? `\n\nรายการงานย่อย:\n${subtasks.map((t: any) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')}`
      : '';

    const systemInstruction = `
      คุณคือ 'Dev Sidekick' ผู้เชี่ยวชาญด้านการเขียนโปรแกรมและการทำ Prompt Engineering
      หน้าที่ของคุณคือสร้าง Prompt สำหรับใช้ใน AI-Powered IDE (เช่น Cursor, VS Code with Copilot/Gemini, Windsurf) เพื่อให้ AI ช่วยเขียนโค้ดตามรายละเอียดงานที่ได้รับ
      
      Prompt ที่คุณสร้างควรจะ:
      1. มีโครงสร้างที่ชัดเจน (Context, Objective, Requirements, Technical Details)
      2. ระบุสิ่งที่ต้องทำ (Objective) ให้ชัดเจนที่สุด
      3. ระบุเงื่อนไขและ Acceptance Criteria (AC)
      4. รูปแบบต้องนำไป 'Copy-Paste' ใส่ IDE ได้ทันที
      
      **โครงสร้างที่แนะนำ:**
      ---
      # Role & Context
      [อธิบายบริบทสั้นๆ]
      
      # Objective
      [เป้าหมายหลักของงาน]
      
      # Requirements & Acceptance Criteria
      - [ข้อกำหนด]
      
      # Instructions
      - [ลำดับขั้นตอนการทำ]
      ---
      
      ต้องตอบเป็นภาษาไทยในส่วนอธิบายสั้นๆ เสมอ แต่ตัว 'IDE Prompt' หลักควรใช้ภาษาอังกฤษ (Technical English) เป็นหลักเพื่อให้ AI ใน IDE ประมวลผลได้แม่นยำที่สุด
    `;

    const promptText = `
      ช่วยสร้าง IDE Prompt สำหรับงานนี้:
      หัวข้องาน: ${taskName}
      รายละเอียด: ${description}
      ${subtasksContext}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: promptText }] },
        config: { systemInstruction },
      });
      return response.text;
    } catch (error) {
      console.error("IDE Prompt generation error:", error);
      return "ไม่สามารถสร้าง IDE Prompt ได้ในขณะนี้";
    }
  }
};
