import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB ต้องตรงกับ MAX_FILE_SIZE ฝั่ง backend

function AdminUpload() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [warning, setWarning] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const clearAlerts = () => {
        setMessage('');
        setWarning('');
        setError('');
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0] || null);
        clearAlerts();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; //กันการกดซ้ำระหว่างรอ

        const form = e.currentTarget; // เก็บไว้ก่อน await เพราะหลัง await currentTarget จะเป็น null
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
            // ไม่ต้องตั้ง Content-Type เอง ให้ axios/browser ใส่ boundary ให้
            const response = await axios.post(`${API_URL}/api/admin/add-data`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const { inserted, totalRows, ignoredColumns = [], emptyColumns = [],  unmatchedProvinces = [], geoFar = 0 } = response.data;
                setMessage(`เพิ่มข้อมูลสำเร็จ ${inserted} จาก ${totalRows} แถว`);

                const notes = [];
                if (ignoredColumns.length > 0) {
                    notes.push(`คอลัมน์ในไฟล์ที่ไม่มีในตาราง (ถูกข้าม): ${ignoredColumns.join(', ')}`);
                }
                if (emptyColumns.length > 0) {
                    notes.push(`คอลัมน์ในตารางที่ไฟล์ไม่มี (บันทึกเป็นค่าว่าง): ${emptyColumns.join(', ')}`);
                }

                if (unmatchedProvinces.length > 0) notes.push(`จังหวัดที่จับคู่รหัสไม่ได้: ${unmatchedProvinces.join(', ')}`);
                if (geoFar > 0) notes.push(`${geoFar} แถวมีตำบลที่ใกล้ที่สุดห่างเกิน 50 กม. (อาจไม่แม่น)`);
                setWarning(notes.join(' | '));

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
        <div className="admin-form-container">
            <h2>เพิ่มไฟล์ข้อมูลอุบัติเหตุ</h2>

            {message && <p className="success-message">{message}</p>}
            {warning && <p className="warning-message">{warning}</p>}
            {error && <p className="error-message">{error}</p>}

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
    );
}

export default AdminUpload;