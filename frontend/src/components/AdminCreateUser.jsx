import { useState, useEffect } from "react";
import axios from "axios";
import { X, UserPlus, Trash2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MIN_PASSWORD_LENGTH = 8;
const NEW_USER_ROLE = 'admin';

//อ่าน userId ของคนที่ล็อกอินอยู่จาก token (ใช้ซ่อนปุ่มลบของตัวเอง ฝั่งเซิร์ฟเวอร์กันซ้ำอีกชั้น)
const getMyUserId = () => {
    try {
        const token = localStorage.getItem('adminToken');
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.userId;
    } catch {
        return null;
    }
};

const formatDate = (v) => {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d) ? '-' : d.toLocaleDateString('th-TH');
};

function AdminCreateUser() {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    //รายชื่อแอดมิน
    const [users, setUsers] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const fetchUsers = async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        setListLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) setUsers(res.data.users);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'โหลดรายชื่อแอดมินไม่สำเร็จ');
        } finally {
            setListLoading(false);
        }
    };

    //เปิดหน้าต่างแล้วโหลดรายชื่อ
    useEffect(() => {
        if (open) fetchUsers();
    }, [open]);

    //กด Esc เพื่อปิดหน้าต่าง
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (localStorage.getItem('adminRole') !== 'admin') return null;

    const myId = getMyUserId();

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setConfirmPassword('');
    };

    const closeModal = () => {
        setOpen(false);
        setMessage('');
        setError('');
        resetForm();
    };

    const handleDelete = async (u) => {
        if (deletingId) return;
        if (!window.confirm(`ต้องการลบแอดมิน "${u.username}" ใช่ไหม?\nลบแล้วกู้คืนไม่ได้`)) return;

        const token = localStorage.getItem('adminToken');
        if (!token) {
            setError('กรุณาเข้าสู่ระบบแอดมินก่อน');
            return;
        }

        setMessage('');
        setError('');
        setDeletingId(u.user_id);
        try {
            await axios.delete(`${API_URL}/api/admin/users/${u.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(`ลบแอดมิน "${u.username}" สำเร็จ`);
            await fetchUsers();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'ลบไม่สำเร็จ');
        } finally {
            setDeletingId(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setMessage('');
        setError('');

        const name = username.trim();
        if (!name) {
            setError('กรุณากรอกชื่อผู้ใช้');
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
            return;
        }
        if (password !== confirmPassword) {
            setError('รหัสผ่านและช่องยืนยันไม่ตรงกัน');
            return;
        }

        const token = localStorage.getItem('adminToken');
        if (!token) {
            setError('กรุณาเข้าสู่ระบบแอดมินก่อน');
            return;
        }

        setLoading(true);
        try {
            await axios.post(
                `${API_URL}/api/admin/register-admin`,
                { username: name, password, role: NEW_USER_ROLE },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(`เพิ่มแอดมิน "${name}" สำเร็จ`);
            resetForm();
            fetchUsers();
        } catch (err) {
            console.error(err);
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                setError(err.response?.data?.message || 'เซสชันหมดอายุหรือไม่มีสิทธิ์ กรุณาเข้าสู่ระบบแอดมินใหม่');
            } else {
                setError(err.response?.data?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="admin-add-wrap">
                <button
                    type="button"
                    className="admin-add-btn"
                    onClick={() => setOpen(true)}
                >
                    <UserPlus size={16} />
                    จัดการแอดมิน
                </button>
            </div>

            {open && (
                <div className="login-overlay" onClick={closeModal}>
                    <div className="login-container admin-manage-container" onClick={(e) => e.stopPropagation()}>
                        <div className="login-header">
                            <h2>จัดการแอดมิน</h2>
                            <button type="button" onClick={closeModal} className="login-close-btn" aria-label="ปิด">
                                <X size={20} />
                            </button>
                        </div>

                        {error && <div className="login-error-box">{error}</div>}
                        {message && <p className="success-message">{message}</p>}

                        <h3 className="admin-section-title">
                            รายชื่อแอดมิน ({users.length} คน)
                        </h3>
                        <div className="admin-user-list">
                            {listLoading && users.length === 0 ? (
                                <p className="admin-user-empty">กำลังโหลด...</p>
                            ) : (
                                <table className="admin-user-table">
                                    <thead>
                                        <tr>
                                            <th>ชื่อผู้ใช้</th>
                                            <th>สิทธิ์</th>
                                            <th>สร้างเมื่อ</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.user_id}>
                                                <td>
                                                    {u.username}
                                                    {u.user_id === myId && <span className="admin-me-tag">คุณ</span>}
                                                </td>
                                                <td>{u.role}</td>
                                                <td>{formatDate(u.created_at)}</td>
                                                <td>
                                                    {u.user_id !== myId && (
                                                        <button
                                                            type="button"
                                                            className="admin-delete-btn"
                                                            onClick={() => handleDelete(u)}
                                                            disabled={deletingId === u.user_id}
                                                            aria-label={`ลบ ${u.username}`}
                                                        >
                                                            <Trash2 size={14} />
                                                            ลบ
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <h3 className="admin-section-title">เพิ่มแอดมินใหม่</h3>
                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="input-group">
                                <label htmlFor="new-username">ชื่อผู้ใช้</label>
                                <input
                                    id="new-username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoComplete="off"
                                    required
                                    disabled={loading}
                                    className="login-input"
                                />
                            </div>
                            <div className="input-group">
                                <label htmlFor="new-password">รหัสผ่าน (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร)</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                    disabled={loading}
                                    className="login-input"
                                />
                            </div>
                            <div className="input-group">
                                <label htmlFor="new-password-confirm">ยืนยันรหัสผ่าน</label>
                                <input
                                    id="new-password-confirm"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                    disabled={loading}
                                    className="login-input"
                                />
                            </div>
                            <button type="submit" disabled={loading} className="login-submit-btn">
                                {loading ? 'กำลังเพิ่ม...' : 'เพิ่มแอดมิน'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default AdminCreateUser;