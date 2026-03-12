'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import './login.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                router.push('/');
                router.refresh(); // Ensure the dashboard picks up the changes
            } else {
                const data = await res.json();
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('An error occurred during login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Dynamic Background Elements */}
            <div className="ambient-orb orb-1"></div>
            <div className="ambient-orb orb-2"></div>

            <div className="login-card glass-panel">
                <div className="login-header">
                    <div className="brand-badge">
                        <Lock className="brand-icon" size={28} />
                    </div>
                    <h1 className="login-title">Welcome Back</h1>
                    <p className="login-subtitle">Secure access to Classroom Monitor</p>
                </div>

                {error && (
                    <div className="error-alert">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={18} />
                            <input
                                id="email"
                                type="email"
                                required
                                placeholder="teacher@school.edu"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="premium-input"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={18} />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="premium-input"
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-actions">
                        <div className="remember-me">
                            <input type="checkbox" id="remember" className="premium-checkbox" />
                            <label htmlFor="remember">Remember me</label>
                        </div>
                        <a href="#" className="forgot-link">Forgot password?</a>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`login-btn ${isLoading ? 'loading' : ''}`}
                    >
                        {isLoading ? (
                            <span className="loader"></span>
                        ) : (
                            'Sign In securely'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
