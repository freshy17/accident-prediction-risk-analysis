const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET /api/filters/options
router.get('/options', async (req, res) => {
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
        `, [province]);

        // res.json(districts.map(d => d.district_name));
        res.json(districts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. GET /api/filters/subdistricts?district_code=XXXX - ดึงตำบลและนับจำนวนอุบัติเหตุ
// router.get('/subdistricts', async (req, res) => {
//     const { district_code } = req.query;

//     if (!district_code) {
//         return res.status(400).json({ error: 'Missing district_code parameter' });
//     }

//     try {
//         const query = `
//             SELECT 
//                 s.code AS subdistrict_code,
//                 s.name_in_thai AS sub_name_th,
//                 COUNT(a.accident_id) AS subdist_total_cases
//             FROM
//                 subdistricts s
//             LEFT JOIN 
//                 accidents a ON s.code = a.subdistrict_code
//             WHERE
//                 s.district_id = ?
//             GROUP BY
//                 s.code,
//                 s.name_in_thai;
//         `;

//         const [rows] = await db.query(query, [district_code]);
//         res.json(rows);
        
//     } catch (err) {
//         console.error("Error fetching subdistricts:", err);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

router.get('/subdistricts', async (req, res) => {
    const { district_code } = req.query;

    if (!district_code) {
        return res.status(400).json({ error: 'Missing district_code parameter' });
    }

    try {
        const query = `
            SELECT 
                s.code AS subdistrict_code,
                s.name_in_thai AS sub_name_th,
                COUNT(a.accident_id) AS subdist_total_cases
            FROM subdistricts s
            LEFT JOIN accidents a ON s.code = a.subdistrict_code
            WHERE FLOOR(s.code / 100) = ?
            GROUP BY s.code, s.name_in_thai;
        `;

        const [rows] = await db.query(query, [district_code]);
        res.json(rows);
        
    } catch (err) {
        console.error("Error fetching subdistricts:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

