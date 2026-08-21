const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/summaries (ภาพรวมการ์ดสรุปตัวเลขต่างๆ)
router.get('/', async (req, res) => {
    const { 
        province_code, 
        district_code, 
        time_period, 
        day_type, 
        year,
        province,
        timeRange,
        dayType
    } = req.query;

    try {
        let params = [];
        let conditions = [];

        const provVal = province || province_code;
        const timeVal = timeRange || time_period;
        const dayVal = dayType || day_type;

        let numericProvCode = province_code || null;
        if(provVal && provVal !== '' ) {
            const [pRows] = await db.query(
                `SELECT province_code FROM provinces WHERE province_name = ? OR province_code = ? LIMIT 1`,
                [proVal, proVal] 
            );
            if(pRows.length > 0) {
                numericProvCode = pRows[0].province_code;
            }
        }

        if (district_code && district_code !== '') {
            conditions.push('district_code = ?');
            params.push(district_code);
        }

        if (year && year !== '') {
            conditions.push('year = ?');
            params.push(year);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

        const mainSql = `
            SELECT  
                COALESCE(SUM(total_accidents), 0) AS total_accidents,
                COALESCE(SUM(total_deaths), 0) AS total_deaths,
                COALESCE(SUM(total_injuries), 0) AS total_injuries
            FROM summaries
            ${whereClause}
        `;

        const peakTimeSql = `
            SELECT time_period, SUM(total_accidents) AS total
            FROM summaries
            ${whereClause}
            GROUP BY time_period
            ORDER BY total DESC
            LIMIT 1
            `;

        let riskConditions = [];
        let riskParams = [];

        if(numericProvCode) {
            riskConditions.push('province_code = ?');
            riskParams.push(numericProvCode);
        }
        if (timeVal) {
            riskConditions.push('time_period = ?');
            riskParams.push(timeVal);
        }
        if (dayVal) {
            riskConditions.push('day_type = ?');
            riskParams.push(dayVal);
        }
        if (year) {
            riskConditions.push('year = ?');
            riskParams.push(year);
        }

        const riskWhere = riskConditions.length > 0 ? ' WHERE ' + riskConditions.join(' AND ') : '';

        const riskSql = `
            SELECT 
                AVG(risk_score) AS avg_risk_score,
                risk_level
            FROM risk_scores
            ${riskWhere}
            GROUP BY risk_level
            ORDER BY avg_risk_score DESC
            LIMIT 1
        `;

        const [mainRows] = await db.query(mainSql, [...params]);
        const [peakRows] = await db.query(peakTimeSql, [...params]);
        
        let riskScore = 0;
        let riskLevel = "-";

        try {
            const [riskRows] = await db.query(riskSql, [...riskParams]);
            if(riskRows.length > 0 && riskRows[0].avg_risk_score !== null) {
                riskScore = Number(riskRows[0].avg_risk_score).toFixed(1);
                riskLevel = riskRows[0].risk_level || "-"
            } else {
                const totalAcc = Number(mainRows[0].total_accidents);
                const totalDead = Number(mainRows[0].total_deaths);
                if (totalAcc > 0) {
                    const raw = (totalDead * 5) + totalAcc;
                    riskScore = Math.min(Math.round(raw / 10), 100);
                    riskLevel = riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low';
                }
            }
        } catch (err) {
            console.error("Error querying risk_scores table:", err.message)
        }

        const mostRiskyTime = timeVal || (peakRows.length > 0 ? peakRows[0].time_period : "-");
       
        res.json({ 
            success: true, 
            data: {
                total_accidents: Number(mainRows[0].total_accidents),
                total_deaths: Number(mainRows[0].total_deaths),
                total_injuries: Number(mainRows[0].total_injuries),
                most_risky_time: mostRiskyTime,
                risk_score: riskScore,
                risk_level: riskLevel
            }
        });

    } catch (error) {
        console.error('Error fetching summaries: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }
});

//GET: /api/summaries/top10 (Top 10 กราฟแท่ง)
router.get('/top10', async (req, res) => {
    const { province_code, year, time_period, day_type} = req.query;

    try {
        let sql = '';
        let params = [];
        let conditions = [];

        if (province_code) {
            //ถ้าเลือกจังหวัด ให้ดึง Top 10 อำเภอของจังหวัดนั้น
            sql = `
                SELECT d.dis_name_th AS name, SUM(s.total_accidents) AS total
                FROM summaries s
                JOIN districts d ON s.district_code = d.district_code
            `;
            conditions.push('s.province_code = ?');
            params.push(province_code);
        } else {
            //ถ้าไม่เลือกจังหวัด ให้ดึง Top 10 จังหวัดของประเทศ
            sql = `
                SELECT p.pro_name_th AS name, SUM(s.total_accidents) AS total
                FROM summaries s
                JOIN provinces p ON s.province_code = p.province_code
            `;
        }

        if (year) {
            conditions.push('s.year = ?');
            params.push(year);
        }

        if (time_period) {
            conditions.push('s.time_period = ?');
            params.push(time_period);
        }

        if (day_type) {
            conditions.push('s.day_type = ?');
            params.push(day_type);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += province_code
            ? 'GROUP BY s.district_code ORDER BY total DESC LIMIT 10'
            : 'GROUP BY s.province_code ORDER BY total DESC LIMIT 10';

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows});

    } catch (error) {
        console.error('Error fetching top10: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }
})

//GET: /api/summaries/compare (กราฟเปรียบเทียบ ปกติ & หยุดปีใหม่ & สงกรานต์)
router.get('/compare', async (req, res) => {
    const { province_code, year } = req.query;

    try {
        let sql = `
            SELECT
                day_type,
                SUM(total_accidents) AS total_accidents,
                SUM(total_deaths) AS total_deaths,
                SUM(totalinjuries) AS total_injuries
            FROM summaries
        `;

        let params = [];
        let conditions = [];

        if (province_code) {
            conditions.push('province_code = ?');
            params.push(province_code);
        }

        if (year) {
            conditions.push('year = ?');
            params.push(year);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' GROUP BY day_type';

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('Error fetching compare data: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }
});

//GET: /api/summaries/years (เพื่อดึงปีทั้งหมดที่มีใน Database ไว้ใส่ใน Dropdown)
router.get('/years', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT year FROM summaries ORDER BY year DESC');
        //ส่งข้อมูลกลับมาเป็น array ex: [2025, 2024, 2023, 2022, 2021]
        const years = rows.map(item => item.year);
        res.json({ success: true, data: years });
    } catch (error) {
        console.error('Error fetching years: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message });
    }
});

module.exports = router;