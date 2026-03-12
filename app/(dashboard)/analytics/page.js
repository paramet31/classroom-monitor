'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Download } from 'lucide-react';

export default function AnalyticsPage() {
    const [data, setData] = useState({ timeSeries: [], logs: [], summary: { totalRooms: 0, activeRoomsNow: 0, totalIncidents: 0 } });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // History State
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('today');

    useEffect(() => {
        fetchAvailableDates();
        fetchAnalytics();

        // Auto-refresh every 1 minute if viewing today (real-time)
        const interval = setInterval(() => {
            if (selectedDate === 'today') {
                fetchAnalytics('today', false);
            }
        }, 1 * 60 * 1000);

        return () => clearInterval(interval);
    }, [selectedDate]); // Re-fetch when date changes

    const fetchAvailableDates = async () => {
        try {
            const res = await fetch('/api/history/dates');
            const data = await res.json();
            if (data.dates) setAvailableDates(data.dates);
        } catch (e) {
            console.error('[Analytics] Failed to fetch available dates', e);
        }
    };

    const fetchAnalytics = async (dateStr = selectedDate, showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const res = await fetch(`/api/analytics?date=${dateStr}`);
            const result = await res.json();
            setData(result);
            setLastUpdated(new Date());
        } catch (e) {
            console.error('Failed to fetch analytics', e);
        }
        setLoading(false);
    };

    const handleDateChange = (e) => {
        setSelectedDate(e.target.value);
    };

    const renderCustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const slotData = payload[0].payload;

            return (
                <div style={{
                    background: 'rgba(22, 27, 34, 0.95)',
                    border: '1px solid #30363d',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    maxWidth: '320px'
                }}>
                    <p style={{ margin: '0 0 8px 0', color: '#fff', fontWeight: 600 }}>{selectedDate === 'today' ? 'Today' : selectedDate} {label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', fontSize: '0.85rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color }} />
                            <span style={{ color: '#8b949e' }}>{entry.name}:</span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{entry.value}</span>
                        </div>
                    ))}

                    {slotData.activeRooms && slotData.activeRooms.length > 0 && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #30363d' }}>
                            <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: '4px' }}>Active rooms:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {slotData.activeRooms.map(room => (
                                    <span key={room} style={{
                                        fontSize: '0.7rem',
                                        color: '#3fb950',
                                        background: 'rgba(63,185,80,0.1)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {room}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {slotData.issueRooms && slotData.issueRooms.length > 0 && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #30363d' }}>
                            <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: '4px' }}>Rooms with issues:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {slotData.issueRooms.map(room => (
                                    <span key={room} style={{
                                        fontSize: '0.7rem',
                                        color: '#f59e0b',
                                        background: 'rgba(245,158,11,0.1)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {room}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    const activeRoomsColor = '#10b981'; // Tailwind Emerald 500
    const issueRoomsColor = '#f59e0b'; // Tailwind Amber 500

    const downloadCSV = () => {
        if (!data.logs || data.logs.length === 0) return;

        const headers = ['Date', 'Room', 'Status/Reason', 'Time Stopped', 'Time Resumed', 'Downtime (min)'];
        const rows = data.logs.map(log => {
            const startDate = new Date(log.startTime).toLocaleDateString('th-TH');
            const startTime = new Date(log.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const endTime = log.endTime ? new Date(log.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—';
            const duration = log.duration === -1 ? 'Unresolved' : log.duration;
            return [
                startDate,
                log.roomId,
                log.reason || 'Unknown Error',
                startTime,
                endTime,
                duration
            ];
        });

        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel UTF-8
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeDate = selectedDate === 'today' ? new Date().toISOString().split('T')[0] : selectedDate;
        a.download = `analytics_log_${safeDate}.csv`;
        a.click();
    };

    return (
        <div style={{ maxWidth: 1200, paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={24} color="#58a6ff" />
                        Real-time Analytics
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: '#8b949e', marginTop: 4 }}>
                        Monitor room status and recording uptime over the course of the day.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        value={selectedDate}
                        onChange={handleDateChange}
                        style={{ ...s.btn, padding: '0.4rem', cursor: 'pointer', outline: 'none' }}
                    >
                        <option value="today">Real-time (Today)</option>
                        {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    <button onClick={() => fetchAnalytics(selectedDate, true)} disabled={loading} style={s.btn}>
                        <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: '#8b949e' }}>
                    <RefreshCw size={24} className="spinning" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <SummaryCard
                            title="Active Rooms Now"
                            value={data.summary.activeRoomsNow ?? data.summary.totalRooms}
                            icon={<CheckCircle size={20} color={activeRoomsColor} />}
                            trend={`${data.summary.totalRooms} rooms registered`}
                            trendColor="#8b949e"
                        />
                        <SummaryCard
                            title="Total Incidents Today"
                            value={data.summary.totalIncidents}
                            icon={<AlertTriangle size={20} color={issueRoomsColor} />}
                            trend={data.summary.totalIncidents > 0 ? '+ Needs Attention' : 'All Clear'}
                            trendColor={data.summary.totalIncidents > 0 ? issueRoomsColor : activeRoomsColor}
                        />
                    </div>

                    {/* Main Chart Area */}
                    <div style={s.card}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Status Overview ({selectedDate === 'today' ? 'Today' : selectedDate})
                        </h2>
                        {lastUpdated && selectedDate === 'today' && (
                            <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={12} />
                                Last updated: {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.65rem', background: 'rgba(16,185,129,0.1)', padding: '1px 6px', borderRadius: 8 }}>● LIVE</span>
                            </div>
                        )}

                        <div style={{ height: 400, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={data.timeSeries}
                                    margin={{ top: 10, right: 30, left: 20, bottom: 25 }}
                                >
                                    <defs>
                                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={activeRoomsColor} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={activeRoomsColor} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={issueRoomsColor} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={issueRoomsColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                                    <XAxis
                                        dataKey="time"
                                        stroke="#8b949e"
                                        tick={{ fill: '#8b949e', fontSize: 12 }}
                                        tickMargin={10}
                                        minTickGap={30}
                                        label={{ value: 'เวลา (Time)', position: 'insideBottom', offset: -15, fill: '#8b949e', fontSize: 13, fontWeight: 500 }}
                                    />
                                    <YAxis
                                        stroke="#8b949e"
                                        tick={{ fill: '#8b949e', fontSize: 12 }}
                                        allowDecimals={false}
                                        label={{ value: 'จำนวนห้อง (Rooms)', angle: -90, position: 'insideLeft', offset: -5, fill: '#8b949e', fontSize: 13, fontWeight: 500, style: { textAnchor: 'middle' } }}
                                    />
                                    <Tooltip content={renderCustomTooltip} />
                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#8b949e' }} />

                                    <Area
                                        type="monotone"
                                        dataKey="active"
                                        name="Active Rooms"
                                        stroke={activeRoomsColor}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorActive)"
                                        isAnimationActive={false}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="issues"
                                        name="Rooms with Issues"
                                        stroke={issueRoomsColor}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorIssues)"
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Incident Logs Table */}
                    <div style={s.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: 0 }}>Incident Downtime Logs</h2>
                                <span style={{ fontSize: '0.8rem', color: '#8b949e', background: 'rgba(139,148,158,0.1)', padding: '0.2rem 0.6rem', borderRadius: 12 }}>
                                    {data.logs.length} Entries
                                </span>
                            </div>

                            <button onClick={downloadCSV} disabled={data.logs.length === 0} style={{ ...s.btn, background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.75rem' }}>
                                <Download size={14} /> Export CSV
                            </button>
                        </div>

                        {data.logs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#8b949e', background: 'rgba(139,148,158,0.05)', borderRadius: 8 }}>
                                <CheckCircle size={32} style={{ color: activeRoomsColor, marginBottom: '0.5rem', opacity: 0.8 }} />
                                <p style={{ margin: 0 }}>No incidents recorded for this day!</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={s.table}>
                                    <thead>
                                        <tr>
                                            <th style={s.th}>Date</th>
                                            <th style={s.th}>Room</th>
                                            <th style={s.th}>Status/Reason</th>
                                            <th style={s.th}>Time Stopped</th>
                                            <th style={s.th}>Time Resumed</th>
                                            <th style={s.th}>Downtime</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.logs.map((log, i) => {
                                            const startDate = new Date(log.startTime).toLocaleDateString('th-TH');
                                            const startTime = new Date(log.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                            const endTime = log.endTime ? new Date(log.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—';
                                            const isOngoing = log.status === 'Ongoing';

                                            return (
                                                <tr key={i} style={s.tr}>
                                                    <td style={{ ...s.td, fontFamily: 'var(--font-mono)' }}>{startDate}</td>
                                                    <td style={s.td}>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>{log.roomId}</span>
                                                    </td>
                                                    <td style={s.td}>
                                                        <span style={{
                                                            ...s.statusBadge,
                                                            color: isOngoing ? '#ff7b72' : issueRoomsColor,
                                                            background: isOngoing ? 'rgba(248,81,73,0.12)' : 'rgba(245,158,11,0.1)',
                                                            border: isOngoing ? '1px solid rgba(248,81,73,0.3)' : '1px solid rgba(245,158,11,0.3)'
                                                        }}>
                                                            {isOngoing && <Activity size={12} className="spinning-slow" />}
                                                            {log.reason || 'Unknown Error'}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...s.td, fontFamily: 'var(--font-mono)' }}>{startTime}</td>
                                                    <td style={{ ...s.td, fontFamily: 'var(--font-mono)' }}>{endTime}</td>
                                                    <td style={{ ...s.td, fontFamily: 'var(--font-mono)', color: isOngoing ? '#ff7b72' : '#c9d1d9' }}>
                                                        {log.duration === -1
                                                            ? 'Unresolved'
                                                            : `${log.duration} min${isOngoing ? ' (ongoing)' : ''}`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function SummaryCard({ title, value, icon, trend, trendColor }) {
    return (
        <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
            padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#8b949e', fontWeight: 500 }}>{title}</div>
                {icon}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff', lineHeight: 1 }}>
                {value}
            </div>
            {trend && (
                <div style={{ fontSize: '0.75rem', color: trendColor, fontWeight: 500, marginTop: 'auto' }}>
                    {trend}
                </div>
            )}
        </div>
    );
}

const s = {
    card: {
        background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
        padding: '1.5rem', marginBottom: '1.5rem',
    },
    btn: {
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.75rem',
        borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#c9d1d9',
        fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s',
    },
    table: {
        width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem',
    },
    th: {
        padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem',
        textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8b949e',
        borderBottom: '1px solid #30363d', whiteSpace: 'nowrap',
    },
    tr: {
        borderBottom: '1px solid rgba(48,54,61,0.5)', transition: 'background 0.15s ease',
        ':hover': { background: 'rgba(255,255,255,0.02)' }
    },
    td: {
        padding: '0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#c9d1d9'
    },
    statusBadge: {
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 12,
        fontWeight: 600, letterSpacing: '0.02em',
    },
};
