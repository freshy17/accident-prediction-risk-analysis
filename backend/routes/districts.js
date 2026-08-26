const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/districts ดีงรายชื่ออำเภอ ตามรหัสจังหวัด (/api/districts?provinces_code=10)
router.get('/', async (req, res) => {
    const { province_code } = req.query;
    try {
        let sql = 'SELECT * FROM districts';
        let params = [];

        if(province_code) {
            sql += ' WHERE province_code = ?';
            params.push(province_code); 
        }

        const [rows] = await db.query(sql, params);
        res.json({success: true, count: rows.length, data: rows});
    } catch (error) {
        console.error('Error fetching districts: ', error);
        res.status(500).json({success: false, message: 'Database query error'});
    }
});

// GET: /api/districts/risk (ดึงข้อมูลความเสี่ยงแต่ละอำเภอ)
router.get('/risk', async (req, res) => {
    const { province_code, year } = req.query;
    try {
        let sql = `
            SELECT
                d.district_code,
                d.province_code,
                d.dis_name_th,
                d.latitude,
                d.longitude,
                ROUND(AVG(s.risk_score), 2) AS risk_score,
                CASE
                    WHEN AVG(s.risk_score) >= 8 THEN 'high'
                    WHEN AVG(s.risk_score) >= 3 THEN 'medium'
                    ELSE 'low'
                END AS risk_level
            FROM districts d
            INNER JOIN summaries s ON d.district_code = s.district_code
            WHERE 1=1
        `;
        let params = [];

        if (province_code && province_code !== 'ทั้งหมด') {
            sql += ' AND d.province_code = ?';
            params.push(province_code);
        }

        if (year && year !== 'ทั้งหมด') {
            sql += ' AND s.year = ?';
            params.push(year);
        }

        sql += ` GROUP BY d.district_code, d.province_code, d.dis_name_th, d.latitude, d.longitude`;

        const [rows] = await db.query(sql, params);
        res.json({ success: true, count: rows.length, data: rows});
    } catch (error) {
        console.error('Error fetching distrcits risk:', error);
        res.status(500).json({ success: false, message: 'Database query error'});
    }
});

module.exports = router;