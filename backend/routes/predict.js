const express = require('express');
const router = express.Router();
const axios = require('axios');

const FLASK_URL = 'http://127.0.0.1:8001';

//model_id ที่รับได้: 'default' (โมเดลหลัก) หรือเลขเวอร์ชันของโมเดลทดลอง เช่น 20261022_115633
const MODEL_ID_PATTERN = /^(default|\d{8}_\d{6})$/;

//รายการโมเดลที่เลือกใช้พยากรณ์ได้ (โมเดลหลัก + โมเดลทดลองที่รีเทรนไว้)
router.get('/models', async (req, res) => {
    try {
        const pythonRes = await axios.get(`${FLASK_URL}/models`, { timeout: 30000 });
        res.json(pythonRes.data);
    } catch (error) {
        console.error("List Models Error:", error.response?.data || error.message);
        const status = error.response?.status || 500;
        res.status(status).json({ success: false, message: "Failed to load models" });
    }
});

router.post('/', async (req, res) => {
    const { province_code, district_code, subdistrict_code, dayType, timeRange, model_id } = req.body;

    if (!province_code || !district_code || !subdistrict_code || !dayType || !timeRange) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    //model_id ไม่บังคับ (ไม่ส่งมา = ใช้โมเดลหลัก) แต่ถ้าส่งมาต้องเป็นรูปแบบที่ถูกต้อง
    const hasModelId = model_id !== undefined && model_id !== null && model_id !== '';
    if (hasModelId && !MODEL_ID_PATTERN.test(String(model_id))) {
        return res.status(400).json({ success: false, message: 'Invalid model_id' });
    }

    try {
        //ส่งค่าพารามิเตอร์ไปยัง Flask (Port 8001)
        const pythonRes = await axios.post(`${FLASK_URL}/predict`, {
            province_code,
            district_code,
            subdistrict_code,
            time_period: timeRange,
            day_type: dayType,
            model_id: hasModelId ? String(model_id) : 'default'
        }, {timeout: 20000});

        //ส่งผลลัพธ์พยากรณ์กลับไปที่ Frontend
        res.json(pythonRes.data);

    } catch (error) {
        console.error("Predict Error:", error.response?.data || error.message);
        const status = error.response?.status || 500;
        res.status(status).json({ success: false, message: "Prediction failed" });
    }
});

module.exports = router;