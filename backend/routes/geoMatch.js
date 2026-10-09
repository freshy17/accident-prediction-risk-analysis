// จับคู่พิกัดอุบัติเหตุกับตำบลที่ใกล้ที่สุดภายในจังหวัดเดียวกัน
// subdistricts.code เป็นเลข 6 หลัก = จังหวัด(2) + อำเภอ(2) + ตำบล(2)
// จึงได้ province_code, district_code, subdistrict_code จากรหัสตำบลเดียว
// หมายเหตุ: เป็นค่าประมาณจากจุดกลางตำบล ไม่ใช่ขอบเขตจริง

const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

// rows: ผลจาก SELECT code, name_in_thai, latitude, longitude FROM subdistricts
function buildSubdistrictIndex(rows) {
    const byProvince = new Map();
    for (const r of rows) {
        const code = String(r.code ?? '').trim();
        const lat = toNum(r.latitude);
        const lon = toNum(r.longitude);
        if (code.length !== 6 || lat === null || lon === null) continue;
        const prov = code.slice(0, 2);
        if (!byProvince.has(prov)) byProvince.set(prov, []);
        byProvince.get(prov).push({ code, name: r.name_in_thai, lat, lon });
    }
    return byProvince;
}

// คืน null ถ้าหาไม่ได้ (ไม่มีรหัสจังหวัด / พิกัดไม่ถูกต้อง / จังหวัดไม่มีตำบลในตาราง)
function nearestSubdistrict(index, provinceCode, latitude, longitude) {
    const lat = toNum(latitude);
    const lon = toNum(longitude);
    if (lat === null || lon === null) return null;

    const prov = String(provinceCode ?? '').trim().padStart(2, '0');
    const list = index.get(prov);
    if (!list || list.length === 0) return null;

    const cosLat = Math.cos((lat * Math.PI) / 180);
    let best = null;
    let bestD = Infinity;
    for (const s of list) {
        const dy = s.lat - lat;
        const dx = (s.lon - lon) * cosLat;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
            bestD = d;
            best = s;
        }
    }

    return {
        subdistrict_code: best.code,
        district_code: best.code.slice(0, 4),
        tambon: best.name,
        distanceKm: Math.sqrt(bestD) * 111.32
    };
}

module.exports = { buildSubdistrictIndex, nearestSubdistrict };