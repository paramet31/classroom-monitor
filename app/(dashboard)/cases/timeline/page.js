'use client';

import { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle,
    Circle, Loader, ArrowLeft, X, User, MessageSquare, Calendar, Tag
} from 'lucide-react';
import Link from 'next/link';

export default function CaseTimelinePage() {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('week'); // day, week, month
    const [dateOffset, setDateOffset] = useState(0);
    const [selectedCase, setSelectedCase] = useState(null);
    const scrollRef = useRef(null);

    const fetchTimeline = (isBg = false) => {
        if (!isBg) setLoading(true);
        fetch('/api/cases?status=all')
            .then(r => r.json())
            .then(data => {
                setCases(Array.isArray(data) ? data : []);
                if (!isBg) setLoading(false);
            })
            .catch(() => { if (!isBg) setLoading(false); });
    };

    useEffect(() => {
        fetchTimeline();
    }, []);

    if (loading) return (
        <div style={{ padding: '3rem', color: '#8b949e', textAlign: 'center' }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading timeline...
        </div>
    );

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysToShow = viewMode === 'day' ? 7 : viewMode === 'week' ? 14 : 30;
    const dayWidth = viewMode === 'day' ? 120 : viewMode === 'week' ? 80 : 40;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - Math.floor(daysToShow / 2) + (dateOffset * daysToShow));

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysToShow);

    // Generate day columns
    const days = [];
    for (let i = 0; i < daysToShow; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        days.push(d);
    }

    // Sort cases by creation date
    const sortedCases = [...cases].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Get position and width for a case bar
    const getCaseBar = (c) => {
        const created = new Date(c.createdAt);
        created.setHours(0, 0, 0, 0);
        const resolved = c.resolvedAt ? new Date(c.resolvedAt) : new Date();
        resolved.setHours(23, 59, 59, 999);

        const startMs = startDate.getTime();
        const endMs = endDate.getTime();
        const totalMs = endMs - startMs;

        const barStartMs = Math.max(created.getTime(), startMs);
        const barEndMs = Math.min(resolved.getTime(), endMs);

        if (barEndMs < startMs || barStartMs > endMs) return null; // Case not visible

        const left = ((barStartMs - startMs) / totalMs) * 100;
        const width = Math.max(((barEndMs - barStartMs) / totalMs) * 100, 1.5);

        // Calculate days elapsed
        const daysElapsed = Math.ceil((resolved.getTime() - created.getTime()) / 86400000);

        return { left: `${left}%`, width: `${width}%`, daysElapsed };
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return { bg: '#1f6feb', border: '#388bfd', text: '#58a6ff' };
            case 'in-progress': return { bg: '#9e6a03', border: '#bb8009', text: '#e3b341' };
            case 'resolved': return { bg: '#238636', border: '#2ea043', text: '#3fb950' };
            case 'closed': return { bg: '#484f58', border: '#6e7681', text: '#8b949e' };
            default: return { bg: '#484f58', border: '#6e7681', text: '#8b949e' };
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'open': return <Circle size={10} />;
            case 'in-progress': return <Clock size={10} />;
            case 'resolved': return <CheckCircle size={10} />;
            case 'closed': return <CheckCircle size={10} />;
            default: return <Circle size={10} />;
        }
    };

    const formatName = (email) => email ? email.split('@')[0] : '—';

    const isToday = (d) => {
        const t = new Date();
        return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    };

    const rangeLabel = `${startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(endDate.getTime() - 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <Link href="/cases" style={{ color: '#8b949e', display: 'flex', alignItems: 'center' }}>
                            <ArrowLeft size={18} />
                        </Link>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>Case Timeline</h1>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 2 }}>
                        Visual overview of case progress — Admin only
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {/* View mode toggle */}
                    {['day', 'week', 'month'].map(m => (
                        <button key={m} onClick={() => { setViewMode(m); setDateOffset(0); }} style={{
                            padding: '0.3rem 0.6rem', borderRadius: 5, border: '1px solid #30363d',
                            background: viewMode === m ? '#388bfd' : '#161b22',
                            color: viewMode === m ? '#fff' : '#8b949e',
                            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize'
                        }}>
                            {m}
                        </button>
                    ))}

                    <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 0.25rem' }} />

                    {/* Navigation */}
                    <button onClick={() => setDateOffset(prev => prev - 1)} style={navBtn}>
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '0.75rem', color: '#c9d1d9', fontWeight: 500, minWidth: '140px', textAlign: 'center' }}>
                        {rangeLabel}
                    </span>
                    <button onClick={() => setDateOffset(prev => prev + 1)} style={navBtn}>
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={() => setDateOffset(0)} style={{ ...navBtn, fontSize: '0.65rem', padding: '0.25rem 0.5rem', color: '#58a6ff' }}>
                        Today
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {['open', 'in-progress', 'resolved', 'closed'].map(s => {
                    const sc = getStatusColor(s);
                    return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: sc.text }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: sc.bg, border: `1px solid ${sc.border}` }} />
                            {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
                        </div>
                    );
                })}
            </div>

            {/* Timeline */}
            <div style={{
                background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
                overflow: 'hidden'
            }}>
                {/* Day headers */}
                <div style={{ display: 'flex', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 2 }}>
                    {/* Label col */}
                    <div style={{
                        minWidth: 180, maxWidth: 180, padding: '0.5rem 0.75rem',
                        background: '#0d1117', borderRight: '1px solid #30363d',
                        fontSize: '0.65rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center'
                    }}>
                        Cases ({sortedCases.length})
                    </div>
                    {/* Day columns */}
                    <div ref={scrollRef} style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
                        {days.map((d, i) => {
                            const isTodayCol = isToday(d);
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            return (
                                <div key={i} style={{
                                    minWidth: dayWidth, flex: `0 0 ${dayWidth}px`,
                                    padding: '0.4rem 0.25rem', textAlign: 'center',
                                    borderRight: '1px solid rgba(48,54,61,0.5)',
                                    background: isTodayCol ? 'rgba(56,139,253,0.08)' : isWeekend ? 'rgba(0,0,0,0.15)' : '#0d1117',
                                    borderBottom: isTodayCol ? '2px solid #388bfd' : 'none'
                                }}>
                                    <div style={{ fontSize: '0.55rem', color: '#8b949e', fontWeight: 500, textTransform: 'uppercase' }}>
                                        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace',
                                        color: isTodayCol ? '#58a6ff' : '#c9d1d9'
                                    }}>
                                        {d.getDate()}
                                    </div>
                                    <div style={{ fontSize: '0.5rem', color: '#484f58' }}>
                                        {d.toLocaleDateString('en-GB', { month: 'short' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Case rows */}
                {sortedCases.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', fontSize: '0.85rem' }}>
                        No cases to display
                    </div>
                ) : (
                    sortedCases.map(c => {
                        const bar = getCaseBar(c);
                        const sc = getStatusColor(c.status);

                        return (
                            <div key={c.id} style={{
                                display: 'flex', borderBottom: '1px solid rgba(48,54,61,0.4)',
                                minHeight: 52,
                            }}>
                                {/* Case label — clickable */}
                                <div
                                    onClick={() => setSelectedCase(c)}
                                    style={{
                                        minWidth: 180, maxWidth: 180, padding: '0.5rem 0.75rem',
                                        borderRight: '1px solid #30363d', background: '#0d1117',
                                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                        gap: '0.15rem', cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#0d1117'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ color: sc.text }}>{getStatusIcon(c.status)}</span>
                                        <span style={{
                                            fontSize: '0.75rem', fontWeight: 600, color: '#e6edf3',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            maxWidth: 130
                                        }}>
                                            {c.title}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#8b949e', display: 'flex', gap: '0.5rem' }}>
                                        <span>{c.id}</span>
                                        <span>· {formatName(c.assignee)}</span>
                                    </div>
                                </div>

                                {/* Timeline bar area */}
                                <div style={{
                                    flex: 1, position: 'relative', overflow: 'hidden',
                                    minWidth: dayWidth * daysToShow
                                }}>
                                    {/* Today line */}
                                    {(() => {
                                        const todayMs = today.getTime();
                                        const startMs = startDate.getTime();
                                        const endMs = endDate.getTime();
                                        if (todayMs >= startMs && todayMs <= endMs) {
                                            const pos = ((todayMs - startMs) / (endMs - startMs)) * 100;
                                            return (
                                                <div style={{
                                                    position: 'absolute', left: `${pos}%`, top: 0, bottom: 0,
                                                    width: 1, background: 'rgba(56,139,253,0.3)', zIndex: 1
                                                }} />
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Case bar — clickable */}
                                    {bar && (
                                        <div
                                            onClick={() => setSelectedCase(c)}
                                            style={{
                                                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                                left: bar.left, width: bar.width,
                                                height: 24, borderRadius: 6,
                                                background: `linear-gradient(135deg, ${sc.bg}, ${sc.border})`,
                                                border: `1px solid ${sc.border}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                padding: '0 0.4rem', cursor: 'pointer',
                                                zIndex: 2, minWidth: 36,
                                                boxShadow: `0 1px 3px rgba(0,0,0,0.3)`,
                                                transition: 'filter 0.15s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
                                            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                                            title="Click to view details"
                                        >
                                            <span style={{
                                                fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.4)'
                                            }}>
                                                {bar.daysElapsed}d
                                            </span>
                                        </div>
                                    )}

                                    {/* Progress dots */}
                                    {c.progress?.map((p, i) => {
                                        const pDate = new Date(p.at);
                                        const startMs = startDate.getTime();
                                        const endMs = endDate.getTime();
                                        if (pDate.getTime() < startMs || pDate.getTime() > endMs) return null;
                                        const pos = ((pDate.getTime() - startMs) / (endMs - startMs)) * 100;
                                        return (
                                            <div key={i} title={`${p.note}\n— ${formatName(p.by)} · ${new Date(p.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
                                                style={{
                                                    position: 'absolute', left: `${pos}%`, bottom: 4,
                                                    width: 6, height: 6, borderRadius: '50%',
                                                    background: '#fff', border: `1.5px solid ${sc.border}`,
                                                    zIndex: 3, transform: 'translateX(-50%)',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Case Detail Modal */}
            {selectedCase && (() => {
                const c = selectedCase;
                const sc = getStatusColor(c.status);
                const created = new Date(c.createdAt);
                const resolved = c.resolvedAt ? new Date(c.resolvedAt) : null;
                const daysElapsed = Math.ceil(((resolved || new Date()).getTime() - created.getTime()) / 86400000);

                return (
                    <div
                        onClick={() => setSelectedCase(null)}
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            zIndex: 1000, backdropFilter: 'blur(4px)'
                        }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
                                width: '90%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                            }}
                        >
                            {/* Modal header */}
                            <div style={{
                                padding: '1.25rem 1.5rem', borderBottom: '1px solid #30363d',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#8b949e', fontFamily: 'monospace' }}>{c.id}</span>
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                            padding: '0.12rem 0.45rem', borderRadius: 4,
                                            color: sc.text, background: sc.bg, border: `1px solid ${sc.border}`
                                        }}>{c.status}</span>
                                    </div>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e6edf3', margin: 0, lineHeight: 1.3 }}>
                                        {c.title}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setSelectedCase(null)}
                                    style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '0.25rem', borderRadius: 6 }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal body */}
                            <div style={{ padding: '1.25rem 1.5rem' }}>
                                {/* Info grid */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                                    gap: '0.75rem', marginBottom: '1.25rem'
                                }}>
                                    <InfoItem icon={<User size={14} />} label="Assignee" value={formatName(c.assignee)} />
                                    <InfoItem icon={<Tag size={14} />} label="Priority" value={c.priority?.toUpperCase()} valueColor={
                                        c.priority === 'high' ? '#ff7b72' : c.priority === 'medium' ? '#e3b341' : '#8b949e'
                                    } />
                                    <InfoItem icon={<Calendar size={14} />} label="Created" value={created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + created.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} />
                                    <InfoItem icon={<Clock size={14} />} label="Duration" value={`${daysElapsed} day(s)`} valueColor={daysElapsed > 3 ? '#ff7b72' : '#3fb950'} />
                                    {resolved && (
                                        <InfoItem icon={<CheckCircle size={14} />} label="Resolved" value={resolved.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + resolved.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} valueColor="#3fb950" />
                                    )}
                                    <InfoItem icon={<User size={14} />} label="Created by" value={formatName(c.createdBy)} />
                                </div>

                                {/* Description */}
                                {c.description && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={sectionLabel}>Description</div>
                                        <p style={{
                                            fontSize: '0.82rem', color: '#c9d1d9', margin: 0, lineHeight: 1.6,
                                            background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 6,
                                            border: '1px solid rgba(255,255,255,0.04)'
                                        }}>
                                            {c.description}
                                        </p>
                                    </div>
                                )}

                                {/* Progress Timeline */}
                                <div>
                                    <div style={sectionLabel}>Progress Timeline ({c.progress?.length || 0})</div>
                                    {(!c.progress || c.progress.length === 0) ? (
                                        <p style={{ fontSize: '0.8rem', color: '#484f58', fontStyle: 'italic' }}>No progress notes yet</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                            {c.progress.map((p, i) => {
                                                const pDate = new Date(p.at);
                                                const isLast = i === c.progress.length - 1;
                                                return (
                                                    <div key={i} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                                                        {/* Vertical line + dot */}
                                                        <div style={{
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                            width: 20, flexShrink: 0
                                                        }}>
                                                            <div style={{
                                                                width: 10, height: 10, borderRadius: '50%',
                                                                background: isLast ? sc.bg : '#30363d',
                                                                border: `2px solid ${isLast ? sc.border : '#484f58'}`,
                                                                zIndex: 1, marginTop: 4, flexShrink: 0
                                                            }} />
                                                            {!isLast && (
                                                                <div style={{ width: 2, flex: 1, background: '#30363d', minHeight: 20 }} />
                                                            )}
                                                        </div>
                                                        {/* Content */}
                                                        <div style={{ flex: 1, paddingBottom: isLast ? 0 : '0.75rem' }}>
                                                            <div style={{ fontSize: '0.82rem', color: '#e6edf3', lineHeight: 1.4 }}>
                                                                {p.note}
                                                            </div>
                                                            <div style={{ fontSize: '0.65rem', color: '#8b949e', marginTop: '0.2rem', display: 'flex', gap: '0.5rem' }}>
                                                                <span>{formatName(p.by)}</span>
                                                                <span>·</span>
                                                                <span>{pDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {pDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setSelectedCase(null)} style={{
                                    padding: '0.45rem 1rem', borderRadius: 6, border: '1px solid #30363d',
                                    background: '#21262d', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer'
                                }}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Stats footer */}
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.72rem', color: '#8b949e', flexWrap: 'wrap' }}>
                <span>Total: <strong style={{ color: '#c9d1d9' }}>{cases.length}</strong> cases</span>
                <span>Open: <strong style={{ color: '#58a6ff' }}>{cases.filter(c => c.status === 'open').length}</strong></span>
                <span>In Progress: <strong style={{ color: '#e3b341' }}>{cases.filter(c => c.status === 'in-progress').length}</strong></span>
                <span>Resolved: <strong style={{ color: '#3fb950' }}>{cases.filter(c => c.status === 'resolved' || c.status === 'closed').length}</strong></span>
            </div>

            <style jsx>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

const navBtn = {
    background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9',
    padding: '0.25rem', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center',
};

const sectionLabel = {
    fontSize: '0.65rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '0.5rem',
};

function InfoItem({ icon, label, value, valueColor = '#c9d1d9' }) {
    return (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', color: '#8b949e', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                {icon} {label}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: valueColor }}>{value}</div>
        </div>
    );
}
