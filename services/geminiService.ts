
import { GoogleGenAI, Type } from "@google/genai";
import { SystemAnalysis, BugReportResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  generateBugReport: async (description: string, imageBase64?: string): Promise<BugReportResult> => {
    const systemInstruction = `
      คุณคือ 'QA Sidekick' ผู้เชี่ยวชาญด้านการทดสอบซอฟต์แวร์
      หน้าที่ของคุณคือเปลี่ยนข้อมูลดิบจาก Tester (รูปภาพและข้อความสั้นๆ) ให้กลายเป็น Bug Report ระดับมืออาชีพที่ Developer เข้าใจและแก้ไขได้ทันที
      
      **ต้องตอบเป็นภาษาไทยเท่านั้น**
      โครงสร้างรายงานต้องประกอบด้วย:
      1. 🚨 **สรุปปัญหา (Summary):** หัวข้อสั้นๆ ที่บอกว่าเกิดอะไรขึ้น
      2. 📱 **สภาพแวดล้อม (Environment):** เดาจากรูปหรือข้อมูล (เช่น iOS, Android, Desktop)
      3. 🛠 **ขั้นตอนการเกิดปัญหา (Steps to Reproduce):** ลำดับ 1, 2, 3...
      4. ❌ **ผลลัพธ์ที่พบ (Actual Result):** สิ่งที่เกิดขึ้นจริงในปัจจุบัน
      5. ✅ **ผลลัพธ์ที่ควรจะเป็น (Expected Result):** สิ่งที่ควรจะเกิดขึ้นถ้าไม่มีบัค
      
      ใช้ภาษาไทยที่เป็นทางการกึ่งเทคนิค (Tech-Thai) เน้นความชัดเจน
      ส่งออกเป็น JSON ที่มี markdown (เนื้อหาทั้งหมด) และ summary (หัวข้อสั้นๆ)
    `;

    const contents: any[] = [{ text: description }];
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
      2. **สรุปและแตก Task:** วิเคราะห์ภาพหรือข้อความเพื่อสร้างรายการ Task ที่ต้องทำ
      3. **สร้าง Acceptance Criteria (Gherkin Style):** สำหรับฟีเจอร์หรือปัญหาที่วิเคราะห์ ให้สร้างเงื่อนไขการยอมรับในรูปแบบ GIVEN / WHEN / THEN เพื่อให้ Developer และ QA นำไปใช้ต่อได้
      4. **เสนอแท็ก (Suggested Tags):** เสนอคำสำคัญที่เกี่ยวข้องเป็นภาษาอังกฤษสั้นๆ (เช่น UI, Backend, Logic, Fix, Feature, Improvement)

      **การส่งออกข้อมูล (Output Schema):**
      จงนำการวิเคราะห์ของคุณมาใส่ในรูปแบบ JSON ดังนี้:
      - 'topic': หัวข้อหลักเป็นภาษาไทย (ไม่ต้องใส่ prefix)
      - 'system': เลือกจาก [business, backoffice, advertising funnel, salehere, other]
      - 'feature': ชื่อฟีเจอร์สั้นๆ
      - 'suggestedTags': อาร์เรย์ของแท็กภาษาอังกฤษสั้นๆ
      - 'categories': รายการวิเคราะห์แยกตามหมวดหมู่ (ชื่อหมวดและรายละเอียดเป็นภาษาไทย)
      - 'acceptanceCriteria': อาร์เรย์ของวัตถุที่มี 'given', 'when', 'then' เป็นภาษาไทย
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
          required: ['topic', 'system', 'feature', 'suggestedTags', 'categories', 'acceptanceCriteria', 'keynoteSlides', 'followUpQuestions'],
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
};
