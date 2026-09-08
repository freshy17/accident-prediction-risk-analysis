const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

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

//API Create Admin
router.post('/register-admin', async (req, res) => {
    const { username, password, role } = req.body;

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
            [username, hashedPassword, role || 'admin']
        );

        res.status(201).json({ success: true, message: 'สร้างบัญชีแอดมินสำเร็จ' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error in Server' });
    }
});

module.exports = router;