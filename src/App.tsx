import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import opentype from 'opentype.js';
import { Loader2, Download, Type as TypeIcon, Sparkles, Wand2, RotateCcw, Bookmark, Trash2, ZoomIn, ZoomOut, Palette, Fan } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface SavedFont {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
  glyphData: any[];
}

const textEffects = [
  { id: 'none', label: 'Normal', className: 'text-zinc-100' },
  { id: 'gradient', label: 'Gradient', className: 'bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500' },
  { id: 'metallic', label: 'Metallic', className: 'bg-clip-text text-transparent bg-gradient-to-b from-gray-300 via-zinc-100 to-gray-500 drop-shadow-md' },
  { id: 'neon', label: 'Neon', className: 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]' },
  { id: 'outline', label: 'Outline', className: 'text-transparent [-webkit-text-stroke:1px_#f4f4f5]' },
  { id: 'gold', label: 'Gold', className: 'bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-700 drop-shadow-sm' },
  { id: 'hologram', label: 'Hologram', className: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] opacity-90' },
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [generatedFontUrl, setGeneratedFontUrl] = useState<string | null>(null);
  const [fontName, setFontName] = useState('Fontez-Generated');
  const [uniqueFontFamily, setUniqueFontFamily] = useState('GeneratedFont');
  const [previewText, setPreviewText] = useState('The Quick Brown Fox Jumps Over The Lazy Dog. 0123456789 !?,');
  const [previewZoom, setPreviewZoom] = useState(4);
  const [textEffect, setTextEffect] = useState('none');
  const [error, setError] = useState<string | null>(null);
  const [rawGlyphs, setRawGlyphs] = useState<any[]>([]);
  const [savedFonts, setSavedFonts] = useState<SavedFont[]>([]);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('fontez_saved_fonts');
    if (stored) {
      try {
        setSavedFonts(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved fonts", e);
      }
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (isGenerating) {
      setLoadingStep(0);
      interval = window.setInterval(() => {
        setLoadingStep(prev => (prev < 3 ? prev + 1 : prev));
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    // Cleanup object URL on unmount
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
      }
    };
  }, []);

  const applyFont = (glyphData: any[], name: string) => {
    // Create opentype.js font
    const notdefGlyph = new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: 650,
      path: new opentype.Path()
    });

    const glyphs = [notdefGlyph];

    // Add space character
    glyphs.push(new opentype.Glyph({
      name: 'space',
      unicode: 32,
      advanceWidth: 300,
      path: new opentype.Path()
    }));

    for (const data of glyphData) {
      const path = new opentype.Path();
      if (data.path) {
        const commands = data.path.match(/[a-zA-Z][^a-zA-Z]*/g);
        if (commands) {
          for (const cmdStr of commands) {
            const type = cmdStr[0].toUpperCase();
            const argsMatch = cmdStr.slice(1).match(/-?\d*\.?\d+/g);
            const args = argsMatch ? argsMatch.map(Number) : [];
            
            try {
              if (type === 'M' && args.length >= 2) path.moveTo(args[0], args[1]);
              else if (type === 'L' && args.length >= 2) path.lineTo(args[0], args[1]);
              else if (type === 'Q' && args.length >= 4) path.quadraticCurveTo(args[0], args[1], args[2], args[3]);
              else if (type === 'C' && args.length >= 6) path.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
              else if (type === 'Z') path.close();
            } catch (e) {
              console.warn('Invalid path command', cmdStr, e);
            }
          }
        }
      }

      const glyph = new opentype.Glyph({
        name: data.character,
        unicode: data.character.charCodeAt(0),
        advanceWidth: data.advanceWidth || 600,
        path: path
      });
      glyphs.push(glyph);

      // Map lowercase to uppercase if it's an uppercase letter and lowercase wasn't generated
      if (data.character >= 'A' && data.character <= 'Z') {
        const lowerChar = data.character.toLowerCase();
        if (!glyphData.some(g => g.character === lowerChar)) {
          const lowerGlyph = new opentype.Glyph({
            name: lowerChar,
            unicode: lowerChar.charCodeAt(0),
            advanceWidth: data.advanceWidth || 600,
            path: path
          });
          glyphs.push(lowerGlyph);
        }
      }
    }

    const uniqueFamily = `GeneratedFont_${Date.now()}`;
    setUniqueFontFamily(uniqueFamily);

    const font = new opentype.Font({
      familyName: name,
      styleName: 'Regular',
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      glyphs: glyphs
    });

    const buffer = font.toArrayBuffer();
    const blob = new Blob([buffer], { type: 'font/ttf' });
    const url = URL.createObjectURL(blob);
    
    setGeneratedFontUrl(url);

    // Inject font into document
    if (styleRef.current) {
      styleRef.current.remove();
    }
    const style = document.createElement('style');
    style.innerHTML = `
      @font-face {
        font-family: '${uniqueFamily}';
        src: url('${url}') format('truetype');
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
  };

  const generateFont = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || prompt;
    if (!activePrompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedFontUrl(null);
    setRawGlyphs([]);

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
        throw new Error("API key is missing. If you are the owner, please ensure GEMINI_API_KEY is set in your GitHub repository secrets.");
      }

      const cacheKey = `fontez_cache_${activePrompt.toLowerCase().trim()}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const glyphData = JSON.parse(cachedData);
        setRawGlyphs(glyphData);
        const newFontName = `Fontez-${activePrompt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'Custom'}`;
        setFontName(newFontName);
        applyFont(glyphData, newFontName);
        setIsGenerating(false);
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `You are a world-class typographer and master SVG vector artist. The user wants a custom font with this exact style/theme: '${activePrompt}'.

Generate the precise SVG path commands for the uppercase letters A-Z, lowercase letters a-z, numbers 0-9, and common punctuation (!, ?, ., ,).

### COORDINATE SYSTEM & METRICS
- Origin (0,0) is at the bottom-left of the baseline. The Y-axis goes UP.
- Baseline is at y=0. Cap height is at y=800.
- Advance width should vary by character (e.g., 'I' is narrow ~300, 'W' is wide ~900, standard is ~600).

### TYPOGRAPHY & STYLE RULES
1. HEAVILY incorporate the requested style ('${activePrompt}') into the geometry.
2. Maintain consistent stroke thickness (stem width) across all characters unless the style dictates otherwise.
3. Ensure all characters share the same visual DNA (serifs, curves, angles, contrast).
4. Do NOT just output generic sans-serif letters. The font MUST visually reflect the prompt.

### CRITICAL SVG PATH RULES (WINDING & COUNTERS)
- Fonts are FILLED shapes. You must draw the OUTLINE of the letter.
- Characters with holes (A, B, D, O, P, Q, R, a, b, d, e, g, o, p, q, 0, 4, 6, 8, 9, ?, !) MUST have "counters" (inner paths) to punch out the hole.
- To create a hole, draw the outer path in one direction (e.g., clockwise), then start a new subpath with 'M' and draw the inner path in the OPPOSITE direction (e.g., counter-clockwise).
- Example of an 'O' with a hole: "M 100 0 C 100 800 500 800 500 0 Z M 200 100 C 400 100 400 700 200 700 Z" (Outer path, then inner path).
- Ensure all paths form closed loops (end with Z).
- Use absolute commands (M, L, C, Q, Z).
- Keep paths efficient but detailed enough for the style (up to 25 commands per character for complex styles).

Return an array of objects, one for each character (A-Z, a-z, 0-9, !, ?, ., ,).
Each object must have:
- character: The letter, number, or symbol (e.g., 'A', 'a', '3', '!').
- advanceWidth: The width of the character (e.g., 600).
- path: A single string containing SVG-like path commands (M, L, Q, C, Z) with absolute coordinates. Example: "M 0 0 L 300 800 L 600 0 Z".`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: "An array of glyph definitions for the uppercase letters A-Z, lowercase letters a-z, numbers 0-9, and punctuation (!, ?, ., ,).",
            items: {
              type: Type.OBJECT,
              properties: {
                character: { type: Type.STRING, description: "The character this glyph represents (e.g., 'A')." },
                advanceWidth: { type: Type.NUMBER, description: "The width of the character." },
                path: { type: Type.STRING, description: "SVG-like path string (e.g., 'M 0 0 L 300 800 L 600 0 Z')." }
              },
              required: ["character", "advanceWidth", "path"]
            }
          }
        }
      });

      const jsonStr = response.text?.trim();
      if (!jsonStr) throw new Error("Failed to generate font data.");
      
      const glyphData = JSON.parse(jsonStr);
      
      try {
        localStorage.setItem(cacheKey, JSON.stringify(glyphData));
      } catch (e) {
        console.warn('Failed to cache font data', e);
      }

      setRawGlyphs(glyphData);
      
      const newFontName = `Fontez-${activePrompt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'Custom'}`;
      setFontName(newFontName);
      
      applyFont(glyphData, newFontName);

    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || "An error occurred while generating the font.";
      
      // Handle common network/adblocker errors
      if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
        errorMessage = "Network error: The connection timed out or was blocked. If you are using an ad blocker (like uBlock Origin or Brave Shields), try disabling it for this site. The Gemini API might be blocked on your network.";
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSurpriseMe = () => {
    const concepts = [
      "An alien hieroglyphic script that evolved in a zero-gravity environment",
      "A hyper-futuristic font made entirely of asymmetrical geometric shards",
      "An organic, bio-luminescent typography that looks like growing vines and roots",
      "A 4th-dimensional typographic style with impossible overlapping optical illusions",
      "An ancient, undiscovered civilization's runic alphabet with floating disconnected strokes",
      "A completely novel, never-before-seen experimental font breaking all traditional typography rules"
    ];
    const randomConcept = concepts[Math.floor(Math.random() * concepts.length)];
    setPrompt(randomConcept);
    generateFont(randomConcept);
  };

  const saveCurrentFont = () => {
    if (!rawGlyphs.length) return;
    const newSavedFont: SavedFont = {
      id: Date.now().toString(),
      name: fontName,
      prompt: prompt,
      timestamp: Date.now(),
      glyphData: rawGlyphs
    };
    const updated = [newSavedFont, ...savedFonts];
    setSavedFonts(updated);
    localStorage.setItem('fontez_saved_fonts', JSON.stringify(updated));
  };

  const loadSavedFont = (font: SavedFont) => {
    setPrompt(font.prompt);
    setFontName(font.name);
    setRawGlyphs(font.glyphData);
    applyFont(font.glyphData, font.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSavedFont = (id: string) => {
    const updated = savedFonts.filter(f => f.id !== id);
    setSavedFonts(updated);
    localStorage.setItem('fontez_saved_fonts', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href={import.meta.env.BASE_URL} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Fontez Logo" className="w-9 h-9 rounded-xl shadow-lg shadow-emerald-500/20" />
            <span className="text-xl font-bold tracking-tight">Fontez</span>
          </a>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            {/* Removed GitHub link */}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-2xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Generate custom fonts with <span className="bg-gradient-to-r from-emerald-500 via-emerald-200 to-emerald-500 bg-[length:200%_auto] animate-shine bg-clip-text text-transparent">AI</span>
          </h1>
          <p className="text-lg text-zinc-400">
            Describe the font you want, and our AI will generate a downloadable TrueType font (.ttf) for you to use anywhere.
          </p>
          
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A futuristic cyberpunk font with sharp edges"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && generateFont()}
            />
            <button
              onClick={() => generateFont()}
              disabled={isGenerating || !prompt.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>
            <button
              onClick={handleSurpriseMe}
              disabled={isGenerating}
              title="Invent a never-before-seen font"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-sm text-zinc-500 mr-2">Styles:</span>
            {['Cyberpunk', 'Vintage Serif', 'Bubblegum', 'Gothic', 'Minimalist Sans', 'Sci-Fi', 'Art Deco'].map((style) => (
              <button
                key={style}
                onClick={() => setPrompt(style)}
                className="text-xs px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {style}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </section>

        {/* Preview Section */}
        {generatedFontUrl && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Preview</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveCurrentFont}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Bookmark className="w-4 h-4" />
                  Save Font
                </button>
                <a
                  href={generatedFontUrl}
                  download={`${fontName}.ttf`}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download .ttf
                </a>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-zinc-950/50 p-3 rounded-xl mb-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <ZoomOut className="w-4 h-4 text-zinc-500" />
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="0.5"
                    value={previewZoom} 
                    onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
                    className="flex-1 sm:w-32 accent-emerald-500"
                  />
                  <ZoomIn className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400 w-8">{previewZoom}x</span>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                  <Palette className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  {textEffects.map(effect => (
                    <button
                      key={effect.id}
                      onClick={() => setTextEffect(effect.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        textEffect === effect.id 
                          ? 'bg-zinc-800 text-zinc-100' 
                          : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      {effect.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
                <div className="flex items-center gap-4">
                  <span>Try typing below (A-Z, a-z, 0-9)</span>
                  <button
                    onClick={() => setPreviewText('The Quick Brown Fox Jumps Over The Lazy Dog. 0123456789 !?,')}
                    className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
                    title="Reset text"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
                <span>{fontName}</span>
              </div>
              <textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                className={`w-full bg-transparent border-none resize-none focus:outline-none caret-zinc-100 ${textEffects.find(e => e.id === textEffect)?.className || 'text-zinc-100'}`}
                style={{
                  fontFamily: `'${uniqueFontFamily}', sans-serif`,
                  fontSize: `${previewZoom}rem`,
                  lineHeight: '1.2',
                  minHeight: '200px'
                }}
              />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-zinc-300">Raw Glyphs</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {rawGlyphs.map((glyph, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center">
                    <svg viewBox="0 0 1000 1000" className="w-full h-auto fill-zinc-100">
                      <g transform="scale(1, -1) translate(0, -800)">
                        <path d={glyph.path} />
                      </g>
                    </svg>
                    <div className="text-xs text-zinc-500 mt-2 font-mono">{glyph.character}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Empty State / Instructions */}
        {!generatedFontUrl && !isGenerating && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center opacity-60">
            <div className="space-y-3 p-6">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl">1</span>
              </div>
              <h3 className="font-medium">Describe</h3>
              <p className="text-sm text-zinc-400">Enter a prompt describing the style, mood, or shape of the font you want.</p>
            </div>
            <div className="space-y-3 p-6">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl">2</span>
              </div>
              <h3 className="font-medium">Generate</h3>
              <p className="text-sm text-zinc-400">Our AI crafts unique SVG paths for each letter and compiles them into a font.</p>
            </div>
            <div className="space-y-3 p-6">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl">3</span>
              </div>
              <h3 className="font-medium">Download</h3>
              <p className="text-sm text-zinc-400">Test your font in the browser and download the .ttf file for your projects.</p>
            </div>
          </section>
        )}

        {/* Saved Fonts Section */}
        {savedFonts.length > 0 && (
          <section className="space-y-6 border-t border-zinc-800/50 pt-12">
            <h2 className="text-2xl font-semibold tracking-tight">Saved Fonts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedFonts.map(font => (
                <div key={font.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-zinc-100 truncate pr-2">{font.name}</h3>
                    <button onClick={() => deleteSavedFont(font.id)} className="text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2 flex-1">{font.prompt}</p>
                  <div className="flex justify-between items-center mt-2 pt-3 border-t border-zinc-800/50">
                    <span className="text-xs text-zinc-600">{new Date(font.timestamp).toLocaleDateString()}</span>
                    <button
                      onClick={() => loadSavedFont(font)}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                    >
                      Load Font
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Loading Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            <Fan className="w-20 h-20 text-emerald-500 animate-spin" />
            <h2 className="mt-6 text-3xl font-bold text-emerald-500 tracking-widest uppercase animate-pulse">Loading</h2>
            <div className="flex flex-col items-center justify-center gap-2 mt-4 max-w-md text-center">
              <p className="text-emerald-400 font-medium text-sm">
                {loadingStep === 0 && "Analyzing typographic style and geometry..."}
                {loadingStep === 1 && "Generating precise SVG paths for 66 characters..."}
                {loadingStep === 2 && "Punching out counters and applying winding rules..."}
                {loadingStep >= 3 && "Compiling TrueType font file... almost done!"}
              </p>
              <p className="text-emerald-500/60 text-xs mt-2">This process usually takes 5-10 seconds.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
