import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import AdminCreateUser from "./AdminCreateUser";
import { getYearList } from "../api/apiService";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MAX_FILE_SIZE = 50 * 1024 * 1024; 

function AdminUpload() {
    //อัปโหลดไฟล์
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [warning, setWarning] = useState('');
    const [techDetail, setTechDetail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null); //สรุปข้อมูลที่เพิ่งเพิ่มเข้าระบบ

    //ทดลองรีเทรนโมเดล
    const [retrain, setRetrain] = useState({ status: 'idle', result: null, error: '', durationSec: null });
    const [retrainMsg, setRetrainMsg] = useState('');
    const [retrainBusy, setRetrainBusy] = useState(false); //กำลังส่งคำสั่งเริ่มเทรน
    const isTraining = retrain.status === 'running';

    //กำลังอัปโหลดหรือรีเทรนอยู่ ให้ล็อกหน้าจอและกันรีเฟรช
    const isLocked = loading || isTraining || retrainBusy;
    const lockText = (isTraining || retrainBusy)
        ? 'กำลังรีเทรนโมเดล...'
        : 'กำลังอัปโหลดและประมวลผลข้อมูล...';

    //ปีที่มีข้อมูลในระบบ (ใช้เช็กเงื่อนไขรีเทรนต้องมีอย่างน้อย 3 ปี)
    const [yearCount, setYearCount] = useState(null);
    const [yearList, setYearList] = useState([]);
    const canRetrain = yearCount !== null && yearCount >= 3;

    const fetchYearCount = async () => {
        try {
            const res = await getYearList();
            const list = res?.data || [];
            const years = list.map((item) => Number(item.year ?? item)).sort((a, b) => a - b);
            setYearList(years);
            setYearCount(years.length);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchYearCount();
    }, []);

    const getAuthHeaders = () => {
        const token = sessionStorage.getItem('adminToken');
        return token ? { Authorization: `Bearer ${token}` } : null;
    };

    const applyRetrainState = (d) => setRetrain({
        status: d.status,
        result: d.result || null,
        error: d.error || '',
        durationSec: d.durationSec ?? null
    });

    //ถามสถานะจาก backend (ใช้ตอน polling ระหว่างเทรน)
    const fetchRetrainStatus = async () => {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
            const res = await axios.get(`${API_URL}/api/admin/retrain/status`, { headers });
            if (res.data.success) applyRetrainState(res.data);
        } catch (err) {
            console.error(err);
            if ([401, 403].includes(err.response?.status)) {
                setRetrainMsg('เซสชันหมดอายุ กรุณาเข้าสู่ระบบแอดมินใหม่');
                setRetrain((prev) => ({ ...prev, status: 'idle' }));
            }
        }
    };

    //เปิดหน้ามา แสดงสถานะเฉพาะตอนกำลังเทรนอยู่ (ผลเก่า/error เก่าไม่ค้างหลังรีเฟรช)
    useEffect(() => {
        const initStatus = async () => {
            const headers = getAuthHeaders();
            if (!headers) return;
            try {
                const res = await axios.get(`${API_URL}/api/admin/retrain/status`, { headers });
                if (res.data.success && res.data.status === 'running') {
                    applyRetrainState(res.data);
                }
            } catch (err) {
                console.error(err);
            }
        };
        initStatus();
    }, []);

    //ระหว่างเทรน ถามสถานะทุก 3 วินาที จนกว่าจะเสร็จ
    useEffect(() => {
        if (!isTraining) return;
        const id = setInterval(fetchRetrainStatus, 3000);
        return () => clearInterval(id);
    }, [isTraining]);

    //ระหว่างอัปโหลด/รีเทรน กันรีเฟรชและปิดแท็บ
    useEffect(() => {
        if (!isLocked) return;

        const onBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = ''; //ให้เบราว์เซอร์ขึ้นกล่องยืนยันก่อนออกจากหน้า
        };
        const onKeyDown = (e) => {
            const k = e.key.toLowerCase();
            if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && k === 'r')) {
                e.preventDefault();
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isLocked]);

    const handleRetrain = async () => {
        if (retrainBusy || isTraining || loading) return;
        setRetrainMsg('');

        const headers = getAuthHeaders();
        if (!headers) {
            setRetrainMsg('กรุณาเข้าสู่ระบบแอดมินก่อน');
            return;
        }
        if (!window.confirm('ต้องการทดลองรีเทรนโมเดลใช่ไหม?\nการเทรนอาจใช้เวลาสักครู่ และเป็นโมเดลทดลอง ไม่กระทบผลพยากรณ์ที่ใช้งานอยู่')) {
            return;
        }

        setRetrainBusy(true);
        try {
            const res = await axios.post(`${API_URL}/api/admin/retrain`, {}, { headers });
            applyRetrainState(res.data);
        } catch (err) {
            if (err.response?.status === 409) {
                //409 อาจเป็นเพราะมีคนเทรนอยู่ หรือมีคนอัปโหลดอยู่ 
                setRetrainMsg(err.response?.data?.message || 'ระบบกำลังทำงานอื่นอยู่ กรุณารอให้เสร็จ');
                if (err.response.data?.status === 'running') applyRetrainState(err.response.data);
            } else {
                setRetrainMsg(err.response?.data?.message || 'สั่งเทรนไม่สำเร็จ');
            }
        } finally {
            setRetrainBusy(false);
        }
    };

    const fmt = (v, digits = 4) => (v === null || v === undefined ? '-' : Number(v).toFixed(digits));

    const formatRetrainError = (raw) => {
        const text = String(raw || '');

        if (text.includes('At least 3 distinct years')) {
            return {
                title: 'ยังรีเทรนโมเดลไม่ได้',
                message: 'ต้องมีข้อมูลอุบัติเหตุอย่างน้อย 3 ปีที่แตกต่างกันในฐานข้อมูล จึงจะรีเทรนได้',
                hint: 'กรุณาอัปโหลดไฟล์ข้อมูลเพิ่ม แล้วลองใหม่อีกครั้ง'
            };
        }

        return {
            title: 'รีเทรนโมเดลไม่สำเร็จ',
            message: 'เกิดข้อผิดพลาดระหว่างการรีเทรน',
            hint: 'กรุณาติดต่อผู้พัฒนา พร้อมแจ้งเวลาที่เกิดปัญหา'
        };
    };

    const clearAlerts = () => {
        setMessage('');
        setWarning('');
        setTechDetail('');
        setError('');
        setSummary(null);
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0] || null);
        clearAlerts();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; //กันการกดซ้ำระหว่างรอ

        const form = e.currentTarget; 
        clearAlerts();

        if(!file) {
            setError('กรุณาเลือกไฟล์ CSV ก่อนอัปโหลด');
            return;
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
            setError('รองรับเฉพาะไฟล์ .csv เท่านั้น');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setError('ไฟล์ใหญ่เกิน 50 MB');
            return;
        }

        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            setError('กรุณาเข้าสู่ระบบแอดมินก่อน');
            return;
        }

        const data = new FormData();
        data.append('file', file);

        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/admin/add-data`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const { inserted, totalRows, ignoredColumns = [], emptyColumns = [],
                        unmatchedProvinces = [], geoFar = 0, geoDistrictOnly = 0, geoUnmatched = 0,
                        rawRows = null, dropped = {},
                        skippedDuplicates = 0, dedupApplied = true, 
                        scoreStatus = 'skipped', summary: summaryData = null } = response.data;

                if (inserted === 0) {
                    setMessage('ไม่มีข้อมูลใหม่ ข้อมูลในไฟล์นี้มีอยู่ในระบบแล้วทั้งหมด');
                } else {
                    setMessage(`เพิ่มข้อมูลสำเร็จ ${inserted} จาก ${totalRows} แถว`);
                }

                setSummary(summaryData);
                fetchYearCount(); //อัปเดตรายการปี ให้ปุ่มรีเทรนปลดล็อกทันทีเมื่อครบ 3 ปี

                const notes = [];
                const techNotes = []; 

                const droppedTotal = (dropped.badCoords || 0) + (dropped.duplicates || 0) + (dropped.badDate || 0);
                if (rawRows !== null && droppedTotal > 0) {
                    const reasons = [];
                    if (dropped.badCoords) reasons.push(`พิกัดผิด/ว่าง ${dropped.badCoords}`);
                    if (dropped.duplicates) reasons.push(`แถวซ้ำ ${dropped.duplicates}`);
                    if (dropped.badDate) reasons.push(`วันที่อ่านไม่ได้ ${dropped.badDate}`);
                    notes.push(`ไฟล์มี ${rawRows} แถว ตัดทิ้ง ${droppedTotal} แถว (${reasons.join(', ')})`);
                }
                if (skippedDuplicates > 0) {
                    notes.push(`ข้ามแถวที่ซ้ำ ${skippedDuplicates} แถว (ซ้ำกันในไฟล์หรือมีอยู่ในระบบแล้ว)`);
                }
                if (!dedupApplied) {
                    notes.push('ไม่สามารถตรวจแถวซ้ำได้ เพราะไฟล์ขาดคอลัมน์ที่ใช้เทียบ');
                }
                if (unmatchedProvinces.length > 0) {
                    notes.push(`จังหวัดที่จับคู่รหัสไม่ได้: ${unmatchedProvinces.join(', ')}`);
                }
                if (geoFar > 0) {
                    notes.push(`${geoFar} แถวพิกัดไม่ตกในขอบเขตตำบลใด จึงใช้ตำบลที่ใกล้ที่สุดแทน (ไม่เกิน ~5 กม.)`);
                }
                if (geoDistrictOnly > 0) {
                    notes.push(`${geoDistrictOnly} แถวได้เฉพาะรหัสอำเภอ (ไม่ทราบตำบล)`);
                }
                if (geoUnmatched > 0) {
                    notes.push(`${geoUnmatched} แถวหาพื้นที่จากพิกัดไม่ได้`);
                }
                if (scoreStatus === 'failed') {
                    notes.push('บันทึกข้อมูลแล้ว แต่คำนวณคะแนนความเสี่ยงไม่สำเร็จ (แผนที่จะแสดง "ยังไม่มีคะแนน")');
                }
                if (ignoredColumns.length > 0) {
                    techNotes.push(`คอลัมน์ในไฟล์ที่ไม่มีในตาราง (ถูกข้าม): ${ignoredColumns.join(', ')}`);
                }
                if (emptyColumns.length > 0) {
                    techNotes.push(`คอลัมน์ในตารางที่ไฟล์ไม่มี (บันทึกเป็นค่าว่าง): ${emptyColumns.join(', ')}`);
                }

                setWarning(notes.join(' | '));
                setTechDetail(techNotes.join(' | '));

                setFile(null);
                form.reset();
            }
            
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AdminCreateUser />
            <div className="admin-form-container">
                <h2>เพิ่มไฟล์ข้อมูลอุบัติเหตุ</h2>

                {message && <p className="success-message">{message}</p>}
                {warning && <p className="warning-message">{warning}</p>}
                {error && <p className="error-message">{error}</p>}

                {summary && (
                    <div className="upload-summary">
                        <h3>สรุปข้อมูลที่เพิ่มเข้าระบบ</h3>
                        <ul>
                            <li>ช่วงวันที่: {summary.dateFrom} ถึง {summary.dateTo}</li>
                            <li>ปีที่พบในข้อมูล: {summary.years.length > 0 ? summary.years.join(', ') : '-'}</li>
                            <li>อุบัติเหตุ {summary.accidents.toLocaleString()} ครั้ง</li>
                            <li>ผู้เสียชีวิต {summary.deaths.toLocaleString()} ราย</li>
                            <li>ผู้บาดเจ็บ {summary.injuries.toLocaleString()} ราย</li>
                        </ul>

                        {summary.sampleRows.length > 0 && (
                            <>
                                <h4>ตัวอย่างข้อมูลที่เพิ่ม (10 แถวแรก)</h4>
                                <div className="upload-summary-scroll">
                                    <table className="upload-summary-table">
                                        <thead>
                                            <tr>
                                                {summary.sampleColumns.map((c) => <th key={c}>{c}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.sampleRows.map((row, i) => (
                                                <tr key={i}>
                                                    {row.map((v, j) => <td key={j}>{v}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {techDetail && (
                    <details>
                        <summary>รายละเอียดคอลัมน์ (สำหรับผู้ดูแลระบบ)</summary>
                        <p>{techDetail}</p>
                    </details>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>เลือกไฟล์ CSV: </label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            required
                            disabled={loading}
                            className="form-control"
                        />
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'กำลังประมวลผล...' : 'Upload'}
                    </button>
                </form>
            </div>

            <div className="admin-form-container retrain-card">
                <h2>รีเทรนโมเดล</h2>

                <p className="retrain-desc">
                    ให้โมเดล LightGBM เรียนรู้ใหม่จากข้อมูลอุบัติเหตุทั้งหมดในฐานข้อมูล แล้วแสดงผลวัดความแม่นยำ
                </p>
                <p className="retrain-note">
                    โมเดลที่ได้เป็นรุ่นทดลอง ไม่ได้แทนที่โมเดลหลักของระบบ หน้า Risk Prediction ยังใช้โมเดลหลักเป็นค่าเริ่มต้น 
                    และเลือกใช้รุ่นทดลองนี้ได้ หากข้อมูลปีล่าสุดยังไม่ครบปี ผลวัดอาจยังไม่สะท้อนความแม่นยำจริง ควรรีเทรนจริงเมื่อข้อมูลครบปี
                </p>

                {retrainMsg && <p className="error-message">{retrainMsg}</p>}

                {yearCount !== null && yearCount < 3 && (
                    <p className="warning-message">
                        ตอนนี้มีข้อมูล {yearCount} ปี
                        {yearList.length > 0 && ` (${yearList.join(', ')})`}
                        {' '}ต้องมีอย่างน้อย 3 ปีจึงจะรีเทรนได้
                    </p>
                )}

                <button
                    type="button"
                    className="retrain-btn"
                    onClick={handleRetrain}
                    disabled={isTraining || retrainBusy || loading || !canRetrain}
                >
                    {isTraining ? 'กำลังเทรนโมเดล...' : 'รีเทรนโมเดล'}
                </button>

                {isTraining && (
                    <p className="retrain-hint">
                        อาจใช้เวลาสองสามนาที กรุณารอที่หน้านี้จนกว่าจะเสร็จ
                    </p>
                )}

                {retrain.status === 'failed' && (() => {
                    const err = formatRetrainError(retrain.error);
                    return (
                        <div
                            style={{
                                marginTop: 16,
                                padding: '12px 16px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: 8,
                                color: '#991b1b'
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ {err.title}</div>
                            <div>{err.message}</div>
                            <div style={{ fontSize: 14, marginTop: 4, color: '#b91c1c' }}>{err.hint}</div>
                            <details style={{ marginTop: 8, fontSize: 12 }}>
                                <summary style={{ cursor: 'pointer' }}>รายละเอียดทางเทคนิค (สำหรับผู้พัฒนา)</summary>
                                <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{retrain.error}</pre>
                            </details>
                        </div>
                    );
                })()}

                {retrain.status === 'done' && retrain.result && (
                    <>
                        <table className="retrain-table">
                            <tbody>
                                <tr><th>ปีที่ใช้เทรน</th><td>{retrain.result.train_years.join(', ')}</td></tr>
                                <tr><th>ปีที่ใช้ทดสอบ</th><td>{retrain.result.test_years.join(', ')}</td></tr>
                                <tr>
                                    <th>จำนวนแถว (เทรน / ทดสอบ)</th>
                                    <td>{retrain.result.train_rows.toLocaleString()} / {retrain.result.test_rows.toLocaleString()}</td>
                                </tr>
                                <tr><th>Train R²</th><td>{fmt(retrain.result.train_r2)}</td></tr>
                                <tr><th>Test R²</th><td>{fmt(retrain.result.test_r2)}</td></tr>
                                <tr><th>MAE (ชุดทดสอบ)</th><td>{fmt(retrain.result.test_mae)}</td></tr>
                                <tr><th>RMSE (ชุดทดสอบ)</th><td>{fmt(retrain.result.test_rmse)}</td></tr>
                                <tr><th>เวลาที่ใช้</th><td>{retrain.durationSec ?? '-'} วินาที</td></tr>
                                <tr><th>ไฟล์โมเดลทดลอง</th><td>{retrain.result.model_file}</td></tr>
                            </tbody>
                        </table>
                        <p className="retrain-hint">R² ยิ่งใกล้ 1 ยิ่งดี ส่วน MAE และ RMSE ยิ่งต่ำยิ่งดี</p>
                    </>
                )}
            </div>

            {isLocked && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 99999,
                        background: 'rgba(15,23,42,0.8)', color: '#fff',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 12, textAlign: 'center', padding: 24
                    }}
                >
                    <div style={{ fontSize: 22, fontWeight: 700 }}>
                        {lockText}
                    </div>
                    <div style={{ fontSize: 16, opacity: 0.9 }}>
                        กรุณารอที่หน้านี้ อย่ารีเฟรช ปิดหน้าต่าง หรือกลับไปหน้าอื่นจนกว่าจะเสร็จ
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

export default AdminUpload;