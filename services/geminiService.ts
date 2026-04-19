
import { GoogleGenAI, Type } from "@google/genai";
import { SystemAnalysis, BugReportResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  generateBugReport: async (description: string, imageBase64?: string, history?: any[]): Promise<BugReportResult> => {
    const historyContext = history && history.length > 0 
      ? `\n\n**ประวัติการพูดคุยที่เกี่ยวข้อง:**\n${history.map(h => `${h.user.username}: ${h.comment_text}`).join('\n---\n')}`
      : '';

    const systemInstruction = `
      คุณคือ 'QA Sidekick' ผู้เชี่ยวชาญด้านการทดสอบซอฟต์แวร์
      หน้าที่ของคุณคือเปลี่ยนข้อมูลดิบจาก Tester (รูปภาพและข้อความสั้นๆ) ให้กลายเป็น Bug Report ระดับมืออาชีพที่ Developer เข้าใจและแก้ไขได้ทันที
      
      **บริบทเพิ่มเติม:** 
      คุณจะได้รับประวัติการพูดคุย (History) ของคอมเมนต์ที่เกี่ยวข้องด้วย หากมีการพูดคุยถึงวิธีแก้ปัญหา หรืออาการที่เคยเกิดขึ้นมาก่อน ให้นำมาวิเคราะห์ประกอบเพื่อให้รายงานละเอียดยิ่งขึ้น (เช่น ระบุว่าเคยพบอาการนี้มาก่อนไหม หรือเคยลองแก้ด้วยวิธีไหนแล้วไม่ได้ผล)
      
      **ต้องตอบเป็นภาษาไทยเท่านั้น**
      โครงสร้างรายงานต้องประกอบด้วย:
      1. 🚨 **สรุปปัญหา (Summary):** หัวข้อสั้นๆ ที่บอกว่าเกิดอะไรขึ้น
      2. 📱 **สภาพแวดล้อม (Environment):** เดาจากรูปหรือข้อมูล (เช่น iOS, Android, Desktop)
      3. 🛠 **ขั้นตอนการเกิดปัญหา (Steps to Reproduce):** ลำดับ 1, 2, 3...
      4. ❌ **ผลลัพธ์ที่พบ (Actual Result):** สิ่งที่เกิดขึ้นจริงในปัจจุบัน
      5. ✅ **ผลลัพธ์ที่ควรจะเป็น (Expected Result):** สิ่งที่ควรจะเกิดขึ้นถ้าไม่มีบัค
      6. 🔍 **บทวิเคราะห์เพิ่มเติม (Additional Context/History):** ข้อมูลที่ได้จากการวิเคราะห์ประวัติการสนทนา (ถ้ามี) เช่น นี่เป็นบัคซ้ำซ้อน หรือเคยมีความพยายามแก้ไขแล้วแต่ยังพบปัญหาอยู่
      
      ใช้ภาษาไทยที่เป็นทางการกึ่งเทคนิค (Tech-Thai) เน้นความชัดเจน
      ส่งออกเป็น JSON ที่มี markdown (เนื้อหาทั้งหมด) และ summary (หัวข้อสั้นๆ)
    `;

    const contents: any[] = [{ text: `รายละเอียดจาก Tester: ${description}${historyContext}` }];
    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64.split(',')[1] || imageBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
      return JSON.parse(response.text);
    } catch (err) {
      console.error("Failed to parse Gemini bug report response:", response.text);
      throw new Error("รูปแบบการตอบกลับจาก AI ไม่ถูกต้อง");
    }
  },

  analyzeSystem: async (prompt: string, imagesBase64?: string[]): Promise<SystemAnalysis> => {
    const systemInstruction = `
      คุณคือ 'PM's Sidekick' เป็นผู้ช่วย AI ระดับผู้เชี่ยวชาญสำหรับ Project Manager ของทีมพัฒนาซอฟต์แวร์โดยเฉพาะ

      **เป้าหมายหลักของคุณ:**
      ช่วยให้ Project Manager ทำงานได้อย่างมีประสิทธิภาพ, ประหยัดเวลา, และสื่อสารกับทีมได้ดียิ่งขึ้น

      **ต้องตอบเนื้อหาทั้งหมดเป็นภาษาไทยเท่านั้น**

      **ภารกิจของคุณในการวิเคราะห์ครั้งนี้:**
      1. **วิเคราะห์ระบบและฟีเจอร์:** จำแนกข้อมูลที่ได้รับให้อยู่ในระบบ (System) ดังต่อไปนี้เท่านั้น:
         - business
         - backoffice
         - advertising funnel
         - salehere
         - other
         และระบุชื่อ 'feature' สั้นๆ (เช่น login, report, ui-update)
      2. **ความสำคัญและการประเมิน (AI Recommendation):**
         - วิเคราะห์ความเร่งด่วน ('priorityLabel') และระดับเลข ('priorityLevel' : 1=Urgent, 2=High, 3=Normal, 4=Low)
         - ประเมิน Story Points ('storyPoints' : เลือกจาก 1, 2, 3, 5, 8, 13)
      3. **สรุปและแตก Task (Sub-tasks):** วิเคราะห์รายการที่ต้องทำแยกตามหมวดหมู่ (UI/UX, Backend, Logic) เพื่อให้เหมาะกับการนำไปสร้างเป็น Sub-tasks ได้ทันที
      4. **สร้าง Acceptance Criteria (Gherkin Style):** สำหรับฟีเจอร์หรือปัญหาที่วิเคราะห์ ให้สร้างเงื่อนไขการยอมรับในรูปแบบ GIVEN / WHEN / THEN เพื่อให้ Developer และ QA นำไปใช้ต่อได้
      5. **Definition of Done (DoD):** ระบุรายการตรวจสอบมาตรฐานเพื่อให้งานเสร็จสมบูรณ์ระดับมืออาชีพ
      6. **เสนอแท็ก (Suggested Tags):** เสนอคำสำคัญที่เกี่ยวข้องเป็นภาษาอังกฤษสั้นๆ (เช่น UI, Backend, Logic, Fix, Feature, Improvement)

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
      - 'keynoteSlides': โครงร่างเนื้อหาสำหรับนำเสนอ (เป็นภาษาไทย)
      - 'followUpQuestions': คำถามเพิ่มเติม (เป็นภาษาไทย)
    `;

    const parts: any[] = [{ text: prompt }];
    
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
      model: 'gemini-3-pro-preview',
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
            keynoteSlides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['title', 'content'],
              },
            },
            followUpQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['topic', 'system', 'feature', 'priorityLabel', 'priorityLevel', 'storyPoints', 'suggestedTags', 'categories', 'acceptanceCriteria', 'definitionOfDone', 'keynoteSlides', 'followUpQuestions'],
        },
      },
    });

    try {
      return JSON.parse(response.text);
    } catch (err) {
      console.error("Failed to parse Gemini response:", response.text);
      throw new Error("รูปแบบการตอบกลับจาก AI ไม่ถูกต้อง");
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
        model: 'gemini-1.5-flash',
        contents: { parts: [{ text: `กรุณาสรุปประเด็นจากคอมเมนต์เหล่านี้:\n${context}` }] },
        config: { systemInstruction },
      });
      return response.text;
    } catch (error) {
      console.error("Summary error:", error);
      return "ไม่สามารถสรุปข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
    }
  }
};
