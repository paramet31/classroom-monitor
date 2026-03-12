'use client';

import { useState, useEffect } from 'react';
import {
    Inbox, CheckCircle, Clock, AlertCircle, XCircle, Eye, X,
    User, MessageSquare, Send, Trash2, Filter, ChevronDown, ChevronRight
} from 'lucide-react';

export default function RequestsManagementPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedReq, setSelectedReq] = useState(null);
    const [user, setUser] = useState(null);
    const [note, setNote] = useState('');
    const [toast, setToast] = useState(null);

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUser(d.user); }).catch(() => { });
    }, []);

    const fetchRequests = async (isBg = false) => {
        if (!isBg) setLoading(true);
        const statusParam = filter !== 'all' ? `?status=${filter}` : '';
        const res = await fetch(`/api/requests${statusParam}`);
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
        if (!isBg) setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const showToast = (msg, type) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const updateStatus = async (id, status) => {
        const res = await fetch('/api/requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        if (res.ok) {
            showToast(`Status updated to ${status}`, 'success');
            fetchRequests();
            if (selectedReq?.id === id) {
                const updated = await res.json();
                setSelectedReq(updated);
            }
        }
    };

    const addNote = async (id) => {
        if (!note.trim()) return;
        const res = await fetch('/api/requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, note, noteBy: user?.email || 'admin' })
        });
        if (res.ok) {
            const updated = await res.json();
            setSelectedReq(updated);
            setNote('');
            fetchRequests();
            showToast('Note added', 'success');
        }
    };

    const deleteReq = async (id) => {
        if (!confirm('ลบคำร้องนี้?')) return;
        await fetch(`/api/requests?id=${id}`, { method: 'DELETE' });
        showToast('Deleted', 'success');
        setSelectedReq(null);
        fetchRequests();
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return { color: '#e3b341', bg: 'rgba(227,179,65,0.1)', icon: <Clock size={12} /> };
            case 'approved': return { color: '#58a6ff', bg: 'rgba(88,166,255,0.1)', icon: <CheckCircle size={12} /> };
            case 'in-progress': return { color: '#f0883e', bg: 'rgba(240,136,62,0.1)', icon: <Clock size={12} /> };
            case 'completed': return { color: '#3fb950', bg: 'rgba(63,185,80,0.1)', icon: <CheckCircle size={12} /> };
            case 'rejected': return { color: '#ff7b72', bg: 'rgba(255,123,114,0.1)', icon: <XCircle size={12} /> };
            default: return { color: '#8b949e', bg: 'transparent', icon: <Clock size={12} /> };
        }
    };

    const formatDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' '
            + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const formatName = (email) => email ? email.split('@')[0] : '—';

    // Stats
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved' || r.status === 'in-progress').length;
    const completed = requests.filter(r => r.status === 'completed').length;

    return (
        <div style={{ maxWidth: 1000 }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
                    padding: '0.6rem 1rem', borderRadius: 6, fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: toast.type === 'success' ? 'rgba(35,134,54,0.15)' : 'rgba(248,81,73,0.15)',
                    color: toast.type === 'success' ? '#3fb950' : '#ff7b72',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(35,134,54,0.35)' : 'rgba(248,81,73,0.35)'}`,
                }}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Inbox size={24} style={{ color: '#58a6ff' }} /> Equipment Requests
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 4 }}>
                    จัดการคำร้องขอใช้อุปกรณ์ / สถานที่
                </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                <StatCard label="Pending" value={pending} color="#e3b341" />
                <StatCard label="Active" value={approved} color="#58a6ff" />
                <StatCard label="Completed" value={completed} color="#3fb950" />
                <StatCard label="Total" value={requests.length} color="#c9d1d9" />
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {['all', 'pending', 'approved', 'in-progress', 'completed', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '0.3rem 0.65rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 500,
                        cursor: 'pointer', textTransform: 'capitalize',
                        background: filter === f ? 'rgba(88,166,255,0.15)' : '#161b22',
                        color: filter === f ? '#58a6ff' : '#8b949e',
                        border: `1px solid ${filter === f ? 'rgba(88,166,255,0.3)' : '#30363d'}`
                    }}>
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
                    </button>
                ))}
            </div>

            {/* Request List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#8b949e' }}>Loading...</div>
            ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#8b949e', background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}>
                    📭 No requests found
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {requests.map(r => {
                        const ss = getStatusStyle(r.status);
                        return (
                            <div key={r.id} onClick={() => setSelectedReq(r)} style={{
                                background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
                                borderLeft: `3px solid ${ss.color}`, padding: '0.75rem 1rem',
                                cursor: 'pointer', transition: 'background 0.15s',
                                display: 'flex', alignItems: 'center', gap: '0.75rem'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                onMouseLeave={e => e.currentTarget.style.background = '#161b22'}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.6rem', color: '#8b949e', fontFamily: 'monospace' }}>{r.id}</span>
                                        <span style={{
                                            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
                                            padding: '0.1rem 0.4rem', borderRadius: 4,
                                            color: ss.color, background: ss.bg, display: 'flex', alignItems: 'center', gap: 3
                                        }}>{ss.icon} {r.status}</span>
                                        <span style={{ fontSize: '0.6rem', color: '#8b949e' }}>· {r.subject}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#e6edf3', fontWeight: 500 }}>
                                        {formatName(r.email)} — {r.items?.length || 0} item(s)
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#8b949e', textAlign: 'right', flexShrink: 0 }}>
                                    {formatDate(r.createdAt)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail Modal */}
            {selectedReq && (() => {
                const r = selectedReq;
                const ss = getStatusStyle(r.status);
                return (
                    <div onClick={() => setSelectedReq(null)} style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        zIndex: 1000, backdropFilter: 'blur(4px)'
                    }}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
                            width: '92%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                        }}>
                            {/* Header */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#8b949e', fontFamily: 'monospace' }}>{r.id}</span>
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                            padding: '0.12rem 0.4rem', borderRadius: 4,
                                            color: ss.color, background: ss.bg
                                        }}>{r.status}</span>
                                    </div>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3', margin: 0 }}>{r.subject}</h2>
                                    <div style={{ fontSize: '0.72rem', color: '#8b949e', marginTop: 3 }}>
                                        จาก: {r.email} · {formatDate(r.createdAt)}
                                    </div>
                                </div>
                                <button onClick={() => setSelectedReq(null)}
                                    style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '1.25rem 1.5rem' }}>
                                {/* Status Actions */}
                                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    {['approved', 'in-progress', 'completed', 'rejected'].map(s => {
                                        const isCurrent = r.status === s;
                                        const sty = getStatusStyle(s);
                                        return (
                                            <button key={s} onClick={() => updateStatus(r.id, s)} disabled={isCurrent}
                                                style={{
                                                    padding: '0.3rem 0.6rem', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600,
                                                    cursor: isCurrent ? 'default' : 'pointer',
                                                    background: isCurrent ? sty.bg : 'transparent',
                                                    color: isCurrent ? sty.color : '#8b949e',
                                                    border: `1px solid ${isCurrent ? sty.color : '#30363d'}`,
                                                    opacity: isCurrent ? 1 : 0.7, textTransform: 'capitalize'
                                                }}>
                                                {s.replace('-', ' ')}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Purpose */}
                                {r.purpose?.length > 0 && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <div style={secLabel}>Purpose</div>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                            {r.purpose.map(p => (
                                                <span key={p} style={{
                                                    fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 4,
                                                    background: 'rgba(88,166,255,0.1)', color: '#58a6ff',
                                                    border: '1px solid rgba(88,166,255,0.2)'
                                                }}>{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detail */}
                                {r.detail && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <div style={secLabel}>Detail</div>
                                        <p style={{
                                            fontSize: '0.82rem', color: '#c9d1d9', margin: 0, lineHeight: 1.5,
                                            background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: 6
                                        }}>
                                            {r.detail}
                                        </p>
                                    </div>
                                )}

                                {/* Items */}
                                {r.items?.length > 0 && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <div style={secLabel}>Equipment ({r.items.length})</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {r.items.map((item, i) => (
                                                <div key={i} style={{
                                                    background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.75rem', borderRadius: 6,
                                                    border: '1px solid rgba(255,255,255,0.04)'
                                                }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e6edf3', marginBottom: '0.25rem' }}>
                                                        {item.material} {item.quantity ? `× ${item.quantity}` : ''}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: '#8b949e', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                        {item.setupDatetime && <span>Setup: {item.setupDatetime.replace('T', ' ')}</span>}
                                                        {item.usageDatetime && <span>Use: {item.usageDatetime.replace('T', ' ')}</span>}
                                                        {item.location && <span>📍 {item.location}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Notes */}
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div style={secLabel}>Team Notes ({r.adminNotes?.length || 0})</div>
                                    {r.adminNotes?.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                                            {r.adminNotes.map((n, i) => (
                                                <div key={i} style={{
                                                    padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.15)',
                                                    borderRadius: 6, borderLeft: '2px solid #30363d'
                                                }}>
                                                    <div style={{ fontSize: '0.8rem', color: '#c9d1d9' }}>{n.note}</div>
                                                    <div style={{ fontSize: '0.62rem', color: '#8b949e', marginTop: '0.15rem' }}>
                                                        {formatName(n.by)} · {formatDate(n.at)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <input type="text" value={note} onChange={e => setNote(e.target.value)}
                                            placeholder="Add note..." onKeyDown={e => e.key === 'Enter' && addNote(r.id)}
                                            style={{
                                                flex: 1, background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3',
                                                padding: '0.4rem 0.6rem', borderRadius: 6, fontSize: '0.8rem', outline: 'none'
                                            }} />
                                        <button onClick={() => addNote(r.id)} style={{
                                            padding: '0.4rem 0.6rem', borderRadius: 6, border: 'none',
                                            background: '#238636', color: '#fff', fontSize: '0.75rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 3
                                        }}>
                                            <Send size={12} /> Send
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-between' }}>
                                <button onClick={() => deleteReq(r.id)} style={{
                                    padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid rgba(255,123,114,0.3)',
                                    background: 'rgba(255,123,114,0.08)', color: '#ff7b72', fontSize: '0.75rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 4
                                }}>
                                    <Trash2 size={12} /> Delete
                                </button>
                                <button onClick={() => setSelectedReq(null)} style={{
                                    padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid #30363d',
                                    background: '#21262d', color: '#c9d1d9', fontSize: '0.75rem', cursor: 'pointer'
                                }}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace', color, lineHeight: 1.2 }}>{value}</div>
            <div style={{ fontSize: '0.65rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        </div>
    );
}

const secLabel = {
    fontSize: '0.62rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '0.4rem',
};
