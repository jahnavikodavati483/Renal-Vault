import { KidneyParameters, AnalysisResult, CKDStage, RiskLevel, UserProfile } from '../types';

// 2021 CKD-EPI equation (race-free version)
export function calculateEGFR(creatinine: number, age: number, sex: 'male' | 'female'): number {
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const femaleMultiplier = sex === 'female' ? 1.012 : 1;

  const ratio = creatinine / kappa;
  const minPart = Math.pow(Math.min(ratio, 1), alpha);
  const maxPart = Math.pow(Math.max(ratio, 1), -1.2);
  const agePart = Math.pow(0.9938, age);

  return 142 * minPart * maxPart * agePart * femaleMultiplier;
}

export function getCKDStage(egfr: number): CKDStage {
  if (egfr >= 90) return 1;
  if (egfr >= 60) return 2;
  if (egfr >= 45) return 3;
  if (egfr >= 15) return 4;
  return 5;
}

export function getStageName(stage: CKDStage): string {
  const names: Record<CKDStage, string> = {
    1: 'Stage 1 — Normal or High',
    2: 'Stage 2 — Mildly Decreased',
    3: 'Stage 3 — Moderately Decreased',
    4: 'Stage 4 — Severely Decreased',
    5: 'Stage 5 — Kidney Failure',
  };
  return names[stage];
}

interface NormalRange {
  min: number;
  max: number;
  maleMod?: { min: number; max: number };
  femaleMod?: { min: number; max: number };
}

const NORMAL_RANGES: Partial<Record<keyof KidneyParameters, NormalRange>> = {
  creatinine: { min: 0.6, max: 1.35, maleMod: { min: 0.74, max: 1.35 }, femaleMod: { min: 0.59, max: 1.04 } },
  egfr: { min: 60, max: 999 },
  bun: { min: 7, max: 20 },
  urea: { min: 13, max: 43 },
  sodium: { min: 136, max: 145 },
  potassium: { min: 3.5, max: 5.1 },
  phosphorus: { min: 2.5, max: 4.5 },
  albumin: { min: 3.5, max: 5.0 },
  hemoglobin: { min: 12.0, max: 17.5, maleMod: { min: 13.5, max: 17.5 }, femaleMod: { min: 12.0, max: 16.0 } },
  calcium: { min: 8.5, max: 10.5 },
  bicarbonate: { min: 22, max: 29 },
};

function isAbnormal(
  key: keyof KidneyParameters,
  value: number,
  sex: 'male' | 'female',
): 'high' | 'low' | 'normal' {
  const range = NORMAL_RANGES[key];
  if (!range) return 'normal';
  const r = sex === 'male' && range.maleMod
    ? range.maleMod
    : sex === 'female' && range.femaleMod
      ? range.femaleMod
      : range;
  if (value < r.min) return 'low';
  if (value > r.max) return 'high';
  return 'normal';
}

