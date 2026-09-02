const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: /api/summaries (ภาพรวมการ์ดสรุปตัวเลขต่างๆ)
router.get('/', async (req, res) => {
    const { 
        province_code,  
        time_period, 
        day_type, 
        year,
        province,
        timeRange,
        dayType
    } = req.query;

    try {
        let params = []; //ค่าตัวแปรส่งไปแทน ?
        let conditions = []; //เก็บคำสั่ง sql

        //ยุบตัวกรองที่หลายตัวแปรให้เหลือแค่ 1 ตัว
        const provVal = (province || province_code || '').trim();
        const timeVal = (timeRange || time_period || '').trim();
        const dayVal = (dayType || day_type || '').trim();
        const yearVal = (year || '').trim();

        //แปลงจังหวัด
        let numericProvCode = null;
        if(provVal && provVal !== '' ) {
            try {
                const [pRows] = await db.query(
                    `SELECT province_code FROM provinces
                    WHERE id = ? OR province_code = ? OR pro_name_th = ? OR province_name = ? LIMIT 1`,
                    [provVal, provVal, provVal, provVal] //เอาไปแทน ? ใน sql
                );
                if(pRows && pRows.length > 0) {
                    numericProvCode = pRows[0].province_code;
                } else {
                    numericProvCode = provVal;
                }
            } catch (e) {
                numericProvCode = provVal;
            }
        }

        //แปลง dayVal ให้ตรงกับใน Database (normal_day, weekend, new_year, songkran)
        let mlDayType = dayVal;

        if (dayVal.includes('ธรรมดา') || dayVal.includes('จ.-ศ.') || dayVal.includes('normal')) {
            mlDayType = 'normal_day';
        } else if (dayVal.includes('สุดสัปดาห์') || dayVal.includes('เสาร์') || dayVal.includes('weekend')) {
            mlDayType = 'weekend';
        } else if (dayVal.includes('ปีใหม่') || dayVal.includes('new_year')) {
            mlDayType = 'new_year';
        } else if (dayVal.includes('สงกรานต์') || dayVal.includes('songkran')) {
            mlDayType = 'songkran';
        }

        //สร้าง WHERE Claude ตาม Filter ที่เลือก
        //ถ้ามีการ filter ให้เพิ่มแต่ละ filter เข้าไปใน sql
        if (yearVal && yearVal !== '' && yearVal !== 'ทั้งหมด' && yearVal !== 'all') {
            conditions.push('year = ?');
            params.push(yearVal);
        }

        if (numericProvCode && numericProvCode !== '' && numericProvCode !== 'ทั้งหมด' && numericProvCode !== 'all') {
            conditions.push('province_code = ?');
            params.push(numericProvCode);
        }

       if (timeVal && timeVal !== '' && timeVal !== 'ทั้งหมด' && timeVal !== 'all') {
            const labelOnly = timeVal.split('(')[0].trim();
            conditions.push('(time_period LIKE ? OR time_period LIKE ?)');
            params.push(`%${timeVal}%`, `%${labelOnly}%`);
        }

        if (mlDayType && mlDayType !== '' && mlDayType !== 'ทั้งหมด' && mlDayType !== 'all') {
            conditions.push('day_type = ?');
            params.push(mlDayType);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

        //ดึงข้อมูลผลรวมจำนวนอุบัติเหตุ, ผู้เสียชีวิต, ผู้บาดเจ็บ ทัังหมด
        const mainSql = `
            SELECT  
                COALESCE(SUM(total_accidents), 0) AS total_accidents,
                COALESCE(SUM(total_deaths), 0) AS total_deaths,
                COALESCE(SUM(total_injuries), 0) AS total_injuries
            FROM summaries
            ${whereClause}
        `;

        //ดึงข้อมูลช่วงเวลาที่เสี่ยงที่สุด
        const peakTimeSql = `
            SELECT time_period, SUM(total_accidents) AS total
            FROM summaries
            ${whereClause}
            GROUP BY time_period
            ORDER BY total DESC
            LIMIT 1
            `;

        //ยิงคำสั่ง sql ไปในฐานข้อมูล แล้วเก็บผลลัพธ์ไว้ใน mainRows & peakRows
        const [mainRows] = await db.query(mainSql, [...params]);
        let peakRows = [];
        try {
            const [pRes] = await db.query(peakTimeSql, [...params]);
            peakRows = pRes;
        } catch (e) {}
        
        const totalAccidents = (mainRows && mainRows.length > 0) ? Number(mainRows[0].total_accidents || 0) : 0;
        const totalDeaths = (mainRows && mainRows.length > 0) ? Number(mainRows[0].total_deaths || 0) : 0;
        const totalInjuries = (mainRows && mainRows.length > 0) ? Number(mainRows[0].total_injuries || 0) : 0;

        //กำหนดคำตอบของช่วงเวลาที่เสี่ยงที่สุด
        const mostRiskyTime = (timeVal && timeVal !== 'ทั้งหมด' && timeVal !== 'all') 
            ? timeVal 
            : (peakRows && peakRows.length > 0 ? peakRows[0].time_period : "-");

        res.json({ 
            success: true, data: {
                total_accidents: totalAccidents,
                total_deaths: totalDeaths,
                total_injuries: totalInjuries,
                most_risky_time: mostRiskyTime,
            }
        });

    } catch (error) {
        console.error('Error fetching summaries: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }
});

//GET: /api/summaries/top10 (Top 10 กราฟแท่ง)
router.get('/top10', async (req, res) => {
    const { year } = req.query;
    const province_code = req.query.province_code || req.query.province;

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

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += province_code
            ? ' GROUP BY s.district_code, d.dis_name_th ORDER BY total DESC LIMIT 10'
            : ' GROUP BY s.province_code, p.pro_name_th ORDER BY total DESC LIMIT 10';

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows});

    } catch (error) {
        console.error('Error fetching top10: ', error);
        res.status(500).json({ success: false, message: 'Database query error', error: error.message});
    }
})

