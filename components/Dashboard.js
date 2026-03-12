'use client';

import { useState, useEffect } from 'react';
import { getRoomStatuses, getCampusList } from '../services/monitoringService';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Search, Send, ChevronDown, ExternalLink } from 'lucide-react';
import styles from './Dashboard.module.css';
import RoomDetailModal from './RoomDetailModal';

export default function Dashboard() {
    const [selectedCampus, setSelectedCampus] = useState('RS');
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sendingReport, setSendingReport] = useState(false);
    const [reportStatus, setReportStatus] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshInterval, setRefreshInterval] = useState(60); // default 60s

    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fetchData = async (isAutoRefresh = false) => {
        if (!isAutoRefresh) setLoading(true);
        setError(null);
        try {
            const data = await getRoomStatuses(selectedCampus);
            if (Array.isArray(data)) {
                setRooms(data);
                setLastUpdated(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
            // Only show error if we don't have existing data to display
            if (rooms.length === 0) {
                setError("Failed to connect to monitoring server. กำลังลองใหม่...");
            }
        } finally {
            if (!isAutoRefresh) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Fetch user-configured refresh interval from settings
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                const interval = data?.monitoring?.refreshIntervalSeconds;
                if (interval && interval >= 10) {
                    setRefreshInterval(interval);
                }
            })
            .catch(() => { });
    }, [selectedCampus]);

    // Setup Auto-Refresh Interval
    useEffect(() => {
        if (!refreshInterval) return;
        const timer = setInterval(() => {
            fetchData(true); // true = silent refresh (no loading spinner)
        }, refreshInterval * 1000);
        return () => clearInterval(timer);
    }, [selectedCampus, refreshInterval]);

    const sendReport = async () => {
        if (!rooms.length) return;
        setSendingReport(true);
        setReportStatus(null);
        try {
            const response = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rooms, campus: selectedCampus })
            });
            const result = await response.json();
            if (response.ok) {
                setReportStatus({ type: 'success', msg: result.message || 'Report sent!' });
                setTimeout(() => setReportStatus(null), 5000);
            } else {
                setReportStatus({ type: 'error', msg: result.error || 'Failed to send report.' });
            }
        } catch (error) {
            setReportStatus({ type: 'error', msg: 'Network error.' });
        } finally {
            setSendingReport(false);
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            'Active': { cls: styles.badgeActive, icon: <CheckCircle size={12} /> },
            'Stopped': { cls: styles.badgeWarning, icon: <AlertTriangle size={12} /> },
            'Bad Recording': { cls: styles.badgeDanger, icon: <XCircle size={12} /> },
            'No Record': { cls: styles.badgeDanger, icon: <XCircle size={12} /> },
            'Finished': { cls: styles.badgeMuted, icon: null },
            'Idle': { cls: styles.badgeMuted, icon: null },
        };
        const c = config[status] || { cls: styles.badgeMuted, icon: null };
        return (
            <span className={`${styles.badge} ${c.cls}`}>
                {c.icon}{status}
            </span>
        );
    };

    // Stats
    const activeCount = rooms.filter(r => r.recordFile === 'Active').length;
    const stoppedCount = rooms.filter(r => r.recordFile === 'Stopped').length;
    const errorCount = rooms.filter(r => ['No Record', 'Error'].includes(r.recordFile)).length;
    const idleCount = rooms.filter(r => ['Idle', 'Finished'].includes(r.recordFile)).length;

    return (
        <div>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Dashboard</h1>
                    <p className={styles.pageSubtitle}>
                        Real-time recording status — Campus {selectedCampus}
                        {lastUpdated && <span className={styles.updatedAt}> · Last check: {lastUpdated} ⚡ Auto-refresh {refreshInterval}s</span>}
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.campusToggle}>
                        {getCampusList().map(campus => (
                            <button
                                key={campus.id}
                                className={`${styles.campusBtn} ${selectedCampus === campus.id ? styles.campusBtnActive : ''}`}
                                onClick={() => setSelectedCampus(campus.id)}
                            >
                                {campus.name}
                            </button>
                        ))}
                    </div>
                    <button
                        className={styles.actionBtn}
                        onClick={() => fetchData()}
                        disabled={loading || sendingReport}
                    >
                        <RefreshCw size={14} className={loading ? styles.spinning : ''} />
                        {loading ? 'Checking...' : 'Refresh'}
                    </button>
                    <button
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={sendReport}
                        disabled={loading || sendingReport || rooms.length === 0}
                    >
                        {sendingReport ? <RefreshCw size={14} className={styles.spinning} /> : <Send size={14} />}
                        {sendingReport ? 'Sending...' : 'Send Report'}
                    </button>
                </div>
            </div>

            {/* Notification */}
            {reportStatus && (
                <div className={`${styles.notification} ${reportStatus.type === 'success' ? styles.notifSuccess : styles.notifError}`}>
                    {reportStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {reportStatus.msg}
                </div>
            )}

            {/* Stats Row */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#3fb950' }}>{activeCount}</div>
                    <div className={styles.statLabel}>Active</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#e3b341' }}>{stoppedCount}</div>
                    <div className={styles.statLabel}>Stopped</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#ff7b72' }}>{errorCount}</div>
                    <div className={styles.statLabel}>Error</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#8b949e' }}>{idleCount}</div>
                    <div className={styles.statLabel}>Idle</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: 'var(--text-bright)' }}>{rooms.length}</div>
                    <div className={styles.statLabel}>Total</div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Search + Filter Bar */}
            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <Search size={14} className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search rooms..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <span className={styles.resultCount}>{filteredRooms.length} rooms</span>
            </div>

            {/* TABLE */}
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Room</th>
                            <th>Status</th>
                            <th>Last Update</th>
                            <th>File</th>
                            <th>Schedule</th>
                            <th>Server</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rooms.length === 0 ? (
                            <tr><td colSpan={7} className={styles.emptyState}>Loading room data...</td></tr>
                        ) : filteredRooms.length === 0 ? (
                            <tr><td colSpan={7} className={styles.emptyState}>No rooms found.</td></tr>
                        ) : filteredRooms.map(room => {
                            const currentSlot = Array.isArray(room.schedule) ? room.schedule.find(s => {
                                const now = new Date();
                                const nowMin = now.getHours() * 60 + now.getMinutes();
                                const [sH, sM] = s.start.split(':').map(Number);
                                const [eH, eM] = s.end.split(':').map(Number);
                                return nowMin >= (sH * 60 + sM) && nowMin < (eH * 60 + eM);
                            }) : null;
                            const nextSlot = Array.isArray(room.schedule) ? room.schedule.find(s => {
                                const now = new Date();
                                const nowMin = now.getHours() * 60 + now.getMinutes();
                                const [sH, sM] = s.start.split(':').map(Number);
                                return (sH * 60 + sM) > nowMin;
                            }) : null;

                            return (
                                <tr
                                    key={room.id}
                                    className={`${styles.tableRow} ${room.recordFile === 'No Record' ? styles.rowDanger : ''}`}
                                    onClick={() => setSelectedRoom(room)}
                                >
                                    <td>
                                        <div className={styles.cellRoom}>
                                            <span className={styles.roomId}>{room.id}</span>
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(room.recordFile)}</td>
                                    <td>
                                        <div className={styles.cellTime}>
                                            <span className={styles.timeValue}>{room.lastRecorded || '—'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.cellFile}>
                                            {room.fileName ? (
                                                <>
                                                    <span className={styles.fileName}>{room.fileName}</span>
                                                    {room.fileSize && <span className={styles.fileSize}>{room.fileSize}</span>}
                                                </>
                                            ) : (
                                                <span className={styles.noData}>—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {currentSlot ? (
                                            <div className={styles.cellSchedule}>
                                                <span className={styles.scheduleLive}>● LIVE</span>
                                                <span className={styles.scheduleName}>{currentSlot.name?.split(' ')[0]}</span>
                                                <span className={styles.scheduleTime}>{currentSlot.start}–{currentSlot.end}</span>
                                            </div>
                                        ) : nextSlot ? (
                                            <div className={styles.cellSchedule}>
                                                <span className={styles.scheduleNext}>Next</span>
                                                <span className={styles.scheduleTime}>{nextSlot.start}</span>
                                            </div>
                                        ) : (
                                            <span className={styles.noData}>Free</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={styles.serverLabel}>{room.activeServer || '—'}</span>
                                    </td>
                                    <td>
                                        <button
                                            className={styles.rowAction}
                                            onClick={(e) => { e.stopPropagation(); window.open(room.folderUrl, '_blank'); }}
                                            title="Open directory"
                                        >
                                            <ExternalLink size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {selectedRoom && (
                <RoomDetailModal
                    room={selectedRoom}
                    onClose={() => setSelectedRoom(null)}
                />
            )}
        </div>
    );
}
