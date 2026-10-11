// const express = require('express');
// const router = express.Router();
// const db = require('../config/db');

// // GET: /api/districts/risk (ดึงข้อมูลความเสี่ยงแต่ละอำเภอ)
// router.get('/risk', async (req, res) => {
//     const province_code = String(req.query.province_code || req.query.province || '').trim();
//     const year = String(req.query.year || '').trim();

//     const hasProvince = province_code !== '' && province_code !== 'ทั้งหมด' && province_code !== 'all';
//     const hasYear = year !== '' && year !== 'ทั้งหมด' && year !== 'all';

//     try {
//         const params = [];

//         const accConds = ['district_code IS NOT NULL'];
//         if (hasYear) { accConds.push('year = ?'); params.push(year); }
//         if (hasProvince) { accConds.push('province_code = ?'); params.push(province_code); }

//         const sumConds = ['1=1'];
//         if (hasYear) { sumConds.push('year = ?'); params.push(year); }

//         const sql = `
//             SELECT
//                 d.district_code,
//                 d.province_code,
//                 d.dis_name_th,
//                 d.latitude,
//                 d.longitude,
//                 acc.total_accidents,
//                 COALESCE(sm.risk_score, 0) AS risk_score,
//                 CASE
//                     WHEN COALESCE(sm.risk_score, 0) >= 60 THEN 'high'
//                     WHEN COALESCE(sm.risk_score, 0) >= 30 THEN 'medium'
//                     ELSE 'low'
//                 END AS risk_level
//             FROM districts d
//             INNER JOIN (
//                 SELECT district_code, COUNT(*) AS total_accidents
//                 FROM accidents
//                 WHERE ${accConds.join(' AND ')}
//                 GROUP BY district_code
//             ) acc ON CAST(acc.district_code AS UNSIGNED) = CAST(d.district_code AS UNSIGNED)
//             LEFT JOIN (
//                 SELECT district_code, ROUND(AVG(risk_score), 2) AS risk_score
//                 FROM summaries
//                 WHERE ${sumConds.join(' AND ')} 
//                 GROUP BY district_code
//             ) sm ON CAST(sm.district_code AS UNSIGNED) = CAST(d.district_code AS UNSIGNED)
//             ${hasProvince ? 'WHERE d.province_code = ?' : ''}
//         `;
//         if (hasProvince) params.push(province_code);

//         const [rows] = await db.query(sql, params);
//         res.json({ success: true, count: rows.length, data: rows });
//     } catch (error) {
//         console.error('Error fetching districts risk:', error);
//         res.status(500).json({ success: false, message: 'Database query error' });
//     }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: /api/districts/risk
// จำนวนอุบัติเหตุนับจาก accidents (ข้อมูลใหม่ขึ้นทันที)
// risk_score ใช้จาก summaries ถ้าไม่มีให้เป็น NULL (หน้าเว็บแสดงสีเทา "ยังไม่มีคะแนน")
router.get('/risk', async (req, res) => {
    const province_code = String(req.query.province_code || req.query.province || '').trim();
    const year = String(req.query.year || '').trim();

    const hasProvince = province_code !== '' && province_code !== 'ทั้งหมด' && province_code !== 'all';
    const hasYear = year !== '' && year !== 'ทั้งหมด' && year !== 'all';

    try {
        const params = [];

        const accConds = ['district_code IS NOT NULL'];
        if (hasYear) { accConds.push('year = ?'); params.push(year); }
        if (hasProvince) { accConds.push('province_code = ?'); params.push(province_code); }

        const sumConds = ['1=1'];
        if (hasYear) { sumConds.push('year = ?'); params.push(year); }

        const sql = `
            SELECT
                d.district_code,
                d.province_code,
                d.dis_name_th,
                d.latitude,
                d.longitude,
                acc.total_accidents,
                sm.risk_score AS risk_score,
                CASE
                    WHEN sm.risk_score IS NULL THEN NULL
                    WHEN sm.risk_score >= 60 THEN 'high'
                    WHEN sm.risk_score >= 30 THEN 'medium'
                    ELSE 'low'
                END AS risk_level
            FROM districts d
            INNER JOIN (
                SELECT district_code, COUNT(*) AS total_accidents
                FROM accidents
                WHERE ${accConds.join(' AND ')}
                GROUP BY district_code
            ) acc ON CAST(acc.district_code AS UNSIGNED) = CAST(d.district_code AS UNSIGNED)
            LEFT JOIN (
                SELECT district_code, ROUND(AVG(risk_score), 2) AS risk_score
                FROM summaries
                WHERE ${sumConds.join(' AND ')}
                GROUP BY district_code
            ) sm ON CAST(sm.district_code AS UNSIGNED) = CAST(d.district_code AS UNSIGNED)
            ${hasProvince ? 'WHERE d.province_code = ?' : ''}
        `;
        if (hasProvince) params.push(province_code);

        const [rows] = await db.query(sql, params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Error fetching districts risk:', error);
        res.status(500).json({ success: false, message: 'Database query error' });
    }
});

module.exports = router;