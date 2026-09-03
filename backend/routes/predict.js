const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');

router.post('/', async (req, res) => {
    const { district_code, timeRange, dayType, weather } = req.body;

    try {
        // 1. ค้นหาพิกัด lat/lng ของอำเภอจาก MySQL
        const [districts] = await db.query(
            'SELECT latitude, longitude FROM districts WHERE district_code = ?',
            [district_code]
        );

        if (!districts || districts.length === 0) {
            return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลพิกัดของอำเภอนี้' });
        }

        const { latitude, longitude } = districts[0];

        // 2. ส่ง latitude, longitude และพารามิเตอร์อื่นไปยัง Flask (Port 8001)
        const pythonRes = await axios.post('http://127.0.0.1:8001/predict', {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            district_code,
            timeRange,
            dayType,
            weather
        });

        // 3. ส่งผลลัพธ์พยากรณ์กลับไปที่ Frontend
        res.json(pythonRes.data);

    } catch (error) {
        console.error("Predict Error:", error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: "Prediction failed",
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;