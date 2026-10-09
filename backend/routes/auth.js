const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');
const { buildSubdistrictIndex, nearestSubdistrict } = require('./geoMatch');

const execFileAsync = promisify(execFile);
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const MAX_FILE_SIZE = 10 * 1024 * 1024; 
const PYTHON_CMD = process.env.PYTHON_CMD || 'python';
// ปรับ path ให้ตรงกับที่เก็บ clean_admin.py จริง 
const CLEAN_SCRIPT = process.env.CLEAN_SCRIPT ||
    path.join(__dirname, '..', '..', 'data_pipeline', 'clean_admin.py');

const PROVINCE_ALIAS = {
    'อยุธยา': 'พระนครศรีอยุธยา',
    'กรุงเทพ': 'กรุงเทพมหานคร',
    'กทม.': 'กรุงเทพมหานคร',
    'กทม': 'กรุงเทพมหานคร'
};
const normProvince = (s) => {
    const v = String(s ?? '').trim().replace(/^(จังหวัด|จ\.)\s*/, '').replace(/\s+/g, '');
    return PROVINCE_ALIAS[v] || v;
};

const upload = multer({
    dest: path.join(os.tmpdir(), 'accident-uploads'),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
            return cb(new Error('รองรับเฉพาะไฟล์ .csv เท่านั้น'));
        }
        cb(null, true);
    }
});

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

//Middleware เช็กว่าเป็นแอดมินจริงไหม
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง'});
    }
    next();
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

//API Create Admin
const ALLOWED_ROLES = ['admin', 'editor'];

router.post('/register-admin', verifyToken, requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;

    //ตรวจสอบ input
    if (!username || !password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง (รหัสผ่านอย่างน้อยต้อง 8 ตัว)'});
    }
    const safeRole = ALLOWED_ROLES.includes(role) ? role : 'editor';

    try {
        // เช็คว่ามี username นี้ในระบบหรือยัง
        const [existing] = await db.query('SELECT user_id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีใช้งานในระบบแล้ว' });
        }

        // เข้ารหัสรหัสผ่านก่อนบันทึก
        const hashedPassword = await bcrypt.hash(password, 10);

        // บันทึกลงตาราง users (กำหนด role เป็น admin หรือค่าที่ส่งมา)
        await db.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hashedPassword, safeRole]
        );

        res.status(201).json({ success: true, message: 'สร้างบัญชีแอดมินสำเร็จ' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error in Server' });
    }
});

