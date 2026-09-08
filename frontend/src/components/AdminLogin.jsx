import { useState } from "react";
import axios from 'axios';
import { X } from 'lucide-react';

const AdminLogin = ({ isOpen, onClose, onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if(!isOpen) return null;

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:5000/api/admin/login', {
                username,
                password
            });

            if(response.data.success) {
                localStorage.setItem('adminToken', response.data.token);
                localStorage.setItem('adminRole', response.data.role);

                setUsername('');
                setPassword('');
                if (onLoginSuccess) onLoginSuccess();
                onClose();
            }
        } catch (err) {
            if(err.response && err.response.data) {
                setError(err.response.data.message);
            } else {
                setError('Cannot connect with Server!!!')
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-overlay">
            <div className="login-container">
                <div className="login-header">
                    <h2>Admin Login</h2>
                    <button onClick={onClose} className="login-close-btn">
                        <X size={20} />
                    </button>
                </div>

                {error && <div className="login-error-box">{error}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="login-input"
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="login-input"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="login-submit-btn">
                        {loading ? 'กำลังเข้าสู่ระบบ...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;