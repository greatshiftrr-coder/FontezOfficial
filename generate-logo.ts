import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generate() {
  console.log('Generating logo...');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: 'A modern, sleek, minimalist app icon logo for a typography and font generation app named "Fontez". The logo features a stylized letter "F" combined with a spark or magic wand, vibrant emerald green and dark zinc colors, flat vector art style, clean dark background, perfectly centered.'
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      if (!fs.existsSync('public')) {
        fs.mkdirSync('public');
      }
      fs.writeFileSync('public/logo.png', buffer);
      fs.writeFileSync('public/apple-touch-icon.png', buffer);
      console.log('Logo generated successfully.');
      break;
    }
  }
}
generate().catch(console.error);
