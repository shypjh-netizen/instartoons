import { GoogleGenAI, Modality, Type } from "@google/genai";

const createClient = (apiKey: string) => new GoogleGenAI({ apiKey });

export const generateCharacter = async (apiKey: string, description: string, style: string) => {
  const ai = createClient(apiKey);
  const stylePrompts: Record<string, string> = {
    'minimal': 'Ultra-minimalist, doodle style, simple black outlines, white background, stick-figure like but cute.',
    'standard': 'Cute and simple Instagram webtoon character design. Style: clean lines, vibrant colors, expressive features.',
    'detailed': 'Detailed webtoon character, soft shading, expressive eyes, high-quality digital art style.',
    'retro': 'Retro 90s anime style, grainy texture, vibrant neon accents, bold outlines.'
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp-image-generation",
    contents: `Create a webtoon character. Style: ${stylePrompts[style] || stylePrompts.standard} Description: ${description}`,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("이미지 데이터를 받지 못했습니다. API 키와 모델 접근 권한을 확인해주세요.");
};

export const generatePanelImage = async (apiKey: string, prompt: string, style: string, characterContext?: string) => {
  const ai = createClient(apiKey);
  const stylePrompts: Record<string, string> = {
    'minimal': 'Ultra-minimalist doodle style, simple black outlines, white background.',
    'standard': 'Clean lines, vibrant colors, Instagram webtoon style.',
    'detailed': 'Detailed digital art, soft shading, expressive lighting.',
    'retro': 'Retro 90s anime style, grainy texture, bold outlines.'
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp-image-generation",
    contents: `Webtoon panel illustration. Style: ${stylePrompts[style] || stylePrompts.standard} ${characterContext ? `Main Character: ${characterContext}` : ''} Scene: ${prompt}`,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("이미지 데이터를 받지 못했습니다. API 키와 모델 접근 권한을 확인해주세요.");
};

export const generateScript = async (apiKey: string, topic: string, characters: string, panelCount: number, mainCharacter?: { name: string, description: string }) => {
  const ai = createClient(apiKey);
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Write a ${panelCount}-panel webtoon script. 
    Topic: ${topic}
    ${mainCharacter ? `Main Character: ${mainCharacter.name} (${mainCharacter.description})` : ''}
    Other Characters: ${characters}
    
    Requirements for 'scriptMarkdown':
    - Use clear headings for each panel (e.g., ### Panel 1).
    - Describe the visual scene briefly.
    - List dialogues clearly.
    - Make it easy to read with proper spacing.

    Provide the script text in Markdown and also provide ${panelCount} specific image generation prompts (one for each panel) that describe the character and the background clearly.`,
    config: {
      systemInstruction: "You are a professional webtoon writer specializing in short, relatable Instagram content. Return the result in JSON format.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scriptMarkdown: { type: Type.STRING, description: "The full script in Markdown format" },
          panels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                panelNumber: { type: Type.INTEGER },
                content: { type: Type.STRING, description: "The dialogue and action for this panel" },
                imagePrompt: { type: Type.STRING, description: "A detailed prompt for image generation including character and background" }
              },
              required: ["panelNumber", "content", "imagePrompt"]
            }
          }
        },
        required: ["scriptMarkdown", "panels"]
      }
    },
  });

  return JSON.parse(response.text);
};
