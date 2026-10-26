import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // จำกัดไฟล์ 10 MB

function AdminUpload() {
    //อัปโหลดไฟล์
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [warning, setWarning] = useState('');
    const [techDetail, setTechDetail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    //ทดลองรีเทรนโมเดล
    const [retrain, setRetrain] = useState({ status: 'idle', result: null, error: '', durationSec: null });
    const [retrainMsg, setRetrainMsg] = useState('');
    const [retrainBusy, setRetrainBusy] = useState(false); //กำลังส่งคำสั่งเริ่มเทรน
    const isTraining = retrain.status === 'running';

    const getAuthHeaders = () => {
        const token = localStorage.getItem('adminToken');
        return token ? { Authorization: `Bearer ${token}` } : null;
    };

    const applyRetrainState = (d) => setRetrain({
        status: d.status,
        result: d.result || null,
        error: d.error || '',
        durationSec: d.durationSec ?? null
    });

    //ถามสถานะจาก backend
    const fetchRetrainStatus = async () => {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
            const res = await axios.get(`${API_URL}/api/admin/retrain/status`, { headers });
            if (res.data.success) applyRetrainState(res.data);
        } catch (err) {
            console.error(err);
            if ([401, 403].includes(err.response?.status)) {
                //token หมดอายุ หยุดถามสถานะ
                setRetrainMsg('เซสชันหมดอายุ กรุณาเข้าสู่ระบบแอดมินใหม่');
                setRetrain((prev) => ({ ...prev, status: 'idle' }));
            }
        }
    };

    //เปิดหน้ามา ถามสถานะล่าสุดจาก backend 
    useEffect(() => {
        fetchRetrainStatus();
    }, []);

    //ระหว่างเทรน ถามสถานะทุก 3 วินาที จนกว่าจะเสร็จ
    useEffect(() => {
        if (!isTraining) return;
        const id = setInterval(fetchRetrainStatus, 3000);
        return () => clearInterval(id);
    }, [isTraining]);

    const handleRetrain = async () => {
        if (retrainBusy || isTraining) return;
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
                applyRetrainState(err.response.data);
                setRetrainMsg('กำลังเทรนอยู่แล้ว กรุณารอให้เสร็จ');
            } else {
                setRetrainMsg(err.response?.data?.message || 'สั่งเทรนไม่สำเร็จ');
            }
        } finally {
            setRetrainBusy(false);
        }
    };

    const fmt = (v, digits = 4) => (v === null || v === undefined ? '-' : Number(v).toFixed(digits));

    const clearAlerts = () => {
        setMessage('');
        setWarning('');
        setTechDetail('');
        setError('');
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0] || null);
        clearAlerts();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; //กันการกดซ้ำระหว่างรอ

        const form = e.currentTarget; //เก็บไว้ก่อน await เพราะหลัง await currentTarget จะเป็น null
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
            setError('ไฟล์ใหญ่เกิน 10 MB');
            return;
        }

        const token = localStorage.getItem('adminToken');
        if (!token) {
            setError('กรุณาเข้าสู่ระบบแอดมินก่อน');
            return;
        }

        const data = new FormData();
        data.append('file', file);

        setLoading(true);
        try {
            //ไม่ต้องตั้ง Content-Type เอง ให้ axios/browser ใส่ boundary ให้
            const response = await axios.post(`${API_URL}/api/admin/add-data`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
            const { inserted, totalRows, ignoredColumns = [], emptyColumns = [],
                    unmatchedProvinces = [], geoFar = 0, geoDistrictOnly = 0, geoUnmatched = 0,
                    rawRows = null, dropped = {},
                    skippedDuplicates = 0, dedupApplied = true, 
                    scoreStatus = 'skipped' } = response.data;

            if (inserted === 0) {
                setMessage('ไม่มีข้อมูลใหม่ ข้อมูลในไฟล์นี้มีอยู่ในระบบแล้วทั้งหมด');
            } else {
                setMessage(`เพิ่มข้อมูลสำเร็จ ${inserted} จาก ${totalRows} แถว (สามารถทดลองรีเทรนโมเดลด้วยข้อมูลล่าสุดได้ที่การ์ดด้านล่าง)`);
            }

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
            <div className="admin-form-container">
                <h2>เพิ่มไฟล์ข้อมูลอุบัติเหตุ</h2>

                {message && <p className="success-message">{message}</p>}
                {warning && <p className="warning-message">{warning}</p>}
                {error && <p className="error-message">{error}</p>}
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
                <h2>ทดลองรีเทรนโมเดล</h2>

                <p className="retrain-desc">
                    ให้โมเดล LightGBM เรียนรู้ใหม่จากข้อมูลอุบัติเหตุทั้งหมดในฐานข้อมูล แล้วแสดงผลวัดความแม่นยำ
                </p>
                <p className="retrain-note">
                    โมเดลที่ได้เป็นรุ่นทดลอง ไม่ได้แทนที่โมเดลหลักของระบบ หน้า Risk Prediction ยังใช้โมเดลหลักเป็นค่าเริ่มต้น 
                    และเลือกใช้รุ่นทดลองนี้ได้ หากข้อมูลปีล่าสุดยังไม่ครบปี ผลวัดอาจยังไม่สะท้อนความแม่นยำจริง ควรรีเทรนจริงเมื่อข้อมูลครบปี
                </p>

                {retrainMsg && <p className="error-message">{retrainMsg}</p>}

                <button
                    type="button"
                    className="retrain-btn"
                    onClick={handleRetrain}
                    disabled={isTraining || retrainBusy}
                >
                    {isTraining ? 'กำลังเทรนโมเดล...' : 'ทดลองรีเทรน'}
                </button>

                {isTraining && (
                    <p className="retrain-hint">
                        อาจใช้เวลาสองสามนาที ปิดหน้านี้ได้ ระบบจะเทรนต่อเบื้องหลัง
                    </p>
                )}

                {retrain.status === 'failed' && (
                    <p className="error-message" style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>
                        เทรนไม่สำเร็จ: {retrain.error}
                    </p>
                )}

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
        </>
    );
}

export default AdminUpload;