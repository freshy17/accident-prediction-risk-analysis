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

const execFileAsync = promisify(execFile);
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const MAX_FILE_SIZE = 10 * 1024 * 1024; 
const PYTHON_CMD = process.env.PYTHON_CMD || 'python';
//ปรับ path ให้ตรงกับที่เก็บ clean_admin.py จริง 
const CLEAN_SCRIPT = process.env.CLEAN_SCRIPT ||
    path.join(__dirname, '..', '..', 'data_pipeline', 'clean_admin.py');
const SCORE_SCRIPT = process.env.SCORE_SCRIPT ||
    path.join(__dirname, '..', '..', 'data_pipeline', 'score_summaries.py');
const GEO_SCRIPT = process.env.GEO_SCRIPT ||
    path.join(__dirname, '..', '..', 'data_pipeline', 'geo_assign.py');
const RETRAIN_SCRIPT = process.env.RETRAIN_SCRIPT ||
    path.join(__dirname, '..', '..', 'data_pipeline', 'retrain.py');

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
        //เช็คว่ามี username นี้ในระบบหรือยัง
        const [existing] = await db.query('SELECT user_id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีใช้งานในระบบแล้ว' });
        }

        //เข้ารหัสรหัสผ่านก่อนบันทึก
        const hashedPassword = await bcrypt.hash(password, 10);

        //บันทึกลงตาราง users (กำหนด role เป็น admin หรือค่าที่ส่งมา)
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

            //อ่านสถิติจำนวนแถวที่ถูกตัดทิ้งตอนคลีน
            let cleanStats = {};
            try {
                cleanStats = JSON.parse(fs.readFileSync(`${outputPath}.stats.json`, 'utf8'));
            } catch (e) {
                //ไม่มีไฟล์สถิติก็ข้ามไป ไม่ให้การอัปโหลดล้มเหลว
            }

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
                        r.province_code = '';   //บันทึกเป็น NULL
                        const raw = String(r['จังหวัด'] ?? '').trim();
                        if (raw && raw !== 'ไม่ระบุ') unmatchedProvinces.add(raw);
                    }
                }
            }

            //เติมรหัสอำเภอ/ตำบล/ชื่อตำบล จากพิกัดด้วย polygon (point-in-polygon ผ่าน geo_assign.py)
            //ใช้เฉพาะเมื่อไฟล์ไม่มี subdistrict_code มาให้ และมีพิกัดครบ
            //ไม่ต้องใช้ province_code ในการหา เพราะ polygon บอกพื้นที่จากพิกัดโดยตรง
            let geoMatched = 0;   //แถวที่ได้รหัสตำบลทั้งหมด (polygon + nearest)
            let geoFar = 0;       //แถวที่พิกัดไม่ตกใน polygon ตำบลใด ต้องใช้ตำบลที่ใกล้ที่สุด (ไม่เกิน ~5 กม.)
            let geoDistrictOnly = 0; //ได้แค่รหัสอำเภอ
            let geoUnmatched = 0; //ไม่ได้อะไรเลย
            if ('latitude' in records[0] && 'longitude' in records[0]
                && !('subdistrict_code' in records[0])) {
                const geoPath = `${inputPath}_geo.csv`;
                try {
                    await execFileAsync(PYTHON_CMD, [GEO_SCRIPT, outputPath, geoPath],
                        { encoding: 'utf8', timeout: 120000 });
                } catch (e) {
                    const detail = String(e.stdout || e.stderr || e.message).trim();
                    return res.status(422).json({ success: false, message: `จับคู่พื้นที่จากพิกัดไม่สำเร็จ: ${detail}` });
                }

                //ใช้ผลจาก geo script แทน records เดิม (คอลัมน์เดิมครบ + รหัสพื้นที่ใหม่)
                const geoRecords = parse(fs.readFileSync(geoPath, 'utf8'),
                    { columns: true, skip_empty_lines: true, bom: true });
                fs.unlink(geoPath, () => {});

                for (let i = 0; i < records.length; i++) {
                    const g = geoRecords[i];
                    const r = records[i];
                    r.subdistrict_code = g.subdistrict_code;
                    r.district_code = g.district_code;
                    r.tambon = g.tambon;

                    if (g.geo_method === 'polygon') geoMatched += 1;
                    else if (g.geo_method === 'nearest') { geoMatched += 1; geoFar += 1; }
                    else if (g.geo_method === 'district_only') geoDistrictOnly += 1;
                    else geoUnmatched += 1;
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

            //กันข้อมูลซ้ำ: คีย์ที่ใช้ระบุว่าเป็นเหตุการณ์เดียวกัน
            const DEDUP_KEYS = ['latitude', 'longitude', 'year', 'month', 'day', 'hour', 'road_name', 'vehicle']
                .filter(k => useCols.includes(k));
            const canDedup = DEDUP_KEYS.length === 8;

            let rowsToInsert = records;
            let skippedDuplicates = 0;

            if (canDedup) {
                const keyOf = (r) => DEDUP_KEYS.map(k => {
                    const v = r[k];
                    //ตัวเลขเทียบเป็นตัวเลข กัน 18.66476 กับ 18.664760 ไม่ตรงกัน
                    return (['latitude', 'longitude', 'year', 'month', 'day', 'hour'].includes(k) && v !== '')
                        ? String(Number(v)) : String(v ?? '').trim();
                }).join('|');

                //1)ตัดซ้ำภายในไฟล์ (เก็บแถวแรก)
                const seen = new Set();
                const uniqueInFile = [];
                for (const r of records) {
                    const k = keyOf(r);
                    if (!seen.has(k)) { seen.add(k); uniqueInFile.push(r); }
                }

                //2)ตัดแถวที่มีอยู่ในตารางแล้ว (ดึงเฉพาะปีที่อยู่ในไฟล์)
                const years = [...new Set(uniqueInFile.map(r => Number(r.year)).filter(Number.isFinite))];
                const existing = new Set();
                if (years.length > 0) {
                    const [exRows] = await db.query(
                        `SELECT ${DEDUP_KEYS.map(k => `\`${k}\``).join(', ')}
                         FROM accidents WHERE year IN (?)`, [years]);
                    for (const r of exRows) existing.add(keyOf(r));
                }

                rowsToInsert = uniqueInFile.filter(r => !existing.has(keyOf(r)));
                skippedDuplicates = records.length - rowsToInsert.length;
            }

            //insert เป็นชุด ใน transaction (ถ้าพังกลางทางจะ rollback ทั้งหมด)
            const conn = await db.getConnection();
            let inserted = 0;
            try {
                await conn.beginTransaction();
                const colSql = useCols.map(c => `\`${c}\``).join(', ');

                for (let i = 0; i < rowsToInsert.length; i += 1000) {
                    const chunk = rowsToInsert.slice(i, i + 1000)
                        .map(r => useCols.map(c => (r[c] === '' ? null : r[c])));
                    const [result] = await conn.query(
                        `INSERT INTO accidents (${colSql}) VALUES ?`, [chunk]);
                    inserted += result.affectedRows;
                }

                await conn.commit();
            } catch (e) {
                await conn.rollback();
                throw e; //ส่งต่อให้ catch ด้านนอกตอบ error
            } finally {
                conn.release();
            }

            //คำนวณ risk_score ลง summaries เฉพาะปีที่อยู่ในไฟล์
            //ถ้าล้มเหลว ไม่ทำให้การอัปโหลดล้มเหลว (ข้อมูลเข้า accidents แล้ว)
            let scoreStatus = 'skipped';
            const yearsInFile = [...new Set(
                rowsToInsert.map(r => Number(r.year)).filter(Number.isFinite)
            )];
            if (inserted > 0 && yearsInFile.length > 0) {
                try {
                    await execFileAsync(PYTHON_CMD, [SCORE_SCRIPT, yearsInFile.join(',')],
                        { encoding: 'utf8', timeout: 120000 });
                    scoreStatus = 'ok';
                } catch (e) {
                    console.error('score error:', e.stdout || e.stderr || e.message);
                    scoreStatus = 'failed';
                }
            }

            res.json({
                success: true,
                inserted,
                totalRows: records.length,
                ignoredColumns,
                emptyColumns,
                unmatchedProvinces: [...unmatchedProvinces],
                geoMatched,
                geoFar,
                geoDistrictOnly,
                geoUnmatched,
                rawRows: cleanStats.raw_rows ?? null,
                dropped: {
                    badCoords: cleanStats.bad_coords ?? 0,
                    duplicates: cleanStats.duplicates ?? 0,
                    badDate: cleanStats.bad_date ?? 0
                },
                skippedDuplicates,
                dedupApplied: canDedup,
                scoreStatus,
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
            fs.unlink(`${outputPath}.stats.json`, () => {});
            fs.unlink(`${inputPath}_geo.csv`, () => {});
        }
    }
);

