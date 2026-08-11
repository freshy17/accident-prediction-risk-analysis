const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/risk_scores 
router.get('/', async (req, res) => {
    const { province_code, district_code, time_period, day_type, year } = req.query;

    try {
        let sql = `
            SELECT r.*, p.pro_name_th, d.dis_name_th
            FROM risk_scores r
            LEFT JOIN provinces p ON r.province_code = p.province_code
            LEFT JOIN districts d ON r.district_code = d.district_code
        `;
        let params = [];
        let conditions = [];

        if (province_code) {
            conditions.push('r.province_code = ?');
            params.push(province_code);
        }

        if (district_code) {
            conditions.push('r.district_code = ?');
            params.push(district_code);
        }

        if (time_period) {
            conditions.push('r.time_period = ?');
            params.push(time_period);
        }

        if (day_type) {
            conditions.push('r.day_type = ?');
            params.push(day_type);
        }

        if (year) {
            conditions.push('r.year = ?');
            params.push(year);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        //ดึงรายการที่เสี่ยงที่สุดมา 1 รายการ
        sql+= ' ORDER BY r.risk_score DESC LIMIT 1';

        const [rows] = await db.query(sql, params);

        res.json({ success: true, data: rows.length > 0 ? rows[0] : null})

    } catch (error) {
        console.error('Error fetching risk_scores: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }
});

module.exports = router;