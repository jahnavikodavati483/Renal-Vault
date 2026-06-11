import { KidneyParameters, AnalysisResult, UserProfile, AIRecommendationResult, UrgencyLevel } from '../types';
import { PARAMETER_META, getStageName } from '../utils/ckdAnalysis';

const GROK_API_KEY  = process.env.EXPO_PUBLIC_GROK_API_KEY ?? '';
const GROK_BASE_URL = 'https://api.x.ai/v1';
const MODEL         = 'grok-3';        // verified model name
const TIMEOUT_MS    = 8000;            // 8 s — fail fast, local recs take over

// ─── Smart LOCAL recommendations (instant, always works) ──────────────────────
function generateLocalRecommendations(
  parameters: KidneyParameters,
  analysis: AnalysisResult,
  profile: Pick<UserProfile, 'age' | 'sex'>,
): AIRecommendationResult {
  const stage = analysis.ckdStage;
  const egfr  = parameters.egfr ?? analysis.estimatedEgfr;
  const recs: string[]    = [];
  const dietary: string[] = [];
  const lifestyle: string[] = [];
  let urgency: UrgencyLevel = 'routine';
  let urgencyMessage = 'Schedule a routine kidney health review annually.';
  let followUp = 'Every 12 months';

  // ── Stage-based guidance ─────────────────────────────────────────────────
  if (!stage || stage === 1) {
    urgency        = 'routine';
    urgencyMessage = 'Kidney function is in normal range. Annual monitoring recommended.';
    followUp       = 'Every 12 months';
    recs.push('Monitor kidney function annually with a routine blood test.');
    recs.push('Maintain blood pressure below 130/80 mmHg.');
  } else if (stage === 2) {
    urgency        = 'soon';
    urgencyMessage = 'Mildly reduced kidney function — see your doctor within 4 weeks.';
    followUp       = 'Every 6 months';
    recs.push('Schedule a kidney health review with your doctor within 4 weeks.');
    recs.push('Strict blood pressure control (target < 130/80 mmHg) is essential.');
    recs.push('Discuss ACE inhibitors or ARBs with your doctor to protect the kidneys.');
    recs.push('Avoid NSAIDs (ibuprofen, naproxen) — they reduce kidney blood flow.');
  } else if (stage === 3) {
    urgency        = 'soon';
    urgencyMessage = 'Moderately reduced kidney function — nephrologist consultation within 2 weeks.';
    followUp       = 'Every 3 months';
    recs.push('See a nephrologist within 2 weeks for a comprehensive evaluation.');
    recs.push('Review all medications for kidney-appropriate dosage adjustments.');
    recs.push('Monitor for CKD complications: anemia, bone disease, high blood pressure.');
    recs.push('Strictly control blood pressure, blood sugar, and cholesterol.');
  } else if (stage === 4) {
    urgency        = 'urgent';
    urgencyMessage = 'Severely reduced kidney function — urgent nephrology appointment within 1 week.';
    followUp       = 'Every 4–6 weeks';
    recs.push('URGENT: Book a nephrology appointment within this week.');
    recs.push('Begin planning for renal replacement therapy (dialysis or transplant).');
    recs.push('Strict restriction of fluids, potassium, phosphorus, and sodium.');
    recs.push('Daily blood pressure monitoring — target < 130/80 mmHg.');
    recs.push('Review all medicines — dosing must be adjusted for your kidney function.');
  } else if (stage === 5) {
    urgency        = 'emergency';
    urgencyMessage = 'Kidney failure stage — seek immediate medical/emergency evaluation.';
    followUp       = 'Immediate — weekly monitoring required';
    recs.push('EMERGENCY: Go to the hospital or call your nephrologist today.');
    recs.push('Dialysis or kidney transplant evaluation must begin immediately.');
    recs.push('Intensive fluid, electrolyte, and medication management is critical.');
  }

  // ── Potassium-specific ───────────────────────────────────────────────────
  if (parameters.potassium !== undefined) {
    if (parameters.potassium > 6.0) {
      urgency        = 'emergency';
      urgencyMessage = 'Critically high potassium — seek emergency care immediately.';
      recs.unshift(`CRITICAL: Potassium is ${parameters.potassium} mEq/L — this can cause life-threatening heart arrhythmias. Seek emergency care now.`);
    } else if (parameters.potassium > 5.1) {
      recs.push(`Elevated potassium (${parameters.potassium} mEq/L): Avoid bananas, oranges, potatoes, tomatoes, and salt substitutes.`);
      dietary.push('Strict low-potassium diet: avoid bananas, oranges, potatoes, tomatoes, avocados.');
    }
  }

  // ── Uric acid ────────────────────────────────────────────────────────────
  if (parameters.uricAcid !== undefined && parameters.uricAcid > 7.2) {
    recs.push(`High uric acid (${parameters.uricAcid} mg/dL): Discuss urate-lowering therapy with your doctor.`);
    dietary.push('Avoid organ meats, shellfish, alcohol, and high-fructose beverages to lower uric acid.');
  }

  // ── eGFR-based dietary ───────────────────────────────────────────────────
  if (egfr !== undefined && egfr < 60) {
    dietary.push('Limit daily protein intake to 0.6–0.8 g/kg body weight (as advised by your nephrologist).');
    dietary.push('Restrict phosphorus: avoid processed cheese, cola drinks, packaged foods.');
  }

  // ── Creatinine ───────────────────────────────────────────────────────────
  if (parameters.creatinine !== undefined && parameters.creatinine > 1.35) {
    dietary.push('Reduce red meat and high-protein foods — they raise creatinine levels.');
  }

  // ── Always include ───────────────────────────────────────────────────────
  dietary.push('Limit sodium to less than 2,300 mg per day — avoid adding salt to food.');
  dietary.push('Drink 6–8 glasses of water daily unless your doctor advises fluid restriction.');
  dietary.push('Choose fresh vegetables and fruits over processed or packaged foods.');

  lifestyle.push('Monitor blood pressure at home twice daily and keep a log to share with your doctor.');
  lifestyle.push('Exercise moderately: 30 minutes of brisk walking or cycling, 5 days per week.');
  lifestyle.push('Never take NSAIDs (ibuprofen, aspirin, diclofenac) for pain without consulting your doctor.');
  lifestyle.push('If diabetic, maintain HbA1c below 7% — uncontrolled diabetes accelerates CKD.');
  lifestyle.push('Quit smoking — smoking reduces kidney blood flow and accelerates CKD progression.');

  // ── Summary ──────────────────────────────────────────────────────────────
  const egfrStr = egfr ? `${egfr.toFixed(1)} mL/min/1.73m²` : 'unknown';
  const summary = stage
    ? `Your kidney function is at CKD ${getStageName(stage)} with an eGFR of ${egfrStr}. ` +
      `Overall risk score is ${analysis.riskScore}/100 (${analysis.riskLevel} risk). ` +
      (analysis.abnormalParams.length > 0
        ? `Parameters needing attention: ${analysis.abnormalParams.join(', ')}.`
        : 'Most kidney parameters are within the normal reference range.')
    : `Your lab results show a risk score of ${analysis.riskScore}/100. ` +
      `Please provide eGFR or creatinine values for a more specific assessment.`;

  return { summary, recommendations: recs, dietaryAdvice: dietary, lifestyle, urgency, urgencyMessage, followUp };
}

