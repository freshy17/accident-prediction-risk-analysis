const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/', async (req, res) => {
    const { province_code, district_code, subdistrict_code, dayType, timeRange } = req.body;

    if (!province_code || !district_code || !subdistrict_code || !dayType || !timeRange) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    try {
        //ส่งค่าพารามิเตอร์ไปยัง Flask (Port 8001)
        const pythonRes = await axios.post('http://127.0.0.1:8001/predict', {
            province_code,
            district_code,
            subdistrict_code,
            time_period: timeRange,  
            day_type: dayType     
        }, {timeout: 10000});

        //ส่งผลลัพธ์พยากรณ์กลับไปที่ Frontend
        res.json(pythonRes.data);

    } catch (error) {
        console.error("Predict Error:", error.response?.data || error.message);
        const status = error.response?.status || 500;    
        res.status(status).json({ success: false, message: "Prediction failed" });
    }
});

module.exports = router;