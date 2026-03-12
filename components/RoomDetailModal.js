"use client";
import React, { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import { X, ExternalLink, Calendar, HardDrive, Cpu, Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function RoomDetailModal({ room, onClose, config }) {
    const [incidents, setIncidents] = useState(null);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');

    const getTodayStr = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Fetch available dates on mount
    useEffect(() => {
        fetch(`/api/logs/dates?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                setAvailableDates(data.dates || []);
                setSelectedDate(getTodayStr());
            })
            .catch(() => {
                setAvailableDates([getTodayStr()]);
                setSelectedDate(getTodayStr());
            });
    }, []);

    // Fetch incidents when room or date changes
    useEffect(() => {
        if (!room || !selectedDate) return;
        setLoadingLogs(true);
        const dateParam = selectedDate ? `&date=${selectedDate}` : '';
        fetch(`/api/logs?roomId=${room.id}${dateParam}&t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                setIncidents(data);
                setLoadingLogs(false);
            })
            .catch(err => {
                console.error("Failed to fetch logs", err);
                setLoadingLogs(false);
            });
    }, [room, selectedDate]);

    if (!room) return null;

    // Navigate dates
    const currentDateIndex = availableDates.indexOf(selectedDate);
    const canGoNewer = currentDateIndex > 0;
    const canGoOlder = currentDateIndex < availableDates.length - 1;

    const goNewer = () => {
        if (canGoNewer) setSelectedDate(availableDates[currentDateIndex - 1]);
    };
    const goOlder = () => {
        if (canGoOlder) setSelectedDate(availableDates[currentDateIndex + 1]);
    };

    const isToday = selectedDate === getTodayStr();

    // Determine status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return '#491becff';
            case 'Stopped': return '#f59e0b';
            case 'Finished': return '#94a3b8';
            case 'No Record': return '#ef4444';
            default: return '#94a3b8';
        }
    };

    const statusColor = getStatusColor(room.recordFile);
    const fileServerUrl = room.folderUrl || `http://192.168.10.240/dir/CRRS-${room.id}/`;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div className="d-flex align-items-center gap-3">
                        <div className={styles.modalTitle}>{room.name}</div>
                        <span className={styles.badge} style={{ backgroundColor: statusColor }}>
                            {room.recordFile}
                        </span>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {/* Recording Section */}
                    <div className={styles.detailSection}>
                        <div className={styles.sectionTitle}>
                            <HardDrive size={18} /> Recording Physical Check
                        </div>
                        <div className={styles.detailRow}>
                            <span>Last Update:</span>
                            <span className="fw-bold">{room.lastRecorded || 'No Update'}</span>
                        </div>
                        {room.fileName && (
                            <div className={styles.detailRow}>
                                <span>Latest File:</span>
                                <span className="small text-truncate" style={{ maxWidth: '200px' }}>{room.fileName}</span>
                            </div>
                        )}
                        {room.fileSize && (
                            <div className={styles.detailRow}>
                                <span>Approx. Size:</span>
                                <span className="badge bg-dark">{room.fileSize}</span>
                            </div>
                        )}
                        <div className={styles.detailRow}>
                            <span>Action:</span>
                            <a
                                href={fileServerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                                style={{ width: 'fit-content' }}
                            >
                                <ExternalLink size={16} /> Open Directory
                            </a>
                        </div>
                        {room.recordFile === 'Stopped' && (
                            <div className="alert alert-warning mt-2 small">
                                ⚠️ Recording stopped recently. Check if class ended or encoder failed.
                            </div>
                        )}
                        {room.recordFile === 'No Record' && (
                            <div className="alert alert-danger mt-2 small">
                                🚨 No recording found for today.
                            </div>
                        )}
                    </div>

                    {/* Schedule Section */}
                    <div className={styles.detailSection}>
                        <div className={styles.sectionTitle}>
                            <Calendar size={18} /> Daily Schedule
                        </div>
                        {Array.isArray(room.schedule) && room.schedule.length > 0 ? (
                            room.schedule.map((entry, idx) => {
                                const now = new Date();
                                const nowMins = now.getHours() * 60 + now.getMinutes();
                                const [sH, sM] = entry.start.split(':').map(Number);
                                const [eH, eM] = entry.end.split(':').map(Number);
                                const isActive = nowMins >= (sH * 60 + sM) && nowMins < (eH * 60 + eM);

                                return (
                                    <div key={idx} className={styles.scheduleItem} style={{
                                        borderLeft: isActive ? '3px solid #10b981' : '3px solid transparent',
                                        paddingLeft: '0.5rem',
                                        background: isActive ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                                        borderRadius: '4px',
                                        marginBottom: '0.3rem',
                                        padding: '0.4rem 0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="text-muted small">{entry.start} - {entry.end}</div>
                                            {isActive && <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>● Live</span>}
                                        </div>
                                        <div style={{ fontSize: '0.85rem' }}>{entry.name}</div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-muted small" style={{ padding: '0.5rem 0' }}>
                                No classes scheduled today.
                            </div>
                        )}
                    </div>

                    {/* Server Health Section */}
                    <div className={styles.detailSection}>
                        <div className={styles.sectionTitle}>
                            <Cpu size={18} /> Server Health
                        </div>
                        {room.serverHealth?.length > 0 ? (
                            <>
                                {room.serverHealth.map((srv, idx) => {
                                    const srvStatusColor =
                                        srv.status === 'Active' ? '#10b981' :
                                            srv.status === 'Stopped' ? '#f59e0b' :
                                                srv.status === 'No Record' ? '#ef4444' :
                                                    '#8b949e';
                                    return (
                                        <div key={idx} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
                                            borderRadius: '6px',
                                            background: srv.isActiveSource ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                                            border: srv.isActiveSource ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {srv.isActiveSource && <span style={{ color: '#10b981', fontSize: '1rem' }}>★</span>}
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{srv.label}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>
                                                    {srv.time || '—'}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                                                    padding: '0.15rem 0.45rem', borderRadius: '1rem',
                                                    backgroundColor: `${srvStatusColor}22`, color: srvStatusColor,
                                                    border: `1px solid ${srvStatusColor}55`
                                                }}>
                                                    {srv.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8b949e', marginTop: '0.25rem', padding: '0 0.25rem' }}>
                                    <span>Active Source: <strong style={{ color: '#e6edf3' }}>{room.activeServer}</strong></span>
                                    <span>Checked: {room.lastCheck}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.detailRow}>
                                    <span>Automation Mode:</span>
                                    <span className="text-success fw-bold">Auto</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>Last Check:</span>
                                    <span>{room.lastCheck}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Incident Logs Section */}
                    <div className={styles.detailSection}>
                        <div className="d-flex justify-content-between align-items-center mb-0" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                            <div className={styles.sectionTitle} style={{ color: '#cf222e', borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                                <AlertTriangle size={18} /> Incident History
                            </div>
                            {incidents?.incidentHistory?.length > 0 && (
                                <button
                                    onClick={() => {
                                        const headers = ['Room', 'Detected', 'Closed', 'Duration (min)', 'Issue', 'Resolution'];
                                        const csvContent = [
                                            headers.join(','),
                                            ...incidents.incidentHistory.map(inc => {
                                                const detectedDate = new Date(inc.startTime);
                                                const detectedStr = detectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + detectedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                                const closedDate = new Date(inc.endTime);
                                                const closedStr = closedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + closedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                                const issue = (inc.reason || '').replace(' (class ended)', '');
                                                const resolution = inc.resolution || (inc.reason?.includes('class ended') ? 'Class period ended' : 'Recording resumed');
                                                return `"${room.id}","${detectedStr}","${closedStr}",${inc.durationMinutes},"${issue}","${resolution}"`;
                                            })
                                        ].join('\n');
                                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.setAttribute('href', url);
                                        link.setAttribute('download', `Room_${room.id}_Incident_Log_${selectedDate}.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                >
                                    <HardDrive size={12} /> Export CSV
                                </button>
                            )}
                        </div>

                        {/* Date Picker */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            marginBottom: '0.75rem', padding: '0.5rem',
                            background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            <button
                                onClick={goOlder}
                                disabled={!canGoOlder}
                                style={{
                                    background: 'none', border: 'none', color: canGoOlder ? '#c9d1d9' : '#484f58',
                                    cursor: canGoOlder ? 'pointer' : 'not-allowed', padding: '0.25rem',
                                    display: 'flex', alignItems: 'center'
                                }}
                                title="Previous day"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={14} style={{ color: '#8b949e' }} />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={getTodayStr()}
                                    style={{
                                        background: 'rgba(13, 17, 23, 0.5)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: '#c9d1d9',
                                        padding: '0.3rem 0.5rem',
                                        fontSize: '0.8rem',
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                />
                                {isToday && (
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase',
                                        color: '#3fb950', background: 'rgba(63, 185, 80, 0.1)',
                                        padding: '0.15rem 0.4rem', borderRadius: '4px',
                                        border: '1px solid rgba(63, 185, 80, 0.2)'
                                    }}>
                                        Live
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={goNewer}
                                disabled={!canGoNewer}
                                style={{
                                    background: 'none', border: 'none', color: canGoNewer ? '#c9d1d9' : '#484f58',
                                    cursor: canGoNewer ? 'pointer' : 'not-allowed', padding: '0.25rem',
                                    display: 'flex', alignItems: 'center'
                                }}
                                title="Next day"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {loadingLogs ? (
                            <div className="text-muted small">Loading logs...</div>
                        ) : incidents?.incidentHistory?.length > 0 ? (
                            <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {incidents.incidentHistory.map((inc, i) => {
                                    const detectedDate = new Date(inc.startTime);
                                    const detectedStr = detectedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                    const closedDate = new Date(inc.endTime);
                                    const closedStr = closedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                    const dateLabel = detectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                                    const issue = inc.reason?.replace(' (class ended)', '') || '—';
                                    const resolution = inc.resolution || (inc.reason?.includes('class ended') ? 'Class period ended' : 'Recording resumed');
                                    const resColor = resolution === 'Recording resumed' ? '#3fb950' : '#8b949e';

                                    return (
                                        <div key={i} style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: '8px',
                                            padding: '0.65rem 0.85rem',
                                        }}>
                                            {/* Top row: timeline */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#8b949e', fontFamily: 'monospace' }}>{dateLabel}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#c9d1d9', fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {detectedStr}
                                                </span>
                                                <span style={{ color: '#484f58', fontSize: '0.75rem' }}>→</span>
                                                <span style={{ fontSize: '0.8rem', color: '#c9d1d9', fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {closedStr}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 700,
                                                    color: inc.durationMinutes > 30 ? '#ff7b72' : '#e3b341',
                                                    background: inc.durationMinutes > 30 ? 'rgba(248,81,73,0.1)' : 'rgba(227,179,65,0.1)',
                                                    padding: '0.1rem 0.4rem', borderRadius: '4px',
                                                    fontFamily: 'monospace',
                                                    marginLeft: 'auto'
                                                }}>
                                                    {inc.durationMinutes} min
                                                </span>
                                            </div>
                                            {/* Bottom row: issue + resolution */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                                                <span style={{ color: '#ff7b72', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <AlertTriangle size={12} /> {issue}
                                                </span>
                                                <span style={{ color: '#484f58' }}>•</span>
                                                <span style={{ color: resColor }}>{resolution}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-success small mt-2">
                                {isToday ? 'No incidents recorded today.' : `No incidents recorded on ${selectedDate}.`}
                            </div>
                        )}
                        {isToday && incidents?.ongoingIncident && (
                            <div className="alert alert-danger mt-3 small p-2 mb-0 border border-danger">
                                <strong>Ongoing Incident:</strong> Tracking downtime since {new Date(incidents.ongoingIncident.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}.
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <button className="btn btn-secondary w-100" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
