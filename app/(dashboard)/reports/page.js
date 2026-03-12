'use client';

import { useState, useEffect } from 'react';
import { Send, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, FileText, Download, ChevronDown, ChevronRight } from 'lucide-react';

export default function ReportsPage() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState(null);
    const [expandedFloors, setExpandedFloors] = useState({});

    // History State
    const [availableDates, setAvailableDates] = useState([]);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [selectedDate, setSelectedDate] = useState('today');
    const [selectedTime, setSelectedTime] = useState('');

    useEffect(() => {
        fetchAvailableDates();
        fetchData();
    }, []);

    const fetchAvailableDates = async () => {
        try {
            console.log('[Reports] Fetching available dates...');
            const res = await fetch('/api/history/dates');
            const data = await res.json();
            console.log('[Reports] Available dates received:', data);
            if (data.dates) setAvailableDates(data.dates);
        } catch (e) {
            console.error('[Reports] Failed to fetch available dates', e);
        }
    };

    const fetchAvailableTimes = async (dateStr) => {
        if (!dateStr || dateStr === 'today') {
            setAvailableTimes([]);
            setSelectedTime('');
            return;
        }
        try {
            console.log(`[Reports] Fetching times for ${dateStr}...`);
            const res = await fetch(`/api/history/times?date=${dateStr}`);
            const data = await res.json();
            console.log(`[Reports] Times received for ${dateStr}:`, data);
            if (data.times) {
                setAvailableTimes(data.times);
                setSelectedTime(data.times[0] || ''); // auto-select newest
                fetchData(dateStr, data.times[0]);
            }
        } catch (e) {
            console.error('[Reports] Failed to fetch available times', e);
        }
    };

    const handleDateChange = (e) => {
        const val = e.target.value;
        setSelectedDate(val);
        if (val === 'today') {
            fetchAvailableTimes('today');
            fetchData('today');
        } else {
            fetchAvailableTimes(val);
        }
    };

    const handleTimeChange = (e) => {
        const val = e.target.value;
        setSelectedTime(val);
        fetchData(selectedDate, val);
    };

    const fetchData = async (overrideDate = selectedDate, overrideTime = selectedTime) => {
        setLoading(true);
        try {
            let apiUrl = '/api/status?campus=RS';
            if (overrideDate !== 'today' && overrideTime) {
                apiUrl = `/api/history/snapshot?date=${overrideDate}&time=${overrideTime}`;
            }

            const res = await fetch(apiUrl);
            const data = await res.json();
            const roomsData = data.rooms || data; // handle both array and {rooms: []} formats

            setRooms(roomsData);

            // Auto-expand all floors
            const floors = {};
            roomsData.forEach(r => {
                const f = getFloor(r.id);
                floors[f] = true;
            });
            setExpandedFloors(floors);
        } catch (e) {
            console.error('Failed to fetch', e);
        }
        setLoading(false);
    };

    const sendReport = async () => {
        if (!rooms.length) return;
        setSending(true);
        try {
            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rooms, campus: 'RS' })
            });
            const result = await res.json();
            if (res.ok) {
                showToast('Report sent to team successfully!', 'success');
            } else {
                showToast(result.error || 'Failed to send', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
        setSending(false);
    };

    const showToast = (msg, type) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const getFloor = (id) => {
        if (id.startsWith('3')) return 'Building 3';
        const parts = id.split('-');
        if (parts.length === 2) {
            const num = parts[1];
            return `Floor ${num[0]}`;
        }
        return 'Other';
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'Active': return { color: '#3fb950', bg: 'rgba(35,134,54,0.1)', icon: <CheckCircle size={14} /> };
            case 'Stopped': return { color: '#e3b341', bg: 'rgba(210,153,34,0.1)', icon: <AlertTriangle size={14} /> };
            case 'Bad Recording': return { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: <AlertTriangle size={14} /> };
            case 'No Record': return { color: '#ff7b72', bg: 'rgba(248,81,73,0.1)', icon: <XCircle size={14} /> };
            default: return { color: '#8b949e', bg: 'rgba(139,148,158,0.08)', icon: <Clock size={14} /> };
        }
    };

    const toggleFloor = (floor) => {
        setExpandedFloors(prev => ({ ...prev, [floor]: !prev[floor] }));
    };

    const downloadCSV = () => {
        const headers = ['Room', 'Status', 'Last Update', 'File', 'Size', 'Server', 'Schedule'];
        const rows = rooms.map(r => [
            r.id,
            r.recordFile,
            r.lastRecorded || '',
            r.fileName || '',
            r.fileSize || '',
            r.activeServer || '',
            r.isScheduled ? 'In Session' : 'Free'
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Stats
    const activeCount = rooms.filter(r => r.recordFile === 'Active').length;
    const stoppedCount = rooms.filter(r => r.recordFile === 'Stopped').length;
    const errorCount = rooms.filter(r => ['No Record', 'Error', 'Bad Recording'].includes(r.recordFile)).length;
    const idleCount = rooms.filter(r => ['Idle', 'Finished'].includes(r.recordFile)).length;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    // Group by floor
    const grouped = {};
    rooms.forEach(r => {
        const f = getFloor(r.id);
        if (!grouped[f]) grouped[f] = [];
        grouped[f].push(r);
    });

    // Incident rooms (have ongoing incidents)
    const incidentRooms = rooms.filter(r => r.incident?.ongoingIncident);

    return (
        <div style={{ maxWidth: 1100 }}>
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
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>Reports</h1>
                    <p style={{ fontSize: '0.8rem', color: selectedDate === 'today' ? '#8b949e' : '#f97316', marginTop: 4 }}>
                        {selectedDate === 'today'
                            ? `${dateStr} · Generated at ${timeStr}`
                            : `Historical View 👀 · ${selectedDate} at ${selectedTime}`
                        }
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Time Machine Pickers */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginRight: '0.5rem' }}>
                        <select
                            value={selectedDate}
                            onChange={handleDateChange}
                            style={{ ...s.btn, padding: '0.4rem', cursor: 'pointer', outline: 'none' }}
                        >
                            <option value="today">Real-time (Today)</option>
                            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        {selectedDate !== 'today' && (
                            <select
                                value={selectedTime}
                                onChange={handleTimeChange}
                                style={{ ...s.btn, padding: '0.4rem', cursor: 'pointer', outline: 'none' }}
                            >
                                {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        )}
                    </div>

                    <button onClick={() => fetchData()} disabled={loading} style={s.btn}>
                        <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button onClick={downloadCSV} disabled={rooms.length === 0} style={s.btn}>
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={sendReport} disabled={sending || rooms.length === 0} style={s.btnPrimary}>
                        {sending ? <RefreshCw size={14} /> : <Send size={14} />}
                        {sending ? 'Sending...' : 'Send to Team'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <SummaryCard label="Total Rooms" value={rooms.length} color="#fff" />
                <SummaryCard label="Active" value={activeCount} color="#3fb950" />
                <SummaryCard label="Stopped" value={stoppedCount} color="#e3b341" />
                <SummaryCard label="Error" value={errorCount} color="#ff7b72" />
                <SummaryCard label="Idle / Finished" value={idleCount} color="#8b949e" />
                <SummaryCard label="Incidents" value={incidentRooms.length} color={incidentRooms.length > 0 ? '#ff7b72' : '#3fb950'} />
            </div>

            {/* Ongoing Incidents */}
            {incidentRooms.length > 0 && (
                <div style={s.section}>
                    <div style={s.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={18} style={{ color: '#ff7b72' }} />
                            <h2 style={s.sectionTitle}>Ongoing Incidents</h2>
                        </div>
                        <span style={s.badge}>{incidentRooms.length} active</span>
                    </div>
                    <table style={s.table}>
                        <thead>
                            <tr>
                                <th style={s.th}>Room</th>
                                <th style={s.th}>Issue</th>
                                <th style={s.th}>Detected</th>
                                <th style={s.th}>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidentRooms.map(r => {
                                const inc = r.incident.ongoingIncident;
                                const start = new Date(inc.startTime);
                                const dur = Math.floor((now - start) / 60000);
                                return (
                                    <tr key={r.id} style={s.tr}>
                                        <td style={s.td}><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.id}</span></td>
                                        <td style={s.td}>
                                            <span style={{ ...s.statusBadge, color: '#ff7b72', background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)' }}>
                                                {inc.reason}
                                            </span>
                                        </td>
                                        <td style={{ ...s.td, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                            {start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ ...s.td, color: dur > 30 ? '#ff7b72' : '#e3b341', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                            {dur} min
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Room Status by Floor */}
            <div style={s.section}>
                <div style={s.sectionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={18} style={{ color: '#58a6ff' }} />
                        <h2 style={s.sectionTitle}>Room Status Breakdown</h2>
                    </div>
                </div>

                {loading ? (
                    <p style={{ color: '#8b949e', fontSize: '0.85rem', padding: '1rem 0' }}>Loading room data...</p>
                ) : Object.entries(grouped).map(([floor, floorRooms]) => {
                    const isOpen = expandedFloors[floor] !== false;
                    const floorActive = floorRooms.filter(r => r.recordFile === 'Active').length;
                    const floorIssues = floorRooms.filter(r => ['Stopped', 'No Record', 'Error', 'Bad Recording'].includes(r.recordFile)).length;
                    return (
                        <div key={floor} style={{ marginBottom: '0.5rem' }}>
                            <button onClick={() => toggleFloor(floor)} style={s.floorBtn}>
                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{floor}</span>
                                <span style={{ fontSize: '0.7rem', color: '#8b949e', marginLeft: 'auto' }}>
                                    {floorActive}/{floorRooms.length} active
                                    {floorIssues > 0 && <span style={{ color: '#ff7b72', marginLeft: 8 }}>⚠ {floorIssues} issue{floorIssues > 1 ? 's' : ''}</span>}
                                </span>
                            </button>
                            {isOpen && (
                                <table style={{ ...s.table, marginBottom: 4 }}>
                                    <thead>
                                        <tr>
                                            <th style={s.th}>Room</th>
                                            <th style={s.th}>Status</th>
                                            <th style={s.th}>Last Update</th>
                                            <th style={s.th}>File</th>
                                            <th style={s.th}>Schedule</th>
                                            <th style={s.th}>Server</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {floorRooms.map(r => {
                                            const sc = getStatusConfig(r.recordFile);
                                            return (
                                                <tr key={r.id} style={s.tr}>
                                                    <td style={s.td}>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>{r.id}</span>
                                                    </td>
                                                    <td style={s.td}>
                                                        <span style={{ ...s.statusBadge, color: sc.color, background: sc.bg, border: `1px solid ${sc.color}33` }}>
                                                            {sc.icon} {r.recordFile}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...s.td, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#c9d1d9' }}>
                                                        {r.lastRecorded || '—'}
                                                    </td>
                                                    <td style={s.td}>
                                                        {r.fileName ? (
                                                            <div>
                                                                <div style={{ fontSize: '0.75rem', color: '#58a6ff', fontFamily: 'var(--font-mono)' }}>{r.fileName}</div>
                                                                {r.fileSize && <div style={{ fontSize: '0.65rem', color: '#8b949e' }}>{r.fileSize}</div>}
                                                            </div>
                                                        ) : <span style={{ color: '#8b949e' }}>—</span>}
                                                    </td>
                                                    <td style={s.td}>
                                                        {r.isScheduled
                                                            ? <span style={{ fontSize: '0.7rem', color: '#3fb950', fontWeight: 600 }}>● In Session</span>
                                                            : <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>Free</span>
                                                        }
                                                    </td>
                                                    <td style={{ ...s.td, fontSize: '0.75rem', color: '#8b949e', fontFamily: 'var(--font-mono)' }}>
                                                        {r.activeServer || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color }) {
    return (
        <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
            padding: '0.75rem 1rem',
        }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color, lineHeight: 1.2 }}>{value}</div>
            <div style={{ fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{label}</div>
        </div>
    );
}

// Shared inline styles
const s = {
    btn: {
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.75rem',
        borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#c9d1d9',
        fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
    },
    btnPrimary: {
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.85rem',
        borderRadius: 6, border: 'none', background: '#238636', color: '#fff',
        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
    },
    section: {
        background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
        padding: '1rem 1.25rem', marginBottom: '1rem',
    },
    sectionHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: '1px solid #30363d',
    },
    sectionTitle: {
        fontSize: '0.95rem', fontWeight: 600, color: '#fff', margin: 0,
    },
    badge: {
        fontSize: '0.65rem', color: '#8b949e', background: 'rgba(139,148,158,0.1)',
        padding: '0.15rem 0.45rem', borderRadius: 10, border: '1px solid rgba(139,148,158,0.2)',
    },
    table: {
        width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem',
    },
    th: {
        padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.65rem',
        textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8b949e',
        borderBottom: '1px solid #30363d', whiteSpace: 'nowrap',
    },
    tr: {
        borderBottom: '1px solid rgba(48,54,61,0.5)',
    },
    td: {
        padding: '0.5rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap',
    },
    statusBadge: {
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: 10,
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em',
    },
    floorBtn: {
        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
        padding: '0.5rem 0.5rem', background: 'rgba(255,255,255,0.02)', border: 'none',
        borderRadius: 6, cursor: 'pointer', color: '#8b949e', marginBottom: 4,
    },
};
