import { useState } from "react";
import axios from "axios";

function AdminUpload() {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
    });

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        try {
            const token = localStorage.getItem('adminToken');

            const response = await axios.post('http://localhost:5000/api/admin/add-data', formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if(response.data.success) {
                setMessage('เพิ่มข้อมูลสำเร็จ');
                setFormData({title: '', description: ''});
            }
            
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        }
    };

    return (
        <div className="admin-form-container">
            <h2>เพิ่มข้อมูลไฟล์อุบัติเหตุ</h2>

            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Title: </label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="form-control"
                    />
                </div>

                <div className="form-group">
                    <label>Description: </label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        required
                        rows="4"
                        className="form-control"
                    />
                </div>

                <button type="submit" className="submit-btn">
                    Save
                </button>
            </form>
        </div>
    );
}

export default AdminUpload;