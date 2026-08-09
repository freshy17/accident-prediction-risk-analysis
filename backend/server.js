const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//api ทดสอบว่า server ทำงานได้ปกติไหม
app.get('/', (req, res) => {
    res.send('Accident Database API is running!');
});

//api ดีงรายชื่อจังหวัดทั้งหมด
app.get('/api/provinces', async (req,res) => {
    try {
        const [rows] = await db.query('SELECT * FROM provinces ORDER BY pro_name_th ASC');
        res.json({success: true, count: rows.length, data: rows});
    } catch (error) {
        console.error('Error fetching provinces: ', error);
        res.status(500).json({success: false, message: 'Database query error'});
    }
});

//api ดีงรายชื่ออำเภอ ตามรหัสจังหวัด (/api/districts?provinces_code=10)
app.get('/api/districts', async (req, res) => {
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

//สั่งให้ server ทำงาน
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});