import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateCharacter = async (description: string, style: string) => {
  const stylePrompts: Record<string, string> = {
    'minimal': 'Ultra-minimalist, doodle style, simple black outlines, white background, stick-figure like but cute.',
    'standard': 'Cute and simple Instagram webtoon character design. Style: clean lines, vibrant colors, expressive features.',
    'detailed': 'Detailed webtoon character, soft shading, expressive eyes, high-quality digital art style.',
    'retro': 'Retro 90s anime style, grainy texture, vibrant neon accents, bold outlines.'
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          text: `Create a webtoon character. Style: ${stylePrompts[style] || stylePrompts.standard} Description: ${description}`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate image");
};

export const generatePanelImage = async (prompt: string, style: string, characterContext?: string) => {
  const stylePrompts: Record<string, string> = {
    'minimal': 'Ultra-minimalist doodle style, simple black outlines, white background.',
    'standard': 'Clean lines, vibrant colors, Instagram webtoon style.',
    'detailed': 'Detailed digital art, soft shading, expressive lighting.',
    'retro': 'Retro 90s anime style, grainy texture, bold outlines.'
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          text: `Webtoon panel illustration. Style: ${stylePrompts[style] || stylePrompts.standard} 
          ${characterContext ? `Main Character: ${characterContext}` : ''}
          Scene: ${prompt}`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate panel image");
};

export const generateScript = async (topic: string, characters: string, panelCount: number, mainCharacter?: { name: string, description: string }) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
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
