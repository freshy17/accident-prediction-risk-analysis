const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/hotspots (พิกัดอุบัติเหตุจริงจากตาราง accidents สำหรับ Heatmap ภาพรวม)
router.get('/', async (req, res) => {
    try {
        const year = String(req.query.year || '').trim();
        const hasYear = year !== '' && year !== 'ทั้งหมด' && year !== 'all';

        const conditions = [
            'latitude IS NOT NULL',
            'longitude IS NOT NULL',
            'latitude BETWEEN 5 AND 21',
            'longitude BETWEEN 97 AND 106'
        ];
        const params = [];

        if (hasYear) {
            conditions.push('year = ?');
            params.push(year);
        }

        const sql = `
            SELECT
                latitude AS lat,
                longitude AS lng,
                1 AS risk_score
            FROM accidents
            WHERE ${conditions.join(' AND ')}
            ORDER BY RAND()
            LIMIT 3000
        `;

        const [rows] = await db.query(sql, params);
        res.json({ success: true, count: rows.length, data: rows });

    } catch (error) {
        console.error('Error fetching hotspots: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message });
    }
});

module.exports = router;