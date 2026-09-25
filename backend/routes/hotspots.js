const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/hotspots (ดึงพิกัดจุดความร้อนทั้งหมดของอุบัติเหตุจากตาราง hotspots มาทำ Heatmap)
router.get('/', async (req, res) => {
    try {
        const { province_code, year } = req.query;
        let querySql = "";
        let params = [];
        let conditions = [];

        //ถ้าไม่ได้เลือกจังหวัด ให้แสดงภาพรวมทั้งประเทศ โดยดึงพิกัดจุดมาจากตาราง hotspots
        if(!province_code || province_code === '' || province_code === 'ทั้งหมด') {

            if (year && year !== '' && year !== 'ทั้งหมด') {
                conditions.push('h.year = ?');
                params.push(year);
            }

            let whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

            //ดึงพิกัด lat/lng และความหนาแน่นจากตาราง hotspots
            querySql = `
                SELECT
                    h.hotspot_id,
                    h.province_code,
                    p.pro_name_th AS province_name,
                    h.latitude AS lat,
                    h.longitude AS lng,
                    COALESCE(h.density_score, 10) AS risk_score,
                    'medium' AS risk_level,
                    '' AS top_factors
                FROM hotspots h
                LEFT JOIN provinces p ON h.province_code = p.province_code
                ${whereClause}
                ORDER BY RAND()
                LIMIT 3000
            `;
        }
        else {
            //เลือกจังหวัด ดึงรายอำเภอ
            if (year && year !== '' && year !== 'ทั้งหมด') {
                conditions.push('h.year = ?');
                params.push(year);
            }

            conditions.push('h.province_code = ?');
            params.push(province_code);

            const whereClause = ' WHERE ' + conditions.join(' AND ');

            querySql = `
                SELECT 
                    d.district_code,
                    d.province_code,
                    d.dis_name_th AS district_name,
                    p.pro_name_th AS province_name,
                    d.latitude AS lat,
                    d.longitude AS lng,
                    COALESCE(MAX(r.risk_score), 0) AS risk_score,
                    COALESCE(MAX(r.risk_level), 'low') AS risk_level,
                    COALESCE(MAX(r.sample_size), 0) AS sample_size,
                    COALESCE(MAX(r.top_factors), 'ไม่ระบุปัจจัย') AS top_factors
                FROM districts d
                LEFT JOIN provinces p ON d.province_code = p.province_code
                LEFT JOIN risk_scores r ON d.province_code = r.province_code 
                                    AND d.district_code = r.district_code
                ${whereClause}
                GROUP BY d.district_code
            `;
        }

        const [rows] = await db.query(querySql, params);
        res.json({ success: true, count: rows.length, data: rows });

    } catch (error) {
        console.error('Error fetching hotspots: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message });
    }
});

module.exports = router;