import { useState } from "react";
import axios from "axios";

function AdminUpload() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if(!file) {
            setError('กรุณาเลือกไฟล์ CSV ก่อนอัปโหลด');
            return;
        }

        const data = new FormData();
        data.append('file', file);

        try {
            const token = localStorage.getItem('adminToken');

            const response = await axios.post('http://localhost:5000/api/admin/add-data', data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            if(response.data.success) {
                setMessage('เพิ่มข้อมูลและอัปโหลดไฟล์สำเร็จ');
                setFile(null);
                e.target.reset();
            }
            
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    return (
        <div className="admin-form-container">
            <h2>เพิ่มไฟล์ข้อมูลอุบัติเหตุ</h2>

            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>เลือกไฟล์ CSV: </label>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        required
                        className="form-control"
                    />
                </div>

                <button type="submit" className="submit-btn">
                    Upload
                </button>
            </form>
        </div>
    );
}

export default AdminUpload;