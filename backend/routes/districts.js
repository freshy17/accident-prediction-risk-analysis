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

module.exports = router;