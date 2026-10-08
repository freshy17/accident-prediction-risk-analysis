const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

//Middleware ตรวจสอบ Token แอดมิน
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'ไม่มี token ยืนยันตัวตน'});
    }

    //ถอดรหัส+ตรวจสอบความถูกต้อง
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if(err) {
           return res.status(403).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
        }
        req.user = user;
        next(); //ผ่านแล้ว ไปทำฟังก์ชันต่อไปได้ก็คือ /add-data 
    });
};

//API สำหรับ Admin Login
router.post('/login', async(req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'The username or password is incorrect.'});
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'The username or password is incorrect.'});
        }

        const token = jwt.sign( 
            { userId: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h'}
        );

        res.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ',
            token: token,
            role: user.role
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error in Server'});
    }
});

//Middleware เช็กว่าเป็นแอดมินจริงไหม
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง'});
    }
    next();
};

const ALLOWED_ROLES = ['admin', 'editor'];

//API Create Admin
router.post('/register-admin', verifyToken, requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;

    //ตรวจสอบ input
    if (!username || !password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง (รหัสผ่านอย่างน้อยต้อง 8 ตัว)'});
    }
    const safeRole = ALLOWED_ROLES.includes(role) ? role : 'admin';

    try {
        // เช็คว่ามี username นี้ในระบบหรือยัง
        const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มี ใช้งานในระบบแล้ว' });
        }

        // เข้ารหัสรหัสผ่านก่อนบันทึก
        const hashedPassword = await bcrypt.hash(password, 10);

        // บันทึกลงตาราง users (กำหนด role เป็น admin หรือค่าที่ส่งมา)
        await db.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hashedPassword, safeRole || 'admin']
        );

        res.status(201).json({ success: true, message: 'สร้างบัญชีแอดมินสำเร็จ' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error in Server' });
    }
});

//API สำหรับ เพิ่มข้อมูลหน้า AdminUpload
router.post('/add-data', verifyToken, requireAdmin, async (req, res) => {
    const { title, description } = req.body;

    try {
        await db.query(
            'INSERT INTO accidents (title, description) VALUES (?, ?)',
            [title, description]
        );

        res.status(201).json({ success: true, message: 'เพิ่มข้อมูลไฟล์อุบัติเหตุสำเร็จ' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error in Server '});
    }
});

module.exports = router;