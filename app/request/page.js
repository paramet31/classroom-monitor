'use client';

import { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Plus, Trash2, Mail, FileText, Target, Package } from 'lucide-react';

const SUBJECTS = [
    { v: 'ขอใช้อุปกรณ์', icon: '🎤', color: '#818cf8' },
    { v: 'ขอใช้สถานที่', icon: '🏛️', color: '#34d399' },
    { v: 'จัดเตรียมการถ่ายทอดสด Live Stream', icon: '📡', color: '#f472b6' },
    { v: 'อื่นๆ', icon: '📝', color: '#fbbf24' },
];

const PURPOSES = [
    { id: 'info', label: 'For your information', th: 'เพื่อโปรดทราบ' },
    { id: 'comments', label: 'For your comments', th: 'เพื่อขอความคิดเห็น' },
    { id: 'approval', label: 'For your approval', th: 'เพื่อพิจารณาอนุมัติ' },
    { id: 'signature', label: 'For your signature', th: 'เพื่อลงนาม' },
    { id: 'handle', label: 'Please handle', th: 'โปรดดำเนินการ' },
    { id: 'requested', label: 'As you requested', th: 'ตามที่ท่านต้องการ' },
];

const EMPTY = { material: '', quantity: '', setupDatetime: '', usageDatetime: '', location: '' };

export default function RequestPage() {
    const [email, setEmail] = useState('');
    const [to, setTo] = useState('หัวหน้าฝ่าย / ผู้ช่วยหัวหน้าฝ่าย ศูนย์คอมพิวเตอร์และโสตทัศนศึกษา');
    const [subject, setSubject] = useState('');
    const [purpose, setPurpose] = useState([]);
    const [detail, setDetail] = useState('');
    const [items, setItems] = useState([{ ...EMPTY }]);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [focused, setFocused] = useState('');

    const toggle = (id) => setPurpose(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    const upd = (i, k, v) => { const u = [...items]; u[i] = { ...u[i], [k]: v }; setItems(u); };
    const removeItem = (i) => setItems(items.filter((_, x) => x !== i));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !subject) {
            setResult({ ok: false, msg: 'กรุณากรอก Email และเลือกเรื่อง' });
            setTimeout(() => setResult(null), 4000); return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/requests', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, to, subject, purpose, detail, items })
            });
            if (res.ok) {
                const data = await res.json();
                setResult({ ok: true, msg: `ส่งคำร้องสำเร็จ! Ref: ${data.id}` });
                setEmail(''); setSubject(''); setPurpose([]); setDetail('');
                setItems([{ ...EMPTY }]);
            } else {
                const errData = await res.json().catch(() => ({}));
                setResult({ ok: false, msg: errData.details || errData.error || 'เกิดข้อผิดพลาด' });
            }
        } catch (e) { 
            setResult({ ok: false, msg: 'ไม่สามารถเชื่อมต่อได้: ' + e.message }); 
        }
        setSubmitting(false);
        setTimeout(() => setResult(null), 6000);
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { font-family: 'Inter', -apple-system, sans-serif; }
                input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
                input::placeholder, textarea::placeholder { color: #4b5563; }
                @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
                @keyframes toast { from { opacity:0; transform:translateX(30px) } to { opacity:1; transform:translateX(0) } }
                .card { animation: fadeUp 0.4s ease both; }
                .card:nth-child(2) { animation-delay: 0.05s; }
                .card:nth-child(3) { animation-delay: 0.1s; }
                .card:nth-child(4) { animation-delay: 0.15s; }
                select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
                .subj-card { transition: all 0.2s ease; }
                .subj-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
                .item-card { transition: all 0.2s ease; }
                .item-card:hover { border-color: rgba(99,102,241,0.3); }
                .add-btn { transition: all 0.2s; }
                .add-btn:hover { border-color: #6366f1; color: #a5b4fc; background: rgba(99,102,241,0.05); }
                .submit-btn { transition: all 0.2s; }
                .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(99,102,241,0.4); }
                .check-card { transition: all 0.15s ease; }
                .check-card:hover { background: rgba(255,255,255,0.02); }
            `}</style>

            <div style={{ minHeight: '100vh', background: '#09090b', position: 'relative', overflow: 'hidden' }}>
                {/* Gradient blobs */}
                <div style={{ position: 'fixed', top: -300, right: -200, width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ position: 'fixed', bottom: -300, left: -200, width: 600, height: 600, background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

                {/* Toast */}
                {result && (
                    <div style={{
                        position: 'fixed', top: 24, right: 24, zIndex: 9999, animation: 'toast 0.3s ease',
                        padding: '14px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                        background: result.ok ? 'linear-gradient(135deg, #065f46, #064e3b)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)',
                        border: `1px solid ${result.ok ? '#10b981' : '#ef4444'}33`,
                        color: '#fff', fontSize: '0.85rem', fontWeight: 500,
                        boxShadow: `0 20px 40px ${result.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                    }}>
                        {result.ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        {result.msg}
                    </div>
                )}

                <div style={{ maxWidth: 820, margin: '0 auto', padding: '2.5rem 1.5rem 4rem', position: 'relative', zIndex: 1 }}>
                    {/* Header */}
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div style={{ marginBottom: 16 }}>
                            <img src="https://spms.siit.tu.ac.th/siitlogo.png" alt="SIIT"
                                style={{ height: 52, objectFit: 'contain' }}
                                onError={(e) => { e.target.style.display = 'none'; }} />
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 12 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a5b4fc', letterSpacing: '0.04em' }}>SIIT AV CENTER</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fafafa', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                            Audio Visual<br />Requisition Form
                        </h1>
                        <p style={{ fontSize: '1.05rem', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
                            กรอกแบบฟอร์มด้านล่างเพื่อส่งคำร้องขอใช้อุปกรณ์โสตทัศนศึกษา
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* ─── Card 1: Info ─── */}
                        <div className="card" style={card}>
                            <div style={cardHead}>
                                <div style={{ ...iconBox, background: 'rgba(99,102,241,0.1)' }}><Mail size={16} color="#818cf8" /></div>
                                <div>
                                    <h2 style={cardTitle}>ข้อมูลผู้ขอ</h2>
                                    <p style={cardDesc}>กรอกอีเมลและเลือกประเภทคำร้อง</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={lbl}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        placeholder="you@siit.tu.ac.th" style={inp}
                                        onFocus={() => setFocused('email')} onBlur={() => setFocused('')} />
                                </div>
                                <div>
                                    <label style={lbl}>เรียน (To)</label>
                                    <select value={to} onChange={e => setTo(e.target.value)} style={inp}>
                                        <option>หัวหน้าฝ่าย / ผู้ช่วยหัวหน้าฝ่าย ศูนย์คอมพิวเตอร์และโสตทัศนศึกษา</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <label style={lbl}>เรื่อง (Subject) <span style={{ color: '#ef4444' }}>*</span></label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                    {SUBJECTS.map(s => {
                                        const sel = subject === s.v;
                                        return (
                                            <button type="button" key={s.v} className="subj-card" onClick={() => setSubject(s.v)}
                                                style={{
                                                    padding: '16px 20px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                                                    background: sel ? `${s.color}10` : '#18181b',
                                                    border: `1.5px solid ${sel ? s.color + '66' : '#27272a'}`,
                                                    display: 'flex', alignItems: 'center', gap: 14,
                                                }}>
                                                <span style={{ fontSize: '1.6rem' }}>{s.icon}</span>
                                                <div>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: sel ? '#fafafa' : '#a1a1aa' }}>{s.v}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ─── Card 2: Purpose ─── */}
                        <div className="card" style={card}>
                            <div style={cardHead}>
                                <div style={{ ...iconBox, background: 'rgba(168,85,247,0.1)' }}><Target size={16} color="#c084fc" /></div>
                                <div>
                                    <h2 style={cardTitle}>วัตถุประสงค์</h2>
                                    <p style={cardDesc}>เลือกได้หลายข้อ</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {PURPOSES.map(p => {
                                    const a = purpose.includes(p.id);
                                    return (
                                        <label key={p.id} className="check-card" style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                            padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                                            border: `1px solid ${a ? '#6366f133' : '#27272a'}`,
                                            background: a ? 'rgba(99,102,241,0.05)' : 'transparent',
                                        }}>
                                            <div style={{
                                                width: 22, height: 22, borderRadius: 5, marginTop: 1, flexShrink: 0,
                                                border: `2px solid ${a ? '#6366f1' : '#3f3f46'}`,
                                                background: a ? '#6366f1' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.15s',
                                            }}>
                                                {a && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                            </div>
                                            <input type="checkbox" checked={a} onChange={() => toggle(p.id)} style={{ display: 'none' }} />
                                            <div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: a ? '#e4e4e7' : '#a1a1aa', lineHeight: 1.3 }}>{p.label}</div>
                                                <div style={{ fontSize: '0.82rem', color: '#52525b', marginTop: 2 }}>{p.th}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <label style={lbl}>รายละเอียดเพิ่มเติม</label>
                                <textarea value={detail} onChange={e => setDetail(e.target.value)}
                                    placeholder="อธิบายรายละเอียดงาน..."
                                    rows={3} style={{ ...inp, resize: 'vertical', minHeight: 80 }} />
                            </div>
                        </div>

                        {/* ─── Card 3: Items ─── */}
                        <div className="card" style={card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={cardHead}>
                                    <div style={{ ...iconBox, background: 'rgba(52,211,153,0.1)' }}><Package size={16} color="#6ee7b7" /></div>
                                    <div>
                                        <h2 style={cardTitle}>รายการอุปกรณ์</h2>
                                        <p style={cardDesc}>ระบุอุปกรณ์ที่ต้องการ</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                {items.map((item, i) => (
                                    <div key={i} className="item-card" style={{
                                        background: '#18181b', border: '1px solid #27272a',
                                        borderRadius: 12, padding: '16px 18px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#818cf8' }}>
                                                    {i + 1}
                                                </div>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#71717a' }}>Item</span>
                                            </div>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => removeItem(i)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', padding: '4px 8px', borderRadius: 4 }}>
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 10 }}>
                                            <div>
                                                <label style={lblSm}>Materials / Equipment</label>
                                                <input type="text" value={item.material} onChange={e => upd(i, 'material', e.target.value)}
                                                    placeholder="ชื่ออุปกรณ์ / สถานที่" style={inpSm} />
                                            </div>
                                            <div>
                                                <label style={lblSm}>Qty</label>
                                                <input type="number" value={item.quantity} onChange={e => upd(i, 'quantity', e.target.value)}
                                                    placeholder="1" min="1" style={inpSm} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                            <div>
                                                <label style={lblSm}>Setup Date/Time</label>
                                                <input type="datetime-local" value={item.setupDatetime}
                                                    onChange={e => upd(i, 'setupDatetime', e.target.value)} style={inpSm} />
                                            </div>
                                            <div>
                                                <label style={lblSm}>Usage Date/Time</label>
                                                <input type="datetime-local" value={item.usageDatetime}
                                                    onChange={e => upd(i, 'usageDatetime', e.target.value)} style={inpSm} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={lblSm}>Location</label>
                                            <input type="text" value={item.location} onChange={e => upd(i, 'location', e.target.value)}
                                                placeholder="ห้อง / อาคาร" style={inpSm} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button type="button" className="add-btn" onClick={() => setItems([...items, { ...EMPTY }])}
                                style={{
                                    width: '100%', padding: '10px', marginTop: 10, borderRadius: 10,
                                    border: '1.5px dashed #27272a', background: 'transparent',
                                    color: '#52525b', fontSize: '0.92rem', fontWeight: 500,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                }}>
                                <Plus size={15} /> เพิ่มรายการ
                            </button>
                        </div>

                        {/* ─── Submit ─── */}
                        <div className="card" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                            <button type="submit" className="submit-btn" disabled={submitting}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '16px 32px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                    color: '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
                                }}>
                                <Send size={16} />
                                {submitting ? 'กำลังส่ง...' : 'ส่งคำร้อง'}
                            </button>
                        </div>
                    </form>

                    <p style={{ textAlign: 'center', fontSize: '0.62rem', color: '#3f3f46', marginTop: '3rem' }}>
                        © 2026 SIIT Computer & AV Center · Classroom Monitor
                    </p>
                </div>
            </div>
        </>
    );
}

/* ─── Styles ─── */
const card = {
    background: 'rgba(24,24,27,0.6)', border: '1px solid #27272a', borderRadius: 16,
    padding: '24px', marginBottom: 16,
    backdropFilter: 'blur(12px)',
};

const cardHead = { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 };
const iconBox = { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const cardTitle = { fontSize: '1.2rem', fontWeight: 700, color: '#fafafa', margin: 0 };
const cardDesc = { fontSize: '0.88rem', color: '#71717a', margin: 0 };

const lbl = { display: 'block', fontSize: '0.95rem', fontWeight: 600, color: '#a1a1aa', marginBottom: 8 };
const lblSm = { display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#71717a', marginBottom: 5 };

const inp = {
    width: '100%', boxSizing: 'border-box',
    background: '#09090b', border: '1.5px solid #27272a', color: '#fafafa',
    padding: '14px 16px', borderRadius: 10, fontSize: '1rem',
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
};

const inpSm = {
    width: '100%', boxSizing: 'border-box',
    background: '#09090b', border: '1.5px solid #27272a', color: '#fafafa',
    padding: '12px 14px', borderRadius: 8, fontSize: '0.95rem',
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
};