// ─── Grok API call (enhancement — short timeout) ──────────────────────────────
const SYSTEM_PROMPT = `You are a specialized kidney health AI assistant trained on KDIGO nephrology guidelines.
Analyze the kidney function test results and give personalized recommendations.
Always recommend consulting a nephrologist for medical decisions.
Respond ONLY with valid JSON — no markdown, no extra text:
{
  "summary": "2-3 sentence assessment",
  "recommendations": ["actionable medical rec 1", "..."],
  "dietaryAdvice": ["specific dietary advice 1", "..."],
  "lifestyle": ["lifestyle tip 1", "..."],
  "urgency": "routine|soon|urgent|emergency",
  "urgencyMessage": "one sentence on when to see a doctor",
  "followUp": "e.g. Every 3 months"
}`;

async function callGrokAPI(
  parameters: KidneyParameters,
  analysis: AnalysisResult,
  profile: Pick<UserProfile, 'age' | 'sex'>,
): Promise<AIRecommendationResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const payload = {
      patient: { age: profile.age, sex: profile.sex },
      kidneyParameters: parameters,
      ckdAnalysis: {
        stage: analysis.ckdStage,
        stageName: analysis.ckdStage ? getStageName(analysis.ckdStage) : 'unknown',
        riskLevel: analysis.riskLevel,
        riskScore: `${analysis.riskScore}/100`,
        estimatedEgfr: analysis.estimatedEgfr,
        abnormalParameters: analysis.abnormalParams,
      },
    };

    const isClaudeKey = GROK_API_KEY.startsWith('sk-ant-');
    const isGroqKey = GROK_API_KEY.startsWith('gsk_');
    
    let res: Response;
    if (isClaudeKey) {
      console.log('[GrokAI] Detected Anthropic key. Routing to Claude API...');
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': GROK_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: `Analyze and give recommendations:\n${JSON.stringify(payload, null, 2)}` },
          ],
        }),
      });
    } else if (isGroqKey) {
      console.log('[GrokAI] Detected Groq key. Routing to Groq API...');
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROK_API_KEY}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Analyze and give recommendations:\n${JSON.stringify(payload, null, 2)}` },
          ],
          temperature: 0.3,
          max_tokens: 900,
          response_format: { type: 'json_object' }
        }),
      });
    } else {
      console.log('[GrokAI] Routing to Grok API...');
      res = await fetch(`${GROK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROK_API_KEY}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Analyze and give recommendations:\n${JSON.stringify(payload, null, 2)}` },
          ],
          temperature: 0.3,
          max_tokens: 900,
        }),
      });
    }

    if (!res.ok) {
      console.warn(`[GrokAI] API responded ${res.status}`);
      return null;
    }

    const data = await res.json();
    let content = '';
    if (isClaudeKey) {
      content = data.content?.[0]?.text ?? '';
    } else {
      content = data.choices?.[0]?.message?.content ?? '';
    }
    
    return parseResponse(content);
  } catch (err: any) {
    if (err.name === 'AbortError') console.warn(`[GrokAI] Request timed out after ${TIMEOUT_MS / 1000}s`);
    else console.warn('[GrokAI] Request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseResponse(content: string): AIRecommendationResult | null {
  try {
    if (!content) return null;
    
    let obj: any = null;
    // Try direct parsing first
    try {
      obj = JSON.parse(content.trim());
    } catch (_) {}

    if (!obj) {
      // Strip markdown formatting if present
      let cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      try {
        obj = JSON.parse(cleaned);
      } catch (_) {}
    }

    if (!obj) {
      // Find the first '{' and last '}'
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonCandidate = content.substring(start, end + 1);
        try {
          obj = JSON.parse(jsonCandidate);
        } catch (e) {
          console.warn('[GrokAI] Regex-extracted JSON parsing failed:', e);
        }
      }
    }

    if (!obj) return null;

    const validUrgency: UrgencyLevel[] = ['routine', 'soon', 'urgent', 'emergency'];
    return {
      summary:         typeof obj.summary === 'string' ? obj.summary : '',
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations.filter((x: unknown) => typeof x === 'string') : [],
      dietaryAdvice:   Array.isArray(obj.dietaryAdvice)   ? obj.dietaryAdvice.filter((x: unknown) => typeof x === 'string')   : [],
      lifestyle:       Array.isArray(obj.lifestyle)       ? obj.lifestyle.filter((x: unknown) => typeof x === 'string')       : [],
      urgency:         validUrgency.includes(obj.urgency) ? obj.urgency : 'routine',
      urgencyMessage:  typeof obj.urgencyMessage === 'string' ? obj.urgencyMessage : '',
      followUp:        typeof obj.followUp === 'string' ? obj.followUp : 'As advised by your doctor',
    };
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────
export async function getAIRecommendations(
  parameters: KidneyParameters,
  analysis: AnalysisResult,
  profile: Pick<UserProfile, 'age' | 'sex'>,
): Promise<AIRecommendationResult> {
  // 1. Always generate local recommendations first (instant, always correct)
  const local = generateLocalRecommendations(parameters, analysis, profile);

  // 2. Use Grok/Groq API key
  if (GROK_API_KEY && GROK_API_KEY !== 'your_grok_api_key_here') {
    try {
      const apiResult = await callGrokAPI(parameters, analysis, profile);
      if (apiResult && apiResult.summary && apiResult.recommendations.length > 0) {
        console.info('[GrokAI] Using Grok/Claude API recommendations.');
        return apiResult;
      }
    } catch (e) {
      console.warn('[GrokAI] Groq/Grok API call failed:', e);
    }
  }

  // 3. API failed or returned empty — use smart local recommendations
  console.info('[GrokAI] Using local recommendations (API unavailable).');
  return local;
}