//ทดลองรีเทรนโมเดล (เฉพาะแอดมิน) 
//เทรนเบื้องหลัง ไม่ให้เทรนซ้อนกัน เก็บสถานะไว้ในหน่วยความจำ (หายเมื่อรีสตาร์ท backend)
//สคริปต์ retrain.py บันทึกโมเดลเป็นไฟล์ทดลองแยกต่างหาก ไม่แทนโมเดลที่เว็บใช้งานจริง
const RETRAIN_TIMEOUT_MS = 30 * 60 * 1000;
const RETRAIN_RESULT_PREFIX = 'RETRAIN_RESULT_JSON:';
let retrainState = { status: 'idle', startedAt: null, finishedAt: null, result: null, error: null };

const publicRetrainState = () => ({
    status: retrainState.status, //idle | running | done | failed
    startedAt: retrainState.startedAt,
    finishedAt: retrainState.finishedAt,
    durationSec: retrainState.finishedAt
        ? Math.round((retrainState.finishedAt - retrainState.startedAt) / 1000) : null,
    result: retrainState.result,
    error: retrainState.error
});

//กันรหัสผ่านฐานข้อมูลหลุดไปกับข้อความ error
const scrubSecrets = (text) => {
    const pw = process.env.DB_PASSWORD;
    return pw ? text.split(pw).join('***') : text;
};

