import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// ─── Load pdf.js from CDN at runtime (web only, not bundled) ──────────────────
// Avoids Babel/Metro compatibility issues with modern pdfjs-dist syntax.
async function loadPDFJS(): Promise<any | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib ?? null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

// ─── Web: CDN pdf.js → proper text extraction ─────────────────────────────────
async function extractPDFWeb(fileUri: string): Promise<string> {
  const pdfjsLib = await loadPDFJS();

  if (pdfjsLib) {
    try {
      let data: ArrayBuffer;
      if (fileUri.startsWith('blob:') || fileUri.startsWith('http')) {
        data = await (await fetch(fileUri)).arrayBuffer();
      } else {
        const b64 = fileUri.includes(',') ? fileUri.split(',')[1] : fileUri;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        data = bytes.buffer;
      }

      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const pages: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        pages.push(
          content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ')
        );
      }
      return pages.join('\n');
    } catch (e) {
      console.warn('[PDFExtractor] pdf.js failed, falling back to raw scan:', e);
    }
  }

  // Fallback: raw byte scan (works for uncompressed digital PDFs)
  return extractRaw(await (await fetch(fileUri)).arrayBuffer());
}

// ─── Native: read file bytes and scan raw PDF content streams ─────────────────
async function extractPDFNative(fileUri: string): Promise<string> {
  try {
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return extractRaw(bytes.buffer);
  } catch (e) {
    console.error('[PDFExtractor] native read error:', e);
    return '';
  }
}

// ─── Shared raw-bytes text extractor (uncompressed PDF streams) ───────────────
function extractRaw(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let raw = '';
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);

  const chunks: string[] = [];

  // Tj operator: (text) Tj
  const tjRe = /\(([^()\\]{1,300}(?:\\.[^()\\]*)*)\)\s*(?:Tj|'|")/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw)) !== null) {
    chunks.push(decodePDFString(m[1]));
  }

  // TJ operator: [(text)(text)] TJ
  const tjArrayRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = tjArrayRe.exec(raw)) !== null) {
    const parts = m[1].match(/\(([^()]*)\)/g) ?? [];
    chunks.push(parts.map(p => decodePDFString(p.slice(1, -1))).join(''));
  }

  return chunks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodePDFString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// ─── Image OCR (optional — requires EAS custom build) ─────────────────────────
export async function extractTextFromImage(imageUri: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TR = require('react-native-text-recognition');
    const lines: string[] = await TR.default.recognize(imageUri);
    return lines.join('\n');
  } catch {
    return '';
  }
}

// ─── Render first PDF page to a base64 JPEG (web only, for scanned PDFs) ─────
export async function renderPDFPageToBase64(fileUri: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return '';

  const pdfjsLib = await loadPDFJS();
  if (!pdfjsLib) return '';

  try {
    let data: ArrayBuffer;
    if (fileUri.startsWith('blob:') || fileUri.startsWith('http')) {
      data = await (await fetch(fileUri)).arrayBuffer();
    } else {
      const b64 = fileUri.includes(',') ? fileUri.split(',')[1] : fileUri;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      data = bytes.buffer;
    }

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl.split(',')[1] ?? '';
  } catch (e) {
    console.warn('[PDFExtractor] Canvas render failed:', e);
    return '';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function extractTextFromPDF(fileUri: string): Promise<string> {
  return Platform.OS === 'web' ? extractPDFWeb(fileUri) : extractPDFNative(fileUri);
}
