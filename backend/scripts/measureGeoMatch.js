require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');
const { buildSubdistrictIndex, nearestSubdistrict } = require('../routes/geoMatch');

const SAMPLE_SIZE = parseInt(process.argv[2], 10) || 5000;

(async () => {
    try {
        // 1) โหลดตำบลทั้งหมดสร้างดัชนี (เหมือนที่ใช้ตอนอัปโหลด)
        const [subRows] = await db.query(
            'SELECT code, name_in_thai, latitude, longitude FROM subdistricts'
        );
        const subIndex = buildSubdistrictIndex(subRows);

        // 2) สุ่มอุบัติเหตุเก่าที่มีรหัสและพิกัดครบ
        const [rows] = await db.query(
            `SELECT province_code, district_code, subdistrict_code, latitude, longitude, year
             FROM accidents
             WHERE year BETWEEN 2021 AND 2025
               AND province_code IS NOT NULL
               AND district_code IS NOT NULL
               AND latitude IS NOT NULL AND longitude IS NOT NULL
             ORDER BY RAND()
             LIMIT ?`, [SAMPLE_SIZE]
        );

        let total = 0, noMatch = 0;
        let distOk = 0, subOk = 0;
        let far50 = 0;
        const wrongByProv = {};
        const distances = [];

        for (const r of rows) {
            total += 1;
            const hit = nearestSubdistrict(subIndex, r.province_code, r.latitude, r.longitude);
            if (!hit) { noMatch += 1; continue; }

            distances.push(hit.distanceKm);
            if (hit.distanceKm > 50) far50 += 1;

            // เทียบแบบตัวเลข กันปัญหาชนิดข้อมูล (string/double)
            const trueDist = Number(r.district_code);
            const trueSub = Number(r.subdistrict_code);

            if (Number(hit.district_code) === trueDist) distOk += 1;
            else wrongByProv[r.province_code] = (wrongByProv[r.province_code] || 0) + 1;

            if (Number(hit.subdistrict_code) === trueSub) subOk += 1;
        }

        const matched = total - noMatch;
        const pct = (n) => (matched ? ((n / matched) * 100).toFixed(2) : '0.00');
        distances.sort((a, b) => a - b);
        const median = distances.length ? distances[Math.floor(distances.length / 2)].toFixed(2) : '-';

        console.log('========== ผลวัดความแม่นยำ geoMatch ==========');
        console.log(`สุ่มตัวอย่าง            : ${total} แถว`);
        console.log(`จับคู่ไม่ได้ (ไม่มีตำบล) : ${noMatch} แถว`);
        console.log(`แถวที่นำมาเทียบ         : ${matched} แถว`);
        console.log(`ความแม่นยำระดับอำเภอ    : ${pct(distOk)} %  (${distOk}/${matched})`);
        console.log(`ความแม่นยำระดับตำบล     : ${pct(subOk)} %  (${subOk}/${matched})`);
        console.log(`ระยะถึงตำบลที่จับคู่ (มัธยฐาน): ${median} กม.`);
        console.log(`แถวที่ห่างเกิน 50 กม.    : ${far50} แถว`);

        const worst = Object.entries(wrongByProv).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (worst.length) {
            console.log('\nจังหวัดที่ผิดระดับอำเภอบ่อยสุด (รหัสจังหวัด: จำนวนที่ผิด)');
            worst.forEach(([p, n]) => console.log(`  ${p}: ${n}`));
        }
    } catch (e) {
        console.error('error:', e);
    } finally {
        process.exit(0);
    }
})();