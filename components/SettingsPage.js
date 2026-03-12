'use client';

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ToggleLeft, ToggleRight, Mail, Clock, Server, AlertCircle, CheckCircle, Building2 } from 'lucide-react';

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [newRoomId, setNewRoomId] = useState('');
    const [newRoomFloor, setNewRoomFloor] = useState('Floor 1');
    const [newEmail, setNewEmail] = useState('');

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => { setSettings(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const saveSettings = async (updatedSettings) => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSettings || settings)
            });
            if (res.ok) {
                const result = await res.json();
                setSettings(result.settings);
                showToast('Settings saved successfully', 'success');
            } else {
                showToast('Failed to save settings', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
        setSaving(false);
    };

    const showToast = (msg, type) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Room actions
    const toggleRoom = (id) => {
        const updated = {
            ...settings,
            rooms: settings.rooms.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
        };
        setSettings(updated);
    };

    const addRoom = () => {
        if (!newRoomId.trim()) return;
        if (settings.rooms.find(r => r.id === newRoomId.trim())) {
            showToast('Room already exists', 'error');
            return;
        }
        const updated = {
            ...settings,
            rooms: [...settings.rooms, { id: newRoomId.trim(), floor: newRoomFloor, enabled: true }]
        };
        setSettings(updated);
        setNewRoomId('');
    };

    const removeRoom = (id) => {
        const updated = {
            ...settings,
            rooms: settings.rooms.filter(r => r.id !== id)
        };
        setSettings(updated);
    };

    // Email actions
    const addEmail = () => {
        if (!newEmail.trim() || !newEmail.includes('@')) return;
        if (settings.emailRecipients.includes(newEmail.trim())) {
            showToast('Email already exists', 'error');
            return;
        }
        const updated = {
            ...settings,
            emailRecipients: [...settings.emailRecipients, newEmail.trim()]
        };
        setSettings(updated);
        setNewEmail('');
    };

    const removeEmail = (email) => {
        const updated = {
            ...settings,
            emailRecipients: settings.emailRecipients.filter(e => e !== email)
        };
        setSettings(updated);
    };

    // Monitoring updates
    const updateMonitoring = (key, value) => {
        const updated = {
            ...settings,
            monitoring: { ...settings.monitoring, [key]: parseInt(value) || 0 }
        };
        setSettings(updated);
    };

    // Automation updates
    const updateAutomation = (key, value) => {
        const updated = {
            ...settings,
            automation: { ...settings.automation, [key]: value }
        };
        setSettings(updated);
    };

    if (loading) return <div style={styles.page}><p style={{ color: '#8b949e' }}>Loading settings...</p></div>;
    if (!settings) return <div style={styles.page}><p style={{ color: '#ff7b72' }}>Failed to load settings.</p></div>;

    // Group rooms by floor
    const floors = {};
    settings.rooms.forEach(r => {
        if (!floors[r.floor]) floors[r.floor] = [];
        floors[r.floor].push(r);
    });

    return (
        <div style={styles.page}>
            {/* Toast */}
            {toast && (
                <div style={{
                    ...styles.toast,
                    background: toast.type === 'success' ? 'rgba(35,134,54,0.15)' : 'rgba(248,81,73,0.15)',
                    color: toast.type === 'success' ? '#3fb950' : '#ff7b72',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(35,134,54,0.35)' : 'rgba(248,81,73,0.35)'}`
                }}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Settings</h1>
                    <p style={styles.subtitle}>Manage rooms, notifications, and monitoring configuration</p>
                </div>
                <button
                    style={styles.saveBtn}
                    onClick={() => saveSettings()}
                    disabled={saving}
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* ============================== ROOMS ============================== */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleWrap}>
                        <Building2 size={20} style={{ color: '#58a6ff' }} />
                        <h2 style={styles.sectionTitle}>Room Management</h2>
                    </div>
                    <span style={styles.sectionBadge}>{settings.rooms.filter(r => r.enabled).length} / {settings.rooms.length} active</span>
                </div>

                {/* Add room */}
                <div style={styles.addRow}>
                    <input
                        type="text"
                        placeholder="Room ID (e.g. 1-601)"
                        value={newRoomId}
                        onChange={e => setNewRoomId(e.target.value)}
                        style={styles.input}
                        onKeyDown={e => e.key === 'Enter' && addRoom()}
                    />
                    <select value={newRoomFloor} onChange={e => setNewRoomFloor(e.target.value)} style={styles.select}>
                        {['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5', 'Building 3'].map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                    <button style={styles.addBtn} onClick={addRoom}>
                        <Plus size={14} /> Add
                    </button>
                </div>

                {/* Room list by floor */}
                {Object.entries(floors).map(([floor, roomList]) => (
                    <div key={floor} style={styles.floorGroup}>
                        <div style={styles.floorLabel}>{floor}</div>
                        <div style={styles.roomGrid}>
                            {roomList.map(room => (
                                <div key={room.id} style={{
                                    ...styles.roomChip,
                                    opacity: room.enabled ? 1 : 0.4,
                                    borderColor: room.enabled ? 'var(--card-border)' : 'rgba(139,148,158,0.2)',
                                }}>
                                    <button
                                        style={styles.toggleBtn}
                                        onClick={() => toggleRoom(room.id)}
                                        title={room.enabled ? 'Disable' : 'Enable'}
                                    >
                                        {room.enabled
                                            ? <ToggleRight size={18} style={{ color: '#3fb950' }} />
                                            : <ToggleLeft size={18} style={{ color: '#8b949e' }} />
                                        }
                                    </button>
                                    <span style={styles.roomChipId}>{room.id}</span>
                                    <button
                                        style={styles.deleteBtn}
                                        onClick={() => removeRoom(room.id)}
                                        title="Remove"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ============================== EMAILS ============================== */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleWrap}>
                        <Mail size={20} style={{ color: '#58a6ff' }} />
                        <h2 style={styles.sectionTitle}>Email Recipients</h2>
                    </div>
                    <span style={styles.sectionBadge}>{settings.emailRecipients.length} recipients</span>
                </div>

                <div style={styles.addRow}>
                    <input
                        type="email"
                        placeholder="email@siit.tu.ac.th"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                        onKeyDown={e => e.key === 'Enter' && addEmail()}
                    />
                    <button style={styles.addBtn} onClick={addEmail}>
                        <Plus size={14} /> Add
                    </button>
                </div>

                <div style={styles.emailList}>
                    {settings.emailRecipients.map(email => (
                        <div key={email} style={styles.emailChip}>
                            <Mail size={14} style={{ color: '#8b949e', flexShrink: 0 }} />
                            <span style={styles.emailText}>{email}</span>
                            <button style={styles.deleteBtn} onClick={() => removeEmail(email)}>
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ============================== MONITORING ============================== */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleWrap}>
                        <Clock size={20} style={{ color: '#58a6ff' }} />
                        <h2 style={styles.sectionTitle}>Monitoring Thresholds</h2>
                    </div>
                </div>

                <div style={styles.thresholdGrid}>
                    <div style={styles.thresholdCard}>
                        <div style={styles.thresholdLabel}>Active Threshold</div>
                        <div style={styles.thresholdDesc}>File age under this = "Active"</div>
                        <div style={styles.thresholdInputWrap}>
                            <input
                                type="number"
                                value={settings.monitoring.activeThresholdMinutes}
                                onChange={e => updateMonitoring('activeThresholdMinutes', e.target.value)}
                                style={styles.thresholdInput}
                                min={1}
                            />
                            <span style={styles.thresholdUnit}>min</span>
                        </div>
                    </div>

                    <div style={styles.thresholdCard}>
                        <div style={styles.thresholdLabel}>Stopped Threshold</div>
                        <div style={styles.thresholdDesc}>File age under this = "Stopped", above = "Finished"</div>
                        <div style={styles.thresholdInputWrap}>
                            <input
                                type="number"
                                value={settings.monitoring.stoppedThresholdMinutes}
                                onChange={e => updateMonitoring('stoppedThresholdMinutes', e.target.value)}
                                style={styles.thresholdInput}
                                min={1}
                            />
                            <span style={styles.thresholdUnit}>min</span>
                        </div>
                    </div>

                    <div style={styles.thresholdCard}>
                        <div style={styles.thresholdLabel}>Refresh Interval</div>
                        <div style={styles.thresholdDesc}>Auto-refresh dashboard data</div>
                        <div style={styles.thresholdInputWrap}>
                            <input
                                type="number"
                                value={settings.monitoring.refreshIntervalSeconds}
                                onChange={e => updateMonitoring('refreshIntervalSeconds', e.target.value)}
                                style={styles.thresholdInput}
                                min={30}
                            />
                            <span style={styles.thresholdUnit}>sec</span>
                        </div>
                    </div>

                    <div style={styles.thresholdCard}>
                        <div style={styles.thresholdLabel}>Grace Period</div>
                        <div style={styles.thresholdDesc}>Wait before flagging Idle as incident</div>
                        <div style={styles.thresholdInputWrap}>
                            <input
                                type="number"
                                value={settings.monitoring.gracePeriodMinutes}
                                onChange={e => updateMonitoring('gracePeriodMinutes', e.target.value)}
                                style={styles.thresholdInput}
                                min={0}
                            />
                            <span style={styles.thresholdUnit}>min</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================== AUTOMATION ============================== */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleWrap}>
                        <Server size={20} style={{ color: '#58a6ff' }} />
                        <h2 style={styles.sectionTitle}>Automation Control</h2>
                    </div>
                </div>

                <div style={styles.thresholdGrid}>
                    <div style={{ ...styles.thresholdCard, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={styles.thresholdLabel}>Unrecorded Room Alerts</div>
                            <div style={styles.thresholdDesc}>Send emails every 5 mins for unrecorded rooms</div>
                        </div>
                        <div style={{ marginTop: '0.75rem' }}>
                            <button
                                style={{
                                    ...styles.toggleBtn,
                                    background: settings.automation?.unrecordedAlertEnabled !== false ? 'rgba(35,134,54,0.15)' : 'rgba(139,148,158,0.1)',
                                    border: `1px solid ${settings.automation?.unrecordedAlertEnabled !== false ? 'rgba(35,134,54,0.35)' : 'rgba(139,148,158,0.2)'}`,
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    color: settings.automation?.unrecordedAlertEnabled !== false ? '#3fb950' : '#8b949e',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    display: 'inline-flex',
                                    gap: '0.4rem'
                                }}
                                onClick={() => updateAutomation('unrecordedAlertEnabled', settings.automation?.unrecordedAlertEnabled === false ? true : false)}
                            >
                                {settings.automation?.unrecordedAlertEnabled !== false
                                    ? <><ToggleRight size={18} /> Enabled</>
                                    : <><ToggleLeft size={18} /> Disabled</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Inline styles (dark theme consistent)
const styles = {
    page: {
        maxWidth: '900px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#fff',
        margin: 0,
    },
    subtitle: {
        fontSize: '0.8rem',
        color: '#8b949e',
        marginTop: '0.25rem',
    },
    saveBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        background: '#238636',
        border: 'none',
        color: 'white',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
    },
    toast: {
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        padding: '0.6rem 1rem',
        borderRadius: '6px',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease',
    },
    section: {
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #30363d',
    },
    sectionTitleWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#fff',
        margin: 0,
    },
    sectionBadge: {
        fontSize: '0.7rem',
        color: '#8b949e',
        background: 'rgba(139,148,158,0.1)',
        padding: '0.2rem 0.5rem',
        borderRadius: '10px',
        border: '1px solid rgba(139,148,158,0.2)',
    },
    addRow: {
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    input: {
        background: '#0d1117',
        border: '1px solid #30363d',
        color: '#fff',
        padding: '0.45rem 0.75rem',
        borderRadius: '6px',
        fontSize: '0.82rem',
        outline: 'none',
        width: '180px',
    },
    select: {
        background: '#0d1117',
        border: '1px solid #30363d',
        color: '#c9d1d9',
        padding: '0.45rem 0.75rem',
        borderRadius: '6px',
        fontSize: '0.82rem',
        outline: 'none',
    },
    addBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.45rem 0.75rem',
        borderRadius: '6px',
        background: 'rgba(35,134,54,0.15)',
        border: '1px solid rgba(35,134,54,0.35)',
        color: '#3fb950',
        fontSize: '0.8rem',
        fontWeight: 500,
        cursor: 'pointer',
    },
    floorGroup: {
        marginBottom: '0.75rem',
    },
    floorLabel: {
        fontSize: '0.68rem',
        fontWeight: 600,
        color: '#8b949e',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem',
    },
    roomGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
    },
    roomChip: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.3rem 0.5rem',
        borderRadius: '6px',
        background: '#0d1117',
        border: '1px solid #30363d',
        transition: 'all 0.15s',
    },
    roomChipId: {
        fontSize: '0.8rem',
        fontFamily: "'Fira Code', monospace",
        fontWeight: 600,
        color: '#c9d1d9',
    },
    toggleBtn: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
    },
    deleteBtn: {
        background: 'transparent',
        border: 'none',
        color: '#484f58',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '4px',
        transition: 'all 0.15s',
    },
    emailList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
    },
    emailChip: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        background: '#0d1117',
        border: '1px solid #30363d',
    },
    emailText: {
        flex: 1,
        fontSize: '0.85rem',
        color: '#c9d1d9',
    },
    thresholdGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.75rem',
    },
    thresholdCard: {
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '1rem',
    },
    thresholdLabel: {
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#fff',
        marginBottom: '0.2rem',
    },
    thresholdDesc: {
        fontSize: '0.7rem',
        color: '#8b949e',
        marginBottom: '0.75rem',
    },
    thresholdInputWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
    },
    thresholdInput: {
        background: '#161b22',
        border: '1px solid #30363d',
        color: '#fff',
        padding: '0.4rem 0.6rem',
        borderRadius: '6px',
        fontSize: '1rem',
        fontWeight: 700,
        fontFamily: "'Fira Code', monospace",
        width: '80px',
        outline: 'none',
        textAlign: 'center',
    },
    thresholdUnit: {
        fontSize: '0.75rem',
        color: '#8b949e',
        fontWeight: 500,
    },
};
