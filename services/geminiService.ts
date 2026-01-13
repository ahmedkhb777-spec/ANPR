
import { GoogleGenAI, Type } from "@google/genai";
import { RecognitionResult, VehicleType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeLicensePlate(base64Image: string): Promise<RecognitionResult> {
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `
    أنت خبير في التعرف على لوحات السيارات الدولية. قم بتحليل الصورة واستخرج البيانات التالية بدقة:
    1. رقم اللوحة الأساسي (الأرقام).
    2. كود اللوحة أو الحرف (إن وجد).
    3. اسم المدينة أو الإمارة المكتوب على اللوحة.
    4. تصنيف نوع المركبة بناءً على القواعد التالية:
       - 'TAXI': إذا كانت اللوحة تحتوي على صورة سيارة صغيرة (شعار التاكسي) أو مكتوب عليها أجرة.
       - 'POLICE': إذا كانت اللوحة تابعة لجهاز الشرطة أو الأمن.
       - 'AMBULANCE': إذا كانت سيارة إسعاف.
       - 'PRIVATE': للوحات المدنية العادية.
       - 'OTHER': لأي تصنيف آخر.
    5. تحديد الدولة:
       - إذا كانت اللوحة من دولة الإمارات العربية المتحدة، اكتب "الإمارات".
       - إذا كانت من أي دولة أخرى، اكتب "دولة أخرى" (مع ذكر اسم الدولة بجانبها إن أمكن).
    6. درجة الثقة (0-1).
    يجب أن تكون النتيجة بتنسيق JSON حصراً.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        { text: "حلل هذه اللوحة واستخرج التفاصيل بناءً على القواعد المذكورة." }
      ]
    },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plateNumber: { type: Type.STRING },
          letter: { type: Type.STRING },
          city: { type: Type.STRING },
          vehicleType: { 
            type: Type.STRING,
            enum: ['PRIVATE', 'TAXI', 'POLICE', 'AMBULANCE', 'OTHER']
          },
          country: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["plateNumber", "letter", "city", "vehicleType", "country", "confidence"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("لم يتم استلام رد من النظام.");
  
  return JSON.parse(text) as RecognitionResult;
}
