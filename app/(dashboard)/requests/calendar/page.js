'use client';

import { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Loader, X, Calendar, Clock,
    User, Package, MapPin, FileText, CheckCircle, AlertCircle, Circle
} from 'lucide-react';

const STATUS_COLORS = {
    pending: { bg: '#fbbf2420', color: '#fbbf24', label: 'Pending' },
    approved: { bg: '#3fb95020', color: '#3fb950', label: 'Approved' },
    'in-progress': { bg: '#58a6ff20', color: '#58a6ff', label: 'In Progress' },
    completed: { bg: '#8b949e20', color: '#8b949e', label: 'Completed' },
    rejected: { bg: '#f8514920', color: '#f85149', label: 'Rejected' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function RequestsCalendarPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedReq, setSelectedReq] = useState(null);

    const fetchRequests = (isBg = false) => {
        if (!isBg) setLoading(true);
        fetch('/api/requests')
            .then(r => r.json())
            .then(data => {
                setRequests(Array.isArray(data) ? data : []);
                if (!isBg) setLoading(false);
            })
            .catch(() => { if (!isBg) setLoading(false); });
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    // Calendar logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const today = new Date();
    const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    // Map requests to dates based on usage/setup datetime (NOT creation date)
    const getRequestsForDay = (day) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return requests.filter(req => {
            const items = req.items || [];

            // If no items, we can't show it on a usage calendar
            if (items.length === 0) return false;

            // Check if any item's usage (or setup) date matches this day
            for (const item of items) {
                const targetDate = item.usageDatetime || item.setupDatetime;
                if (targetDate && targetDate.startsWith(dateStr)) {
                    return true;
                }
            }
            return false;
        });
    };

    // Build calendar grid (6 rows × 7 cols)
    const cells = [];
    for (let i = 0; i < 42; i++) {
        const day = i - startDow + 1;
        if (day < 1 || day > daysInMonth) {
            cells.push(null);
        } else {
            cells.push(day);
        }
    }

    // Stats
    const monthRequests = requests.filter(r => {
        const d = new Date(r.createdAt);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    if (loading) return (
        <div style={{ padding: '3rem', color: '#8b949e', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading calendar...
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );

    return (
        <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e6edf3', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Calendar size={24} color="#a78bfa" />
                        Requests Calendar
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: '#8b949e', margin: '4px 0 0' }}>
                        ปฏิทินการใช้อุปกรณ์และสถานที่
                    </p>
                </div>

                {/* Month stats */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {[
                        { label: 'This Month', val: monthRequests.length, color: '#a78bfa' },
                        { label: 'Pending', val: monthRequests.filter(r => r.status === 'pending').length, color: '#fbbf24' },
                        { label: 'Approved', val: monthRequests.filter(r => r.status === 'approved').length, color: '#3fb950' },
                    ].map(s => (
                        <div key={s.label} style={{
                            padding: '8px 14px', borderRadius: 10, background: '#161b22',
                            border: '1px solid #21262d', minWidth: 70, textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: '0.62rem', color: '#8b949e', marginTop: 1 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Month Navigation */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '1rem', background: '#161b22', border: '1px solid #21262d',
                borderRadius: 12, padding: '10px 16px',
            }}>
                <button onClick={prevMonth} style={navBtn}><ChevronLeft size={18} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#e6edf3', margin: 0 }}>
                        {MONTH_NAMES[month]} {year}
                    </h2>
                    <button onClick={goToday} style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #30363d',
                        background: '#21262d', color: '#c9d1d9', fontSize: '0.68rem', fontWeight: 500,
                        cursor: 'pointer',
                    }}>Today</button>
                </div>
                <button onClick={nextMonth} style={navBtn}><ChevronRight size={18} /></button>
            </div>

            {/* Calendar Grid */}
            <div style={{
                background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
                overflow: 'hidden',
            }}>
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #21262d' }}>
                    {DAY_NAMES.map(d => (
                        <div key={d} style={{
                            padding: '10px', textAlign: 'center', fontSize: '0.72rem',
                            fontWeight: 600, color: d === 'Sun' || d === 'Sat' ? '#f85149' : '#8b949e',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{d}</div>
                    ))}
                </div>

                {/* Day cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {cells.map((day, i) => {
                        const dayReqs = day ? getRequestsForDay(day) : [];
                        const isCurrentDay = day && isToday(day);
                        return (
                            <div key={i} style={{
                                minHeight: 100, padding: '6px 8px',
                                borderRight: (i + 1) % 7 !== 0 ? '1px solid #21262d' : 'none',
                                borderBottom: i < 35 ? '1px solid #21262d' : 'none',
                                background: !day ? '#0d1117' : isCurrentDay ? 'rgba(167,139,250,0.04)' : 'transparent',
                                position: 'relative',
                            }}>
                                {day && (
                                    <>
                                        <div style={{
                                            fontSize: '0.78rem', fontWeight: isCurrentDay ? 700 : 400,
                                            color: isCurrentDay ? '#a78bfa' : '#8b949e',
                                            marginBottom: 4,
                                            display: 'flex', alignItems: 'center', gap: 4,
                                        }}>
                                            {isCurrentDay && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa' }} />}
                                            {day}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {dayReqs.slice(0, 3).map((req, ri) => {
                                                const st = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
                                                return (
                                                    <button key={ri} onClick={() => setSelectedReq(req)}
                                                        style={{
                                                            display: 'block', width: '100%', textAlign: 'left',
                                                            padding: '3px 6px', borderRadius: 5, cursor: 'pointer',
                                                            background: st.bg, border: `1px solid ${st.color}30`,
                                                            fontSize: '0.62rem', color: st.color,
                                                            fontWeight: 500, lineHeight: 1.3,
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            transition: 'opacity 0.15s',
                                                        }}>
                                                        {req.email?.split('@')[0]}
                                                    </button>
                                                );
                                            })}
                                            {dayReqs.length > 3 && (
                                                <div style={{ fontSize: '0.58rem', color: '#8b949e', textAlign: 'center' }}>
                                                    +{dayReqs.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Upcoming list */}
            <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e6edf3', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color="#8b949e" /> Upcoming Requests
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {requests
                        .filter(r => {
                            if (r.status === 'completed' || r.status === 'rejected') return false;
                            const target = r.items?.[0]?.usageDatetime || r.items?.[0]?.setupDatetime;
                            return !!target; // Only show if they have a usage/setup date
                        })
                        .sort((a, b) => {
                            const aDate = a.items[0].usageDatetime || a.items[0].setupDatetime;
                            const bDate = b.items[0].usageDatetime || b.items[0].setupDatetime;
                            return new Date(aDate) - new Date(bDate);
                        })
                        .slice(0, 8)
                        .map(req => {
                            const st = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
                            const usageDate = req.items[0].usageDatetime || req.items[0].setupDatetime;
                            return (
                                <button key={req.id} onClick={() => setSelectedReq(req)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '12px 16px', background: '#161b22', border: '1px solid #21262d',
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                                        borderLeft: `3px solid ${st.color}`,
                                        transition: 'border-color 0.15s',
                                    }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#8b949e' }}>{req.id}</span>
                                            <span style={{
                                                padding: '1px 8px', borderRadius: 10, fontSize: '0.6rem', fontWeight: 600,
                                                background: st.bg, color: st.color, border: `1px solid ${st.color}30`,
                                            }}>{st.label}</span>
                                            <span style={{ fontSize: '0.68rem', color: '#8b949e' }}>· {req.subject}</span>
                                        </div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#c9d1d9' }}>
                                            {req.email?.split('@')[0]} — {req.items?.length || 0} item(s)
                                            {req.items?.[0]?.material && <span style={{ color: '#8b949e' }}> · {req.items[0].material}</span>}
                                        </div>
                                    </div>
                                    {usageDate && (
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: '0.68rem', color: '#8b949e' }}>Usage</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e6edf3' }}>
                                                {new Date(usageDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: '#8b949e' }}>
                                                {new Date(usageDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    {requests.filter(r => r.status !== 'completed' && r.status !== 'rejected').length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#484f58', fontSize: '0.82rem' }}>
                            ไม่มี request ที่รอดำเนินการ
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Detail Modal ─── */}
            {selectedReq && (() => {
                const r = selectedReq;
                const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                return (
                    <div onClick={() => setSelectedReq(null)} style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1rem',
                    }}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: '#161b22', border: '1px solid #30363d', borderRadius: 16,
                            width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            animation: 'fadeIn 0.2s ease',
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '18px 24px', borderBottom: '1px solid #21262d',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e6edf3' }}>{r.id}</span>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 600,
                                        background: st.bg, color: st.color, border: `1px solid ${st.color}30`,
                                    }}>{st.label}</span>
                                </div>
                                <button onClick={() => setSelectedReq(null)} style={{
                                    background: 'none', border: 'none', color: '#8b949e',
                                    cursor: 'pointer', padding: 4, borderRadius: 6,
                                }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '20px 24px' }}>
                                {/* Info grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                                    <InfoField icon={<User size={14} />} label="ผู้ขอ" value={r.email} />
                                    <InfoField icon={<FileText size={14} />} label="เรื่อง" value={r.subject} />
                                    <InfoField icon={<Calendar size={14} />} label="วันที่สร้าง" value={new Date(r.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                                    <InfoField icon={<Clock size={14} />} label="วัตถุประสงค์" value={(r.purpose || []).join(', ') || '-'} />
                                </div>

                                {r.detail && (
                                    <div style={{ padding: '12px 14px', background: '#0d1117', borderRadius: 10, border: '1px solid #21262d', marginBottom: 20 }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8b949e', marginBottom: 4 }}>รายละเอียด</div>
                                        <div style={{ fontSize: '0.82rem', color: '#c9d1d9', lineHeight: 1.5 }}>{r.detail}</div>
                                    </div>
                                )}

                                {/* Items */}
                                {r.items?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            อุปกรณ์ ({r.items.length} รายการ)
                                        </div>
                                        {r.items.map((item, idx) => (
                                            <div key={idx} style={{
                                                padding: '14px', background: '#0d1117', border: '1px solid #21262d',
                                                borderRadius: 10, marginBottom: 8,
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Package size={14} color="#a78bfa" />
                                                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e6edf3' }}>
                                                            {item.material || 'ไม่ระบุ'}
                                                        </span>
                                                    </div>
                                                    {item.quantity && (
                                                        <span style={{
                                                            padding: '2px 10px', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600,
                                                            background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                                                            border: '1px solid rgba(167,139,250,0.2)',
                                                        }}>×{item.quantity}</span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                    {item.setupDatetime && (
                                                        <div>
                                                            <div style={{ fontSize: '0.6rem', color: '#8b949e', marginBottom: 2 }}>Setup</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#c9d1d9' }}>
                                                                {new Date(item.setupDatetime).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {item.usageDatetime && (
                                                        <div>
                                                            <div style={{ fontSize: '0.6rem', color: '#8b949e', marginBottom: 2 }}>Usage</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#c9d1d9' }}>
                                                                {new Date(item.usageDatetime).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {item.location && (
                                                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <MapPin size={12} color="#8b949e" />
                                                        <span style={{ fontSize: '0.75rem', color: '#c9d1d9' }}>{item.location}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Admin notes */}
                                {r.adminNotes?.length > 0 && (
                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Notes
                                        </div>
                                        {r.adminNotes.map((n, ni) => (
                                            <div key={ni} style={{
                                                padding: '10px 14px', background: '#0d1117', borderRadius: 8,
                                                border: '1px solid #21262d', marginBottom: 6,
                                                borderLeft: '3px solid #58a6ff',
                                            }}>
                                                <div style={{ fontSize: '0.78rem', color: '#c9d1d9' }}>{n.note}</div>
                                                <div style={{ fontSize: '0.62rem', color: '#8b949e', marginTop: 4 }}>
                                                    {n.by} · {new Date(n.at).toLocaleString('th-TH')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

function InfoField({ icon, label, value }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ marginTop: 2, color: '#8b949e', flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#8b949e', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.78rem', color: '#c9d1d9', lineHeight: 1.3 }}>{value || '-'}</div>
            </div>
        </div>
    );
}

const navBtn = {
    background: 'none', border: '1px solid #30363d', borderRadius: 8,
    color: '#c9d1d9', cursor: 'pointer', padding: '6px 8px',
    display: 'flex', alignItems: 'center',
};
