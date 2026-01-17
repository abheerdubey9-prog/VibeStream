
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
  // Safe access to API Key for local development
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const generateVideoMetadata = async (imageBuffer: string) => {
  const ai = getAIClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBuffer.split(',')[1],
              },
            },
            {
              text: "Analyze this video frame. Provide a catchy YouTube-style title, a 2-sentence description, and a 1-word category (Music, Gaming, News, Learning, Creative). Return strictly JSON.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ["title", "description", "category"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      title: "Shared Global Clip",
      description: "A community video shared via VibeStream P2P network.",
      category: "Creative"
    };
  }
};