export function analyzeCKD(
  params: KidneyParameters,
  profile: Pick<UserProfile, 'age' | 'sex'>,
): AnalysisResult {
  const notes: string[] = [];
  const recommendations: string[] = [];
  const abnormalParams: string[] = [];

  // Determine eGFR
  let effectiveEgfr: number | undefined = params.egfr;
  let estimatedEgfr: number | undefined;

  if (!effectiveEgfr && params.creatinine) {
    estimatedEgfr = calculateEGFR(params.creatinine, profile.age, profile.sex);
    effectiveEgfr = estimatedEgfr;
  }

  // CKD Stage
  const ckdStage: CKDStage | null = effectiveEgfr !== undefined ? getCKDStage(effectiveEgfr) : null;

  // Evaluate each parameter
  const numericParams: Array<{ key: keyof KidneyParameters; label: string }> = [
    { key: 'creatinine', label: 'Creatinine' },
    { key: 'egfr', label: 'eGFR' },
    { key: 'bun', label: 'BUN' },
    { key: 'urea', label: 'Urea' },
    { key: 'sodium', label: 'Sodium' },
    { key: 'potassium', label: 'Potassium' },
    { key: 'phosphorus', label: 'Phosphorus' },
    { key: 'albumin', label: 'Albumin' },
    { key: 'hemoglobin', label: 'Hemoglobin' },
    { key: 'calcium', label: 'Calcium' },
    { key: 'bicarbonate', label: 'Bicarbonate' },
  ];

  for (const { key, label } of numericParams) {
    const value = params[key] as number | undefined;
    if (value === undefined) continue;
    const status = isAbnormal(key, value, profile.sex);
    if (status !== 'normal') {
      abnormalParams.push(label);
    }
  }

  // Proteinuria check
  if (params.proteinInUrine && params.proteinInUrine !== 'NEGATIVE') {
    abnormalParams.push('Protein in Urine');
    notes.push('Proteinuria detected — an important marker of kidney damage.');
    recommendations.push('Consult a nephrologist about proteinuria management.');
  }

  // CKD-specific notes
  if (ckdStage) {
    if (ckdStage === 1) {
      notes.push('eGFR is normal or elevated. Monitor annually if risk factors are present.');
    } else if (ckdStage === 2) {
      notes.push('Mildly decreased kidney function. Lifestyle changes can slow progression.');
      recommendations.push('Maintain blood pressure below 130/80 mmHg.');
      recommendations.push('Reduce sodium intake and stay well hydrated.');
    } else if (ckdStage === 3) {
      notes.push('Moderately decreased kidney function (CKD Stage 3). Regular monitoring required.');
      recommendations.push('Schedule nephrologist consultation within 1 month.');
      recommendations.push('Limit protein intake as advised by your doctor.');
      recommendations.push('Monitor blood pressure closely.');
    } else if (ckdStage === 4) {
      notes.push('Severely decreased kidney function (CKD Stage 4). Prepare for possible renal replacement therapy.');
      recommendations.push('Urgent nephrologist consultation required.');
      recommendations.push('Discuss dialysis planning with your healthcare team.');
      recommendations.push('Strict dietary restrictions on potassium and phosphorus.');
    } else {
      notes.push('Kidney failure (CKD Stage 5). Immediate medical attention required.');
      recommendations.push('Emergency nephrology evaluation needed immediately.');
      recommendations.push('Dialysis or transplant evaluation should begin now.');
    }
  }

  // Potassium warnings
  if (params.potassium !== undefined) {
    if (params.potassium > 5.5) {
      notes.push('Hyperkalemia detected — high potassium can cause dangerous heart rhythm issues.');
      recommendations.push('Seek immediate medical attention for high potassium levels.');
    } else if (params.potassium < 3.0) {
      notes.push('Hypokalemia detected — low potassium levels need evaluation.');
    }
  }

  // Anemia (CKD-related)
  if (params.hemoglobin !== undefined) {
    const low = profile.sex === 'male' ? 13.5 : 12.0;
    if (params.hemoglobin < low) {
      notes.push('Low hemoglobin may indicate CKD-related anemia.');
      recommendations.push('Discuss anemia management (erythropoietin, iron supplementation) with your doctor.');
    }
  }

  // Compute risk score (0–100)
  const riskScore = computeRiskScore(ckdStage, abnormalParams.length, params);

  const riskLevel = getRiskLevel(riskScore);

  if (recommendations.length === 0) {
    recommendations.push('Continue regular monitoring every 6–12 months.');
    recommendations.push('Maintain a kidney-friendly diet and healthy lifestyle.');
  }

  return {
    ckdStage,
    riskLevel,
    riskScore,
    estimatedEgfr,
    notes,
    recommendations,
    abnormalParams,
  };
}

function computeRiskScore(
  stage: CKDStage | null,
  abnormalCount: number,
  params: KidneyParameters,
): number {
  let score = 0;

  if (stage === 1) score += 10;
  else if (stage === 2) score += 25;
  else if (stage === 3) score += 50;
  else if (stage === 4) score += 75;
  else if (stage === 5) score += 95;

  score += Math.min(abnormalCount * 5, 30);

  if (params.potassium && params.potassium > 5.5) score += 10;
  if (params.proteinInUrine && params.proteinInUrine !== 'NEGATIVE') score += 10;

  return Math.min(Math.round(score), 100);
}

function getRiskLevel(score: number): RiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'high';
  return 'critical';
}

export function getParameterStatus(
  key: keyof KidneyParameters,
  value: number,
  sex: 'male' | 'female',
): 'normal' | 'low' | 'high' {
  return isAbnormal(key, value, sex);
}

export function getParameterRange(
  key: keyof KidneyParameters,
  sex: 'male' | 'female',
): { min: number; max: number } | null {
  const range = NORMAL_RANGES[key];
  if (!range) return null;
  return sex === 'male' && range.maleMod
    ? range.maleMod
    : sex === 'female' && range.femaleMod
      ? range.femaleMod
      : { min: range.min, max: range.max };
}

export const PARAMETER_META: Partial<Record<keyof KidneyParameters, { label: string; unit: string; description: string }>> = {
  creatinine: { label: 'Creatinine', unit: 'mg/dL', description: 'Waste product filtered by kidneys' },
  egfr: { label: 'eGFR', unit: 'mL/min/1.73m²', description: 'Kidney filtration rate' },
  bun: { label: 'BUN', unit: 'mg/dL', description: 'Blood Urea Nitrogen — kidney waste marker' },
  urea: { label: 'Urea', unit: 'mg/dL', description: 'Waste product from protein metabolism' },
  sodium: { label: 'Sodium', unit: 'mEq/L', description: 'Electrolyte balance' },
  potassium: { label: 'Potassium', unit: 'mEq/L', description: 'Electrolyte critical for heart function' },
  phosphorus: { label: 'Phosphorus', unit: 'mg/dL', description: 'Mineral regulated by kidneys' },
  albumin: { label: 'Albumin', unit: 'g/dL', description: 'Main blood protein; low levels indicate kidney loss' },
  hemoglobin: { label: 'Hemoglobin', unit: 'g/dL', description: 'Oxygen-carrying protein; low = CKD anemia' },
  calcium: { label: 'Calcium', unit: 'mg/dL', description: 'Bone mineral regulated by kidneys' },
  bicarbonate: { label: 'Bicarbonate', unit: 'mEq/L', description: 'Acid-base balance indicator' },
};
