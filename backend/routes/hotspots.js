const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/hotspots 
router.get('/', async (req, res) => {
    const { province_code, district_code, year } = req.query;
    
    try {
        let sql = `
            SELECT h.*, p.pro_name_th, d.dis_name_th
            FROM hotspots h
            LEFT JOIN provinces p ON h.province_code = p.province_code
            LEFT JOIN districts d ON h.district_code = d.district_code
        `;
        let params = [];
        let conditions = [];

        if (province_code) {
            conditions.push('h.province_code = ?');
            params.push(province_code);
        }

        if (district_code) {
            conditions.push('h.district_code = ?');
            params.push(district_code);
        }

        if (year) {
            conditions.push('h.year = ?');
            params.push(year);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        const [rows] = await db.query(sql, params);
        res.json({ success: true, count: rows.length, data: rows})

    } catch (error) {
        console.error('Error fetcing hotspots: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }

});

module.exports = router;