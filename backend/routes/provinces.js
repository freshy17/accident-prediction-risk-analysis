const express = require('express');
const router = express.Router();
const db = require('../config/db');

//GET: /api/provinces ดีงรายชื่อจังหวัดทั้งหมด
router.get('/', async (req,res) => {
    try {
        const [rows] = await db.query('SELECT * FROM provinces ORDER BY pro_name_th ASC');
        res.json({success: true, count: rows.length, data: rows});
    } catch (error) {
        console.error('Error fetching provinces: ', error);
        res.status(500).json({success: false, message: 'Database query error'});
    }
});

module.exports = router;