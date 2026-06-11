export type Sex = 'male' | 'female';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type CKDStage = 1 | 2 | 3 | 4 | 5;
export type UrgencyLevel = 'routine' | 'soon' | 'urgent' | 'emergency';
export type ParamStatus = 'normal' | 'low' | 'high';

export interface KidneyParameters {
  creatinine?: number;       // mg/dL
  egfr?: number;             // mL/min/1.73m²
  bun?: number;              // mg/dL
  urea?: number;             // mg/dL
  sodium?: number;           // mEq/L or mmol/L
  potassium?: number;        // mEq/L or mmol/L
  chloride?: number;         // mEq/L or mmol/L
  phosphorus?: number;       // mg/dL
  albumin?: number;          // g/dL
  hemoglobin?: number;       // g/dL
  proteinInUrine?: string;   // Negative / Trace / 1+ / 2+ / 3+
  calcium?: number;          // mg/dL
  bicarbonate?: number;      // mEq/L
  uricAcid?: number;         // mg/dL
  ckdCategory?: string;      // G1 / G2 / G3a / G3b / G4 / G5
}

export interface AIRecommendationResult {
  summary: string;
  recommendations: string[];
  dietaryAdvice: string[];
  lifestyle: string[];
  urgency: UrgencyLevel;
  urgencyMessage: string;
  followUp: string;
}

export interface AnalysisResult {
  ckdStage: CKDStage | null;
  riskLevel: RiskLevel;
  riskScore: number;
  estimatedEgfr?: number;
  notes: string[];
  recommendations: string[];
  abnormalParams: string[];
  aiInsights?: AIRecommendationResult;
}

export interface Report {
  id?: string;
  userId: string;
  date: string;
  imageUrl?: string;
  rawText?: string;
  parameters: KidneyParameters;
  analysis: AnalysisResult;
  isDuplicate?: boolean;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  age: number;
  sex: Sex;
  createdAt: string;
  nextCheckupDate?: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}
