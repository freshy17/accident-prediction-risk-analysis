const express = require('express');
const router = express.Router();
const db = require('../config/db');

const DAY_START_HOUR = 4;
const startHour = (label) => {
    const m = String(label).match(/(\d{1,2}):(\d{2})/);
    if (!m) return 999; 
    const h = Number(m[1]) + Number(m[2]) / 60;
    return h < DAY_START_HOUR ? h + 24 : h;
};
const sortTimePeriods = (list) => [...list].sort((a, b) => startHour(a) - startHour(b));

//เรียงประเภทวันตามลำดับคงที่ ค่าใหม่ที่ไม่รู้จักไปอยู่ท้าย
const DAY_TYPE_ORDER = ['normal_day', 'weekend', 'new_year', 'songkran'];
const sortDayTypes = (list) => {
    const rank = (d) => { const i = DAY_TYPE_ORDER.indexOf(d); return i === -1 ? 999 : i; };
    return [...list].sort((a, b) => rank(a) - rank(b));
};

//GET /api/filters/options
router.get('/options', async (req, res) => {
    try {
        const [provinces] = await db.query(`
            SELECT DISTINCT p.province_code, p.pro_name_th 
            FROM accidents a
            JOIN provinces p 
              ON a.province_code COLLATE utf8mb4_unicode_ci = p.province_code COLLATE utf8mb4_unicode_ci
            ORDER BY p.pro_name_th ASC
        `);
        const [timeRanges] = await db.query("SELECT DISTINCT time_period FROM accidents WHERE time_period IS NOT NULL ORDER BY time_period ASC");
        const [dayTypes] = await db.query("SELECT DISTINCT day_type FROM accidents WHERE day_type IS NOT NULL ORDER BY day_type ASC");

        res.json({
        provinces,
        timeRanges: sortTimePeriods(timeRanges.map(i => i.time_period)),
        dayTypes: sortDayTypes(dayTypes.map(i => i.day_type)),
    });
    } catch (err) {
        console.error("Error fetching options:", err);
        res.status(500).json({ error: 'Internal Server Error'  });
    }
});

//ดึงอำเภอเฉพาะจังหวัดที่เลือก
//GET /api/filters/districts?province=xx
router.get('/districts', async(req, res) => {
    const { province } = req.query;
    
    if (!province || isNaN(Number(province))) {
        return res.status(400).json({ error: 'Missing or invalid province parameter' });
    }

    try {
       const [districts] = await db.query(`
            SELECT DISTINCT d.district_code, d.dis_name_th 
            FROM accidents a
            JOIN districts d 
              ON a.district_code COLLATE utf8mb4_unicode_ci = d.district_code COLLATE utf8mb4_unicode_ci
            WHERE a.province_code = ?
            ORDER BY d.dis_name_th ASC
        `, [province]);

        res.json(districts);
    } catch (err) {
        console.error("Error fetching districts:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//GET /api/filters/subdistricts?district_code=XXXX - ดึงตำบลและนับจำนวนอุบัติเหตุ
router.get('/subdistricts', async (req, res) => {
    const { district_code } = req.query;

    if (!district_code) {
        return res.status(400).json({ error: 'Missing district_code parameter' });
    }

    try {
        const query = `
            SELECT 
                s.subdistrict_code AS subdistrict_code,
                s.name_in_thai AS sub_name_th,
                COUNT(a.accident_id) AS subdist_total_cases
            FROM subdistricts s
            LEFT JOIN accidents a 
              ON s.subdistrict_code = a.subdistrict_code
            WHERE s.district_code = ?
            GROUP BY s.subdistrict_code, s.name_in_thai
            ORDER BY s.name_in_thai ASC;
        `;

        const [rows] = await db.query(query, [district_code]);
        res.json(rows);

    } catch (err) {
        console.error("Error fetching subdistricts:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;