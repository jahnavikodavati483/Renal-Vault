import { KidneyParameters } from '../types';

const EXTRACT_PROMPT = `You are analyzing a kidney / renal function test (KFT / RFT / CMP / metabolic panel) lab report.
Extract every numeric lab value present and return ONLY valid JSON — no markdown, no extra text:
{
  "creatinine":  <number|null>,
  "egfr":        <number|null>,
  "bun":         <number|null>,
  "urea":        <number|null>,
  "sodium":      <number|null>,
  "potassium":   <number|null>,
  "chloride":    <number|null>,
  "calcium":     <number|null>,
  "phosphorus":  <number|null>,
  "uricAcid":    <number|null>,
  "albumin":     <number|null>,
  "hemoglobin":  <number|null>,
  "bicarbonate": <number|null>
}
Rules:
- Use null for any parameter NOT visible in the report.
- Return numeric values only (strip units).
- For eGFR use the reported/calculated numeric value, not the reference range.
- BUN = Blood Urea Nitrogen (not the same as Urea).
- Extract ALL visible kidney function test values from the report.`;

// ── Resize base64 image on web to avoid exceeding input limits ────────
async function resizeBase64IfNeeded(base64: string, mimeType: string): Promise<string> {
  // Only resize if running in a browser context and the image is large
  if (typeof document === 'undefined' || base64.length < 400_000) return base64;
  return new Promise((resolve) => {
    const img = new (window as any).Image();
    img.onload = () => {
      const MAX = 1400;
      const scale = Math.min(1, MAX / Math.max(img.width || MAX, img.height || MAX));
      const w = Math.round((img.width  || MAX) * scale);
      const h = Math.round((img.height || MAX) * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1] ?? base64);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

function parseJsonFromResponse(content: string): any {
  if (!content) return null;
  
  // Try direct parsing first
  try {
    return JSON.parse(content.trim());
  } catch (_) {}

  // Strip markdown formatting if present
  let cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Find the first '{' and last '}'
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonCandidate = content.substring(start, end + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {
      console.warn('[Vision] Regex-extracted JSON parsing failed:', e);
    }
  }

  return null;
}

// ── Vision extraction via Claude/Groq Proxy ────────────────────────────
export async function extractParamsWithVision(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<{ params: KidneyParameters | null; error?: string }> {
  const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY ?? process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? '';

  if (!GROK_API_KEY) {
    const errMsg = 'No valid Grok/Groq API key found. Please check your configuration.';
    console.error(`[Vision] ❌ ${errMsg}`);
    return { params: null, error: errMsg };
  }

  console.log('[Vision] Routing request exclusively through Vercel proxy using Groq/Grok key...');
  try {
    const safeBase64 = await resizeBase64IfNeeded(base64, mimeType);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const apiUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/api/extractVision'
      : '/api/extractVision';

    const res = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64: safeBase64,
        prompt: EXTRACT_PROMPT,
      }),
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content = data.content?.[0]?.text ?? '';
      const raw = parseJsonFromResponse(content);
      if (raw) {
        const params: KidneyParameters = {};
        const KEYS: Array<keyof KidneyParameters> = [
          'creatinine', 'egfr', 'bun', 'urea', 'sodium',
          'potassium', 'chloride', 'calcium', 'phosphorus', 'uricAcid',
          'albumin', 'hemoglobin', 'bicarbonate',
        ];

        const normalizedRaw: Record<string, any> = {};
        for (const rawKey of Object.keys(raw)) {
          normalizedRaw[rawKey.toLowerCase()] = raw[rawKey];
        }

        for (const k of KEYS) {
          const v = normalizedRaw[k.toLowerCase()];
          if (v !== undefined && v !== null) {
            const numVal = typeof v === 'number' ? v : parseFloat(String(v));
            if (typeof numVal === 'number' && isFinite(numVal) && numVal > 0) {
              (params as any)[k] = numVal;
            }
          }
        }

        const found = Object.keys(params).length;
        console.log(`[Vision] ✓ Extracted ${found} parameter(s):`, params);
        if (found > 0) {
          return { params };
        }
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.error('[Vision] Proxy failed:', errText);
      return { params: null, error: `API Error: ${errText || `HTTP ${res.status}`}` };
    }
  } catch (e: any) {
    console.error('[Vision] Proxy connection failed:', e);
    return { params: null, error: `Connection Error: ${e.message || String(e)}` };
  }

  return { params: null, error: 'Extraction failed. No parameters could be detected from the image.' };
}

// ── URI → Base64 ──────────────────────────────────────────────────────────────
export async function uriToBase64(uri: string): Promise<string> {
  if (!uri) return '';

  // Already a data URI
  if (uri.startsWith('data:')) return uri.split(',')[1] ?? '';

  // Blob or HTTP URI (web environment)
  if (
    uri.startsWith('blob:') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    try {
      const blob = await (await fetch(uri)).blob();
      return blobToBase64(blob);
    } catch {
      return '';
    }
  }

  // Native file URI — use expo-file-system
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FS = require('expo-file-system');
    return (await FS.readAsStringAsync(uri, {
      encoding: FS.EncodingType.Base64,
    })) ?? '';
  } catch {
    return '';
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    if (typeof FileReader === 'undefined') { resolve(''); return; }
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve(((reader.result as string) ?? '').split(',')[1] ?? '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}