//GET: /api/summaries/compare (กราฟเปรียบเทียบ ปกติ & หยุดปีใหม่ & สงกรานต์)
router.get('/compare', async (req, res) => {
    const { year } = req.query;
    const province_code = req.query.province_code || req.query.province;

    try {
        let sql = '';
        let params = [];
        let conditions = [];

        if (province_code) {
            //เลือกจังหวัด
            sql = `
                SELECT
                    d.dis_name_th AS name,
                    SUM(CASE WHEN s.day_type IN ('normal_day', 'weekend') THEN s.total_accidents ELSE 0 END) AS normal,
                    SUM(CASE WHEN s.day_type = 'new_year' THEN s.total_accidents ELSE 0 END) AS newYear,
                    SUM(CASE WHEN s.day_type = 'songkran' THEN s.total_accidents ELSE 0 END) AS songkran
                FROM summaries s
                JOIN districts d ON s.district_code = d.district_code
            `;
            conditions.push('s.province_code = ?');
            params.push(province_code);
        } else {
            //ไม่ได้เลือกจังหวัด
            sql = `
                SELECT
                    CASE 
                        WHEN CAST(s.province_code AS UNSIGNED) IN (10, 11, 12, 13, 14, 73, 74) THEN 'กทม. และปริมณฑล'
                        WHEN CAST(s.province_code AS UNSIGNED) BETWEEN 50 AND 58 
                          OR CAST(s.province_code AS UNSIGNED) BETWEEN 63 AND 67 THEN 'ภาคเหนือ'
                        WHEN CAST(s.province_code AS UNSIGNED) BETWEEN 30 AND 49 THEN 'ภาคตะวันออกเฉียงเหนือ'
                        WHEN CAST(s.province_code AS UNSIGNED) BETWEEN 80 AND 96 THEN 'ภาคใต้'
                        ELSE 'ภาคกลาง'
                    END AS name,
                    SUM(CASE WHEN s.day_type IN ('normal_day', 'weekend') THEN s.total_accidents ELSE 0 END) AS normal,
                    SUM(CASE WHEN s.day_type = 'new_year' THEN s.total_accidents ELSE 0 END) AS newYear,
                    SUM(CASE WHEN s.day_type = 'songkran' THEN s.total_accidents ELSE 0 END) AS songkran
                FROM summaries s
            `;
        }

        if (year) {
            conditions.push('s.year = ?');
            params.push(year);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += province_code 
            ? ' GROUP BY s.district_code, d.dis_name_th' 
            : ' GROUP BY name';

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

