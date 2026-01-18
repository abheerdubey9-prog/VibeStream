
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI client with the API key from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateVideoMetadata = async (imageBuffer: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
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
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Catchy title for the video.",
            },
            description: {
              type: Type.STRING,
              description: "Two sentence description of what's shown.",
            },
            category: {
              type: Type.STRING,
              description: "The primary category for the video.",
            },
          },
          required: ["title", "description", "category"],
          propertyOrdering: ["title", "description", "category"],
        },
      },
    });

    // Directly access the .text property of GenerateContentResponse.
    const jsonStr = response.text || '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      title: "Shared Global Clip",
      description: "A community video shared via VibeStream P2P network.",
      category: "Creative"
    };
  }
};
