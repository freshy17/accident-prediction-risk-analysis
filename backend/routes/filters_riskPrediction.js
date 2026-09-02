const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET /api/filters/options
router.get('/filter-options', async (req, res) => {
    try {
        const [provinces] = await db.query(`
            SELECT DISTINCT p.province_code, p.pro_name_th 
            FROM accidents a
            JOIN provinces p ON a.province_code = p.province_code
            ORDER BY p.pro_name_th ASC
        `);
        const [timeRanges] = await db.query("SELECT DISTINCT time_period FROM accidents WHERE time_period IS NOT NULL ORDER BY time_period ASC");
        const [dayTypes] = await db.query("SELECT DISTINCT day_type FROM accidents WHERE day_type IS NOT NULL ORDER BY day_type ASC");
        const [weathers] = await db.query("SELECT DISTINCT weather FROM accidents WHERE weather IS NOT NULL ORDER BY weather ASC");

        res.json({
            provinces, 
            timeRanges: timeRanges.map(i => i.time_period),
            dayTypes: dayTypes.map(i => i.day_type),
            weathers: weathers.map(i => i.weather)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//ดึงอำเภอเฉพาะจังหวัดที่เลือก
//GET /api/filters/districts?province=xx
router.get('/districts', async(req, res) => {
    try {
        const { province } = req.query;
        if (!province) return res.json([]);

       const [districts] = await db.query(`
            SELECT DISTINCT d.district_code, d.dis_name_th 
            FROM accidents a
            JOIN districts d ON a.district_code = d.district_code
            WHERE a.province_code = ?
            ORDER BY d.dis_name_th ASC
        `, [province_code]);

        res.json(districts.map(d => d.district_name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;