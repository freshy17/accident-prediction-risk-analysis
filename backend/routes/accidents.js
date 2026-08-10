const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/accidents ดีงข้อมูลอุบัติเหตุ
router.get('/', async (req, res) => {
    const { province_code, district_code, year, is_songkran, is_new_year} = req.query;

    try {
        let sql = `
            SELECT a.*, p.pro_name_th, d.dis_name_th
            FROM accidents a
            LEFT JOIN provinces p ON a.province_code = p.province_code
            LEFT JOIN districts d ON a.district_code = d.district_code
        `;
        let params = [];
        let conditions = [];

        if (province_code) {
            conditions.push('a.province_code = ?');
            params.push(province_code);
        }

        if (district_code) {
            conditions.push('a.district_code = ?');
            params.push(district_code);
        }

        if (year) {
            conditions.push('a.year = ?');
            params.push(year);
        }

        if (is_songkran === 'true') {
            conditions.push('a.is_songkran = TRUE');
        }

        if (is_new_year === 'true') {
            conditions.push('a.is_new_year = TRUE');
        }

        if (conditions.length > 0) {
            sql += 'WHERE' + conditions.join(' AND ');
        }
        sql += ' ORDER BY a.accident_id DESC';

        const [rows] = await db.query(sql, params);
        res.json({ sucess: true, count: rows.length, data: rows});
    } catch (error) {
        console.error('Error fetching accidents: ', error);
        res.status(500).json({sucess: false, message: 'Database query error', error: error.message});
    }
});

module.exports = router;