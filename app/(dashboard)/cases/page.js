'use client';

import { useState, useEffect } from 'react';
import {
    Plus, Trash2, ChevronDown, ChevronRight, Send, Filter,
    AlertCircle, CheckCircle, Clock, Loader, X, MessageSquare, User
} from 'lucide-react';

export default function CasesPage() {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [expandedCase, setExpandedCase] = useState(null);
    const [toast, setToast] = useState(null);

    // New case form
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPriority, setNewPriority] = useState('medium');
    const [newAssignee, setNewAssignee] = useState('');

    // Progress form
    const [progressNote, setProgressNote] = useState('');
    const [progressStatus, setProgressStatus] = useState('');

    // Read user from session API
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => {
                if (data.user) {
                    setUser(data.user);
                    setNewAssignee(data.user.email);
                }
            })
            .catch(() => { });
    }, []);

    // Fetch cases
    const fetchCases = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const statusParam = filter !== 'all' ? `?status=${filter}` : '';
            const res = await fetch(`/api/cases${statusParam}`);
            const data = await res.json();
            setCases(data);
        } catch (e) {
            console.error('Failed to fetch cases', e);
        }
        if (!isBackground) setLoading(false);
    };

    useEffect(() => {
        fetchCases();
    }, [filter]);

    const showToast = (msg, type) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Create case
    const createCase = async () => {
        if (!newTitle.trim()) return;
        try {
            const res = await fetch('/api/cases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newTitle,
                    description: newDesc,
                    priority: newPriority,
                    assignee: newAssignee || user?.email,
                    createdBy: user?.email
                })
            });
            if (res.ok) {
                showToast('Case created!', 'success');
                setNewTitle(''); setNewDesc(''); setNewPriority('medium');
                setShowForm(false);
                fetchCases();
            }
        } catch (e) { showToast('Failed to create case', 'error'); }
    };

    // Add progress
    const addProgress = async (caseId) => {
        if (!progressNote.trim()) return;
        try {
            const body = { id: caseId, note: progressNote, by: user?.email };
            if (progressStatus) body.status = progressStatus;

            const res = await fetch('/api/cases', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                showToast('Progress updated!', 'success');
                setProgressNote(''); setProgressStatus('');
                fetchCases();
            }
        } catch (e) { showToast('Failed to update', 'error'); }
    };

    // Delete case
    const deleteCase = async (id) => {
        if (!confirm('ลบเคสนี้?')) return;
        try {
            const res = await fetch(`/api/cases?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Case deleted', 'success');
                fetchCases();
            }
        } catch (e) { showToast('Failed to delete', 'error'); }
    };

    // Helpers
    const getStatusStyle = (status) => {
        switch (status) {
            case 'open': return { color: '#58a6ff', bg: 'rgba(88,166,255,0.1)', border: 'rgba(88,166,255,0.3)' };
            case 'in-progress': return { color: '#e3b341', bg: 'rgba(227,179,65,0.1)', border: 'rgba(227,179,65,0.3)' };
            case 'resolved': return { color: '#3fb950', bg: 'rgba(63,185,80,0.1)', border: 'rgba(63,185,80,0.3)' };
            case 'closed': return { color: '#8b949e', bg: 'rgba(139,148,158,0.08)', border: 'rgba(139,148,158,0.2)' };
            default: return { color: '#8b949e', bg: 'transparent', border: 'transparent' };
        }
    };

    const getPriorityStyle = (p) => {
        switch (p) {
            case 'high': return { color: '#ff7b72', label: 'High' };
            case 'medium': return { color: '#e3b341', label: 'Medium' };
            case 'low': return { color: '#8b949e', label: 'Low' };
            default: return { color: '#8b949e', label: p };
        }
    };

    const formatDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
            d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const formatName = (email) => email ? email.split('@')[0] : '—';

    // Stats
    const openCount = cases.filter(c => c.status === 'open').length;
    const inProgressCount = cases.filter(c => c.status === 'in-progress').length;
    const resolvedCount = cases.filter(c => c.status === 'resolved' || c.status === 'closed').length;

    return (
        <div style={{ maxWidth: 900 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>Case Tracking</h1>
                    <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 4 }}>
                        Track and manage team tasks & issues
                    </p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={s.btnPrimary}>
                    {showForm ? <X size={14} /> : <Plus size={14} />}
                    {showForm ? 'Cancel' : 'New Case'}
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                <StatCard label="Open" value={openCount} color="#58a6ff" />
                <StatCard label="In Progress" value={inProgressCount} color="#e3b341" />
                <StatCard label="Resolved" value={resolvedCount} color="#3fb950" />
                <StatCard label="Total" value={cases.length} color="#c9d1d9" />
            </div>

            {/* New Case Form */}
            {showForm && (
                <div style={s.formCard}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', margin: '0 0 0.75rem 0' }}>
                        Create New Case
                    </h3>
                    <input
                        type="text" placeholder="Case title..."
                        value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        style={s.input}
                        onKeyDown={e => e.key === 'Enter' && createCase()}
                    />
                    <textarea
                        placeholder="Description (optional)..."
                        value={newDesc} onChange={e => setNewDesc(e.target.value)}
                        style={{ ...s.input, minHeight: '60px', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={s.select}>
                            <option value="low">Low Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="high">High Priority</option>
                        </select>
                        <input
                            type="text" placeholder="Assignee email"
                            value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
                            style={{ ...s.input, flex: 1, marginBottom: 0 }}
                        />
                        <button onClick={createCase} style={s.btnPrimary}>
                            <Send size={14} /> Create
                        </button>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {['all', 'open', 'in-progress', 'resolved', 'closed'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        ...s.filterBtn,
                        ...(filter === f ? { background: 'rgba(88,166,255,0.15)', color: '#58a6ff', borderColor: 'rgba(88,166,255,0.3)' } : {})
                    }}>
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
                    </button>
                ))}
            </div>

            {/* Cases List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#8b949e' }}>
                    <Loader size={20} className="spinning" /> Loading...
                </div>
            ) : cases.length === 0 ? (
                <div style={s.emptyState}>
                    <ClipboardIcon />
                    <p>No cases found</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {cases.map(c => {
                        const ss = getStatusStyle(c.status);
                        const ps = getPriorityStyle(c.priority);
                        const isExpanded = expandedCase === c.id;

                        return (
                            <div key={c.id} style={{
                                background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
                                borderLeft: `3px solid ${ss.color}`,
                                overflow: 'hidden'
                            }}>
                                {/* Case Header */}
                                <div
                                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                    onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                                >
                                    {isExpanded ? <ChevronDown size={16} style={{ color: '#8b949e', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: '#8b949e', flexShrink: 0 }} />}

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.65rem', color: '#8b949e', fontFamily: 'monospace' }}>{c.id}</span>
                                            <span style={{
                                                fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                                padding: '0.1rem 0.4rem', borderRadius: 4,
                                                color: ss.color, background: ss.bg, border: `1px solid ${ss.border}`
                                            }}>{c.status}</span>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: ps.color }}>● {ps.label}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {c.title}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '0.65rem', color: '#8b949e' }}>{formatDate(c.createdAt)}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                            <User size={10} /> {formatName(c.assignee)}
                                        </div>
                                    </div>

                                    <button onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }}
                                        style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', padding: '0.25rem', borderRadius: 4, flexShrink: 0 }}
                                        title="Delete case"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #30363d', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.15)' }}>
                                        {/* Description */}
                                        {c.description && (
                                            <p style={{ fontSize: '0.8rem', color: '#c9d1d9', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                                                {c.description}
                                            </p>
                                        )}

                                        {/* Progress Timeline */}
                                        {c.progress.length > 0 && (
                                            <div style={{ marginBottom: '0.75rem' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                                    Progress ({c.progress.length})
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    {c.progress.map((p, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
                                                            padding: '0.5rem 0.65rem', background: 'rgba(255,255,255,0.02)',
                                                            borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)',
                                                            borderLeft: '2px solid #30363d'
                                                        }}>
                                                            <MessageSquare size={12} style={{ color: '#8b949e', marginTop: 2, flexShrink: 0 }} />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '0.8rem', color: '#c9d1d9' }}>{p.note}</div>
                                                                <div style={{ fontSize: '0.65rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                                                    {formatName(p.by)} · {formatDate(p.at)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Add Progress Form */}
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                            <input
                                                type="text" placeholder="Add progress note..."
                                                value={expandedCase === c.id ? progressNote : ''}
                                                onChange={e => setProgressNote(e.target.value)}
                                                style={{ ...s.input, flex: 1, marginBottom: 0, fontSize: '0.8rem' }}
                                                onKeyDown={e => e.key === 'Enter' && addProgress(c.id)}
                                            />
                                            <select
                                                value={progressStatus}
                                                onChange={e => setProgressStatus(e.target.value)}
                                                style={{ ...s.select, fontSize: '0.75rem', padding: '0.4rem' }}
                                            >
                                                <option value="">No status change</option>
                                                <option value="in-progress">→ In Progress</option>
                                                <option value="resolved">→ Resolved</option>
                                                <option value="closed">→ Closed</option>
                                            </select>
                                            <button onClick={() => addProgress(c.id)} style={{ ...s.btnPrimary, padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
                                                <Send size={12} /> Update
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spinning { animation: spin 1s linear infinite; }
            `}</style>
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

function ClipboardIcon() {
    return <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>;
}

const s = {
    btnPrimary: {
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.45rem 0.85rem',
        borderRadius: 6, border: 'none', background: '#238636', color: '#fff',
        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    },
    formCard: {
        background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
        padding: '1rem 1.25rem', marginBottom: '1rem',
    },
    input: {
        width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#fff',
        padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.85rem', outline: 'none',
        fontFamily: 'inherit', marginBottom: '0.5rem', boxSizing: 'border-box',
    },
    select: {
        background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9',
        padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.82rem', outline: 'none',
    },
    filterBtn: {
        background: '#161b22', border: '1px solid #30363d', color: '#8b949e',
        padding: '0.3rem 0.65rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 500,
        cursor: 'pointer', textTransform: 'capitalize',
    },
    emptyState: {
        textAlign: 'center', padding: '3rem 1rem', color: '#8b949e',
        background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
    },
};