router.post('/retrain', verifyToken, requireAdmin, (req, res) => {
    if (retrainState.status === 'running') {
        return res.status(409).json({
            success: false,
            message: 'กำลังเทรนอยู่ กรุณารอให้เสร็จก่อน',
            ...publicRetrainState()
        });
    }

    retrainState = { status: 'running', startedAt: Date.now(), finishedAt: null, result: null, error: null };

    execFile(PYTHON_CMD, [RETRAIN_SCRIPT], {
        cwd: path.dirname(RETRAIN_SCRIPT),
        encoding: 'utf8',
        timeout: RETRAIN_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    }, (err, stdout, stderr) => {
        const finishedAt = Date.now();
        const line = String(stdout || '').split(/\r?\n/).reverse()
            .find(l => l.startsWith(RETRAIN_RESULT_PREFIX));

        if (!err && line) {
            try {
                const result = JSON.parse(line.slice(RETRAIN_RESULT_PREFIX.length));
                retrainState = { ...retrainState, status: 'done', finishedAt, result, error: null };
                return;
            } catch (e) {
                //อ่านผลไม่ได้ ตกไปเป็น failed ด้านล่าง
            }
        }

        let detail;
        if (err && err.killed) {
            detail = 'เทรนนานเกินกำหนด (30 นาที) ระบบยกเลิกงานแล้ว';
        } else {
            detail = String(stderr || stdout || (err && err.message) || '')
                .trim().split(/\r?\n/).slice(-5).join('\n');
        }
        detail = scrubSecrets(detail).slice(-500) || 'เทรนไม่สำเร็จ';
        console.error('retrain error:', detail);
        retrainState = { ...retrainState, status: 'failed', finishedAt, result: null, error: detail };
    });

    res.status(202).json({ success: true, ...publicRetrainState() });
});

router.get('/retrain/status', verifyToken, requireAdmin, (req, res) => {
    res.json({ success: true, ...publicRetrainState() });
});

module.exports = router;