//API สำหรับ เพิ่มข้อมูลหน้า AdminUpload
router.post('/add-data', verifyToken, requireAdmin,
    //รับไฟล์ข้อมูลชุดใหม่
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) {
                const msg = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกิน 10 MB' : err.message;
                return res.status(400).json({ success: false, message: msg });
            }
            next();
        });
    },
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'ไม่พบไฟล์ที่อัปโหลด' });
        }
        const inputPath = req.file.path;
        const outputPath = `${inputPath}_cleaned.csv`;

        try {
            //คลีนข้อมูลด้วย Python Script
            try {
                await execFileAsync(PYTHON_CMD, [CLEAN_SCRIPT, inputPath, outputPath],
                    { encoding: 'utf8', timeout: 120000 });
            } catch (e) {
                const detail = String(e.stdout || e.stderr || e.message).trim();
                return res.status(422).json({ success: false, message: `คลีนข้อมูลไม่สำเร็จ: ${detail}` });
            }

            //อ่านไฟล์ที่คลีนเสร็จแล้ว
            const records = parse(fs.readFileSync(outputPath, 'utf8'),
                { columns: true, skip_empty_lines: true, bom: true });

            if (records.length === 0) {
                return res.status(422).json({
                    success: false,
                    message: 'ไม่พบแถวที่ใช้ได้หลังคลีนข้อมูล (โปรดตรวจพิกัดและรูปแบบไฟล์)'
                });
            }

            //แปลงชื่อจังหวัด -> province_code จากตาราง provinces (ไฟล์ใหม่ไม่มีรหัสมาให้)
            const unmatchedProvinces = new Set();
            if ('จังหวัด' in records[0] && !('province_code' in records[0])) {
                const [provRows] = await db.query('SELECT province_code, pro_name_th FROM provinces');
                const provMap = new Map(
                    provRows.map(p => [normProvince(p.pro_name_th), String(p.province_code)])
                );
                for (const r of records) {
                    const code = provMap.get(normProvince(r['จังหวัด']));
                    if (code) {
                        r.province_code = code;
                    } else {
                        r.province_code = '';   // บันทึกเป็น NULL
                        const raw = String(r['จังหวัด'] ?? '').trim();
                        if (raw && raw !== 'ไม่ระบุ') unmatchedProvinces.add(raw);
                    }
                }
            }

            //เติมรหัสอำเภอ/ตำบล/ชื่อตำบล จากพิกัด (ตำบลที่ใกล้ที่สุดในจังหวัดเดียวกัน)
            //ใช้เฉพาะเมื่อไฟล์ไม่มี subdistrict_code มาให้ และมีพิกัดกับรหัสจังหวัดแล้ว
            let geoMatched = 0;
            let geoFar = 0;
            const GEO_FAR_KM = 50;
            if ('province_code' in records[0] && 'latitude' in records[0] && 'longitude' in records[0]
                && !('subdistrict_code' in records[0])) {
                const [subRows] = await db.query(
                    'SELECT code, name_in_thai, latitude, longitude FROM subdistricts'
                );
                const subIndex = buildSubdistrictIndex(subRows);
                for (const r of records) {
                    const hit = nearestSubdistrict(subIndex, r.province_code, r.latitude, r.longitude);
                    if (hit) {
                        r.subdistrict_code = hit.subdistrict_code;
                        r.district_code = hit.district_code;
                        r.tambon = hit.tambon;
                        geoMatched += 1;
                        if (hit.distanceKm > GEO_FAR_KM) geoFar += 1;
                    } else {
                        r.subdistrict_code = '';
                        r.district_code = '';
                        r.tambon = '';
                    }
                }
            }

            //เทียบคอลัมน์กับตาราง accidents จริง (ข้ามคอลัมน์ auto_increment)
            const [colRows] = await db.query(
                `SELECT COLUMN_NAME AS name, EXTRA AS extra
                 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accidents'`
            );
            const tableCols = colRows
                .filter(c => !/auto_increment/i.test(c.extra))
                .map(c => c.name);
            const fileCols = Object.keys(records[0]);
            const useCols = fileCols.filter(c => tableCols.includes(c));
            const ignoredColumns = fileCols.filter(c => !tableCols.includes(c));
            const emptyColumns = tableCols.filter(c => !fileCols.includes(c));

            if (useCols.length === 0) {
                return res.status(422).json({
                    success: false,
                    message: 'ไม่มีคอลัมน์ในไฟล์ที่ตรงกับตาราง accidents'
                });
            }

            //insert เป็นชุด ใน transaction (ถ้าพังกลางทางจะ rollback ทั้งหมด)
            const conn = await db.getConnection();
            let inserted = 0;
            try {
                await conn.beginTransaction();
                const colSql = useCols.map(c => `\`${c}\``).join(', ');

                for (let i = 0; i < records.length; i += 1000) {
                    const chunk = records.slice(i, i + 1000)
                        .map(r => useCols.map(c => (r[c] === '' ? null : r[c])));
                    const [result] = await conn.query(
                        `INSERT INTO accidents (${colSql}) VALUES ?`, [chunk]);
                    inserted += result.affectedRows;
                }

                await conn.commit();
            } catch (e) {
                await conn.rollback();
                throw e;   // ส่งต่อให้ catch ด้านนอกตอบ error
            } finally {
                conn.release();
            }

            res.json({
                success: true,
                inserted,
                totalRows: records.length,
                ignoredColumns,
                emptyColumns,
                unmatchedProvinces: [...unmatchedProvinces],
                geoMatched,
                geoFar
            });

        } catch (error) {
            console.error('add-data error:', error);
            res.status(500).json({
                success: false,
                message: `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.sqlMessage || error.message}`
            });
        } finally {
            //ลบไฟล์ชั่วคราวทุกครั้ง
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
        }
    }
);

module.exports = router;