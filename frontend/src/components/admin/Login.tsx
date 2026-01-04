import React from 'react';
import '../../styles/admin.css';

interface LoginProps {
    password: string;
    setPassword: (pwd: string) => void;
    handleLogin: (e: React.FormEvent) => Promise<void>;
    loading: boolean;
    error: string | null;
}

export const AdminLogin: React.FC<LoginProps> = ({
    password,
    setPassword,
    handleLogin,
    loading,
    error
}) => {
    return (
        <div className="login-container">
            <div className="login-box">
                <h2>Admin Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter admin password"
                            disabled={loading}
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};
