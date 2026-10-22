const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const PROMPT_FILE = path.join(__dirname, '..', 'prompts', 'explain_prompt.txt');

//POST /api/explain
//รับผลพยากรณ์ (ที่ frontend ได้จาก /api/predict) + ชื่อพื้นที่ แล้วให้ Gemini เขียนคำอธิบายภาษาไทย

//อ่าน prompt ใหม่อัตโนมัติเมื่อไฟล์ถูกแก้ (ไม่ต้องรีสตาร์ท backend)
let promptState = { mtime: 0, text: null, id: '' };
function getPrompt() {
    try {
        const st = fs.statSync(PROMPT_FILE);
        if (st.mtimeMs !== promptState.mtime) {
            const text = fs.readFileSync(PROMPT_FILE, 'utf8').trim();
            const id = crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
            promptState = { mtime: st.mtimeMs, text, id };
            console.log(`[explain] โหลด prompt แล้ว (${text.length} ตัวอักษร, id ${id})`);
        }
        return promptState;
    } catch (e) {
        console.error('[explain] อ่านไฟล์ prompt ไม่ได้:', PROMPT_FILE);
        return null;
    }
}

const FEATURES = ['province_code', 'district_code', 'subdistrict_code',
    'time_period', 'day_type', 'subdist_total_cases'];
const LEVEL_TH = { High: 'สูง', Medium: 'ปานกลาง', Low: 'ต่ำ' };

const str = (v, max = 100) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

//ตรวจและประกอบ JSON ที่จะส่งให้ Gemini (ไม่ส่งต่อข้อมูลดิบจากผู้ใช้ตรงๆ)
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function callGeminiOnce(model, payload, systemPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    const base = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

    const r = await axios.post(`${base}/models/${model}:generateContent`, {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
            role: 'user',
            parts: [{ text: 'ข้อมูลผลการประเมิน (JSON):\n' + JSON.stringify(payload, null, 2) }],
        }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    }, {
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 25000,
    });

    const parts = r.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini ตอบกลับว่างเปล่า');
    return cleanText(text);
}

//ลองโมเดลหลักก่อน (retry เมื่อ 429/5xx/timeout/ว่าง) แล้วค่อยสลับไปโมเดลสำรอง
//ตั้งใน .env ได้: GEMINI_MODEL=... และ GEMINI_FALLBACK_MODEL=...
async function callGemini(payload, systemPrompt) {
    const models = [
        process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash',
    ].filter((m, i, a) => m && a.indexOf(m) === i);
    const ATTEMPTS = 2;
    let lastErr;

    for (const model of models) {
        for (let i = 1; i <= ATTEMPTS; i++) {
            try {
                return await callGeminiOnce(model, payload, systemPrompt);
            } catch (e) {
                lastErr = e;
                const status = e.response?.status;
                const msg = e.response?.data?.error?.message || e.message;
                console.error(`[explain] ${model} ครั้งที่ ${i}/${ATTEMPTS} ล้ม (${status || 'no status'}): ${msg}`);
                const retryable = !status || RETRYABLE.has(status) || /ว่างเปล่า/.test(e.message);
                if (!retryable) break;            //เช่น 400/403 ลองซ้ำก็ไม่หาย ข้ามไปโมเดลถัดไป
                if (i < ATTEMPTS) await sleep(1000 * i);
            }
        }
    }
    throw lastErr;
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
    const prompt = getPrompt();
    if (!process.env.GEMINI_API_KEY || !prompt) {
        return res.status(503).json({ success: false, message: 'ยังไม่ได้ตั้งค่าระบบอธิบายผล' });
    }

    const payload = buildPayload(req.body || {});
    if (!payload) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    //ใส่ id ของ prompt ในคีย์ cache ด้วย แก้ prompt แล้วผลเก่าจะไม่ถูกใช้ซ้ำ
    const key = crypto.createHash('sha1').update(prompt.id + JSON.stringify(payload)).digest('hex');

    const cached = cacheGet(key);
    if (cached) return res.json({ success: true, explanation: cached, cached: true });

    try {
        let p = inflight.get(key);
        if (!p) {
            p = callGemini(payload, prompt.text).finally(() => inflight.delete(key));
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