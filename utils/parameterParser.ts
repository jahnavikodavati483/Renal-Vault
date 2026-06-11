import { KidneyParameters } from '../types';

// Extract value from table rows: "TEST NAME | VALUE | UNIT | REFERENCE"
function extractFromTableRow(text: string, testName: string): number | undefined {
  const escaped = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: TestName followed by any separator (|, tab, spaces) then value
  const re = new RegExp(
    escaped + '[\\s\\|\\t]{1,10}([0-9]+\\.?[0-9]*)',
    'i'
  );
  const m = text.match(re);
  if (m && m[1]) {
    const val = parseFloat(m[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return undefined;
}

// Searches for a label and grabs the first decimal number within 120 chars after it.
// Handles flags (L / H / N / A), colons, pipes, and multiple spaces.
function extractAfterLabel(text: string, ...labels: string[]): number | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Multiple patterns to catch different formats:
    // Pattern 1: Label followed by value (with colons, pipes, flags)
    const patterns = [
      new RegExp(escaped + '[\\s\\|:\\-]{1,5}(?:[LHNA]\\s+)?([0-9]+\\.?[0-9]*)', 'i'),
      new RegExp(escaped + '[\\s\\S]{0,120}?(?:[LHNA]\\s+)?([0-9]+\\.?[0-9]*)', 'i'),
      new RegExp(escaped + '.*?([0-9]+(?:\\.[0-9]{1,3})?)', 'i'),
    ];

    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 0) return val;
      }
    }
  }
  return undefined;
}

function extractString(text: string, ...patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export function parseKidneyParameters(rawText: string): KidneyParameters {
  // Normalise: uppercase, collapse whitespace
  const t = rawText
    .toUpperCase()
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ');

  console.log(`[Parser] 📋 Input text length: ${t.length} chars`);
  
  if (t.length > 0 && t.length < 1500) {
    console.log('[Parser] 🔍 Full text:', t);
  } else if (t.length > 0) {
    console.log('[Parser] 🔍 First 800 chars:', t.substring(0, 800));
  }
  
  const params: KidneyParameters = {};

  // Helper: Try label extraction, then table extraction
  const tryExtract = (labels: string[], tableNames: string[]): number | undefined => {
    let val = extractAfterLabel(t, ...labels);
    if (val !== undefined) return val;
    for (const name of tableNames) {
      val = extractFromTableRow(t, name);
      if (val !== undefined) return val;
    }
    return undefined;
  };

  // ── BUN / Blood Urea Nitrogen ──────────────────────────────────────────────
  const bun = tryExtract(
    ['BLOOD UREA NITROGEN', 'UREA NITROGEN', 'B.U.N', 'B.U.N.', 'BUN', 'BUN.*CREATININE RATIO'],
    ['BLOOD UREA', 'BLOOD UREA NITROGEN']
  );
  if (bun !== undefined) params.bun = bun;

  // ── Serum Urea ────────────────────────────────────────────────────────────
  const urea = tryExtract(
    ['SERUM UREA', 'BLOOD UREA', 'SR. UREA', 'SR UREA', 'UREA'],
    ['SERUM UREA']
  );
  if (urea !== undefined && urea !== bun) params.urea = urea;

  // ── Serum Creatinine ──────────────────────────────────────────────────────
  const creatinine = tryExtract(
    ['SERUM CREATININE', 'S. CREATININE', 'S.CREATININE', 'SR. CREATININE', 'SR.CREATININE', 'CREATININE SERUM', 'CREAT.', 'CREATININE'],
    ['SERUM CREATININE', 'S. CREATININE']
  );
  if (creatinine !== undefined) params.creatinine = creatinine;

  // ── eGFR ──────────────────────────────────────────────────────────────────
  const egfrRe = /(?:ESTIMATED\s+GFR|CALC(?:ULATED)?\.?\s*GFR|E-?GFR|E\.?GFR|GLOMERULAR\s+FILTRATION\s+RATE|EGFR\s*\(CKD)[\s\S]{0,120}?(?:[LHNA]\s+)?([0-9]+\.?[0-9]*)/i;
  const egfrMatch = t.match(egfrRe);
  if (egfrMatch) {
    const v = parseFloat(egfrMatch[1]);
    if (!isNaN(v) && v > 0 && v < 200) params.egfr = v;
  } else {
    const tableEgfr = extractFromTableRow(t, 'EGFR');
    if (tableEgfr !== undefined && tableEgfr > 0 && tableEgfr < 200) params.egfr = tableEgfr;
  }

  // ── eGFR Category (G1–G5) ─────────────────────────────────────────────────
  const catMatch = t.match(/EGFR\s+CATEGOR[YI][^G\n]{0,20}(G\d[AB]?)/i);
  if (catMatch) params.ckdCategory = catMatch[1];

  // ── Calcium ───────────────────────────────────────────────────────────────
  const calcium = tryExtract(
    ['SERUM CALCIUM', 'S. CALCIUM', 'SR. CALCIUM', 'CALCIUM SERUM', 'CALCIUM (TOTAL)', 'CALCIUM'],
    ['SERUM CALCIUM', 'CALCIUM']
  );
  if (calcium !== undefined) params.calcium = calcium;

  // ── Potassium ─────────────────────────────────────────────────────────────
  const potassium = tryExtract(
    ['SERUM POTASSIUM', 'S. POTASSIUM', 'SR. POTASSIUM', 'POTASSIUM SERUM', 'POTASSIUM (K)', 'POTASSIUM'],
    ['SERUM POTASSIUM', 'POTASSIUM']
  );
  if (potassium !== undefined) params.potassium = potassium;

  // ── Chloride ───────────────────────────────────────────────────────────────
  const chloride = tryExtract(
    ['SERUM CHLORIDE', 'S. CHLORIDE', 'SR. CHLORIDE', 'CHLORIDE SERUM', 'CHLORIDE (CL)', 'CHLORIDE', 'SERUM CL'],
    ['SERUM CHLORIDE', 'CHLORIDE']
  );
  if (chloride !== undefined) params.chloride = chloride;

  // ── Sodium ────────────────────────────────────────────────────────────────
  const sodium = tryExtract(
    ['SERUM SODIUM', 'S. SODIUM', 'SR. SODIUM', 'SODIUM SERUM', 'SODIUM (NA)', 'SODIUM'],
    ['SERUM SODIUM', 'SODIUM']
  );
  if (sodium !== undefined) params.sodium = sodium;

  // ── Uric Acid ─────────────────────────────────────────────────────────────
  const uricAcid = tryExtract(
    ['SERUM URIC ACID', 'S. URIC ACID', 'SR. URIC ACID', 'URIC ACID SERUM', 'URIC ACID'],
    ['SERUM URIC ACID', 'URIC ACID']
  );
  if (uricAcid !== undefined) params.uricAcid = uricAcid;

  // ── Phosphorus / Phosphate ────────────────────────────────────────────────
  const phosphorus = tryExtract(
    ['SERUM PHOSPHORUS', 'SERUM PHOSPHATE', 'S. PHOSPHORUS', 'INORGANIC PHOSPHORUS', 'PHOSPHORUS', 'PHOSPHATE', 'PO4'],
    ['SERUM PHOSPHORUS', 'PHOSPHORUS', 'SERUM PHOSPHATE']
  );
  if (phosphorus !== undefined) params.phosphorus = phosphorus;

  // ── Albumin ───────────────────────────────────────────────────────────────
  const albumin = tryExtract(
    ['SERUM ALBUMIN', 'S. ALBUMIN', 'SR. ALBUMIN', 'ALBUMIN SERUM', 'ALBUMIN'],
    ['SERUM ALBUMIN', 'ALBUMIN']
  );
  if (albumin !== undefined) params.albumin = albumin;

  // ── Hemoglobin ────────────────────────────────────────────────────────────
  const hemoglobin = tryExtract(
    ['HEMOGLOBIN', 'HAEMOGLOBIN', 'HGB', 'HB'],
    ['HEMOGLOBIN']
  );
  if (hemoglobin !== undefined) params.hemoglobin = hemoglobin;

  // ── Bicarbonate / CO2 ─────────────────────────────────────────────────────
  const bicarb = tryExtract(
    ['BICARBONATE', 'SERUM BICARBONATE', 'HCO3', 'SERUM CO2', 'CARBON DIOXIDE', 'CO2'],
    ['BICARBONATE', 'HCO3']
  );
  if (bicarb !== undefined) params.bicarbonate = bicarb;

  // ── Protein in Urine ──────────────────────────────────────────────────────
  const proteinMatch = t.match(
    /(?:URINE PROTEIN|PROTEIN.*URINE|PROTEINURIA)[^A-Z\n]{0,30}?(NEGATIVE|NIL|TRACE|1\+|2\+|3\+|4\+|\+)/i,
  );
  if (proteinMatch) params.proteinInUrine = proteinMatch[1];

  const detected = Object.keys(params).length;
  const detectedList = Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  
  console.log(`[Parser] ✓ Detected ${detected} parameters: ${detectedList || '(none)'}`);

  return params;
}

export function hasMinimumData(p: KidneyParameters): boolean {
  return [p.creatinine, p.egfr, p.bun, p.urea, p.potassium, p.sodium, p.chloride].some(v => v !== undefined);
}

export function countDetected(p: KidneyParameters): number {
  return Object.values(p).filter(v => v !== undefined).length;
}
