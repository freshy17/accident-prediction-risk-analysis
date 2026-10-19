const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

//POST /api/explain
//รับผลพยากรณ์ (ที่ frontend ได้จาก /api/predict) + ชื่อพื้นที่ แล้วให้ Gemini เขียนคำอธิบายภาษาไทย

const PROMPT_FILE = path.join(__dirname, '..', 'prompts', 'explain_prompt.txt');
let SYSTEM_PROMPT = null;
try {
    SYSTEM_PROMPT = fs.readFileSync(PROMPT_FILE, 'utf8').trim();
} catch (e) {
    console.error('[explain] อ่านไฟล์ prompt ไม่ได้:', PROMPT_FILE);
}

const FEATURES = ['province_code', 'district_code', 'subdistrict_code',
    'time_period', 'day_type', 'subdist_total_cases'];
const LEVEL_TH = { High: 'สูง', Medium: 'ปานกลาง', Low: 'ต่ำ' };

const str = (v, max = 100) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// ตรวจและประกอบ JSON ที่จะส่งให้ Gemini (ไม่ส่งต่อข้อมูลดิบจากผู้ใช้ตรงๆ)
function buildPayload(b) {
    const score = Number(b.risk_score);
    const level = LEVEL_TH[b.risk_level];
    if (!Number.isFinite(score) || !level) return null;
    if (!Array.isArray(b.shap_values) || b.shap_values.length === 0 || b.shap_values.length > 10) return null;

    const featureValue = {
        province_code: str(b.province_code, 10),
        district_code: str(b.district_code, 10),
        subdistrict_code: str(b.subdistrict_code, 10),
        time_period: str(b.time_period, 40),
        day_type: str(b.day_type, 20),
        subdist_total_cases: Number(b.subdist_total_cases) || 0,
    };

    const factors = [];
    for (const f of b.shap_values) {
        const v = Number(f && f.value);
        if (!f || !FEATURES.includes(f.feature) || !Number.isFinite(v)) return null;
        factors.push({
            feature: f.feature,
            value: featureValue[f.feature],
            shap_value: v,
            direction: v >= 0 ? 'increases_prediction' : 'decreases_prediction',
        });
    }
    factors.sort((a, c) => Math.abs(c.shap_value) - Math.abs(a.shap_value));

    return {
        area: {
            province_code: featureValue.province_code,
            province_name: str(b.province_name, 60),
            district_code: featureValue.district_code,
            district_name: str(b.district_name, 60),
            subdistrict_code: featureValue.subdistrict_code,
            subdistrict_name: str(b.subdistrict_name, 60),
        },
        time_period: featureValue.time_period,
        day_type: featureValue.day_type,
        risk_score: score,
        risk_level: level,
        shap_factors: factors,
    };
}

async function callGemini(payload) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const base = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

    const r = await axios.post(`${base}/models/${model}:generateContent`, {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
            role: 'user',
            parts: [{ text: 'ข้อมูลผลการประเมิน (JSON):\n' + JSON.stringify(payload, null, 2) }],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }, {
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 25000,
    });

    const parts = r.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini ตอบกลับว่างเปล่า');
    return cleanText(text);
}

//กันกรณี AI ใส่ Markdown มาทั้งที่ห้ามไว้ (หน้าเว็บแสดงเป็นข้อความธรรมดา)
function cleanText(t) {
    return t
        .replace(/\*\*/g, '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

//cache: ชุดข้อมูลเดิม (พื้นที่+เวลา+วัน+คะแนน+ค่า SHAP) ไม่ต้องเรียก Gemini ซ้ำ
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();      //key -> { text, at }
const inflight = new Map();   //key -> Promise (กันเรียกซ้ำพร้อมกัน)

function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
    return hit.text;
}
function cacheSet(key, text) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { text, at: Date.now() });
}

router.post('/', async (req, res) => {
    if (!process.env.GEMINI_API_KEY || !SYSTEM_PROMPT) {
        return res.status(503).json({ success: false, message: 'ยังไม่ได้ตั้งค่าระบบอธิบายผล' });
    }

    const payload = buildPayload(req.body || {});
    if (!payload) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    const key = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');

    const cached = cacheGet(key);
    if (cached) return res.json({ success: true, explanation: cached, cached: true });

    try {
        let p = inflight.get(key);
        if (!p) {
            p = callGemini(payload).finally(() => inflight.delete(key));
            inflight.set(key, p);
        }
        const text = await p;
        cacheSet(key, text);
        res.json({ success: true, explanation: text, cached: false });
    } catch (e) {
        //ไม่ log header/key เด็ดขาด
        const status = e.response?.status;
        const msg = e.response?.data?.error?.message || e.message;
        console.error(`[explain] Gemini error (${status || 'no status'}):`, msg);
        res.status(status === 429 ? 429 : 502).json({ success: false, message: 'สร้างคำอธิบายไม่สำเร็จ' });
    }
});

module.exports = router;