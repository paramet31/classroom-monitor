/**
 * Scheduler — Server-side automation for email reports and alerts.
 * 
 * Features:
 * 1. Daily Status Report at configured times (default: 09:30 and 13:30)
 * 2. Unrecorded Room Alert — every N minutes, check for rooms that have 
 *    a scheduled class but are NOT being recorded, then send alert email.
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { getRoomList } from '../app/api/status/roomConfig.js';
import { getScheduleForToday, isRoomScheduledNow } from './scheduleScraper.js';
import { getRoomIncidents } from './incidentLogger.js';
import { saveSnapshot } from './snapshotLogger.js';

// ─── State ───────────────────────────────────────────────────────────
let isRunning = false;
let dailyReportTimer = null;
let alertTimer = null;
let lastDailyReportSent = null;     // ISO string
let lastAlertSent = null;           // ISO string
let lastAlertRooms = [];            // rooms alerted last time
let sentAlerts = {};                // { roomId: timestamp } — cooldown tracker
let dailyReportSentFlags = {};      // { "09:30": "2026-03-04", ... } — prevent double-send

// ─── Helpers ─────────────────────────────────────────────────────────

function loadSettings() {
    try {
        const settingsPath = path.join(process.cwd(), 'data', 'settings.json');
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
        console.warn('[Scheduler] Could not read settings.json');
        return {};
    }
}

function getEmailTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

function getRecipients(settings) {
    return (settings.emailRecipients && settings.emailRecipients.length > 0)
        ? settings.emailRecipients
        : ['paramet@siit.tu.ac.th'];
}

function getTodayDateString() {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function getTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getCurrentHHMM() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ─── Fetch with Stealth (same as route.js) ───────────────────────────

async function fetchWithStealth(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                'Cache-Control': 'no-cache',
            },
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        return await response.text();
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ─── Simple Room Status Check ────────────────────────────────────────
// Lightweight version: just checks for today's folder presence on file servers

const SERVERS = {
    RS: {
        fileServers: [
            { url: 'http://192.168.10.240/dir/', label: 'Server-240' },
            { url: 'http://192.168.10.180/dir/', label: 'Server-180' },
        ],
    },
};

async function checkRoomStatus(roomId, dateString, fileServers) {
    for (const server of fileServers) {
        try {
            const html = await fetchWithStealth(server.url);
            if (!html) continue;

            const folderName = `CRRS-${roomId}`;
            const lines = html.split('\n');
            const targetLine = lines.find(line => line.includes(folderName));

            if (!targetLine) continue;

            if (targetLine.includes(dateString)) {
                // Folder exists with today's date — check for files
                const deepUrl = `${server.url}${folderName}/`;
                const deepHtml = await fetchWithStealth(deepUrl);
                if (!deepHtml) return { status: 'Found', time: '' };

                const fileLines = deepHtml.split('\n').filter(l =>
                    l.includes(dateString) && (l.includes('.mp4') || l.includes('.mkv'))
                );

                if (fileLines.length > 0) {
                    // Find latest time and check for bad recording
                    let latestTime = '00:00';
                    let latestMins = 0;
                    let latestLine = '';
                    for (const line of fileLines) {
                        const timeMatch = line.match(/(\d{2}):(\d{2})/);
                        if (timeMatch) {
                            const mins = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                            if (mins > latestMins) {
                                latestMins = mins;
                                latestTime = `${timeMatch[1]}:${timeMatch[2]}`;
                                latestLine = line;
                            }
                        }
                    }

                    // Check for bad recording: file ends with -0.mp4/.mkv and small size
                    const fileMatch = latestLine.match(/href="([^"]+)"/);
                    const latestFileName = fileMatch ? fileMatch[1] : '';
                    const sizeMatch = latestLine.match(/\s(\d+(\.\d+)?[GKM]?)\s*$/i);
                    const latestFileSize = sizeMatch ? sizeMatch[1] : '';
                    const isBadFile = /\-0\.(mp4|mkv)$/i.test(latestFileName);
                    const isSmallFile = /^\d+K?$/i.test(latestFileSize) && !latestFileSize.toUpperCase().endsWith('M') && !latestFileSize.toUpperCase().endsWith('G');

                    if (isBadFile && isSmallFile) {
                        return { status: 'Bad Recording', time: latestTime };
                    }

                    // Check if recording is recent (within 5 minutes)
                    const now = new Date();
                    const nowMins = now.getHours() * 60 + now.getMinutes();
                    const diff = nowMins - latestMins;

                    if (diff <= 5) return { status: 'Active', time: latestTime };
                    if (diff <= 60) return { status: 'Stopped', time: latestTime };
                    return { status: 'Finished', time: latestTime };
                }
                return { status: 'Empty', time: '' };
            }
            return { status: 'Old Folder', time: '' };
        } catch (e) {
            continue;
        }
    }
    return { status: 'No Record', time: '' };
}

// ─── Full Status Fetch (for daily report) ────────────────────────────

async function fetchAllRoomStatuses() {
    console.log('[Scheduler] Fetching all room statuses...');
    const dateString = getTodayDateString();
    const fileServers = SERVERS.RS.fileServers;

    let todaySchedule = {};
    try {
        todaySchedule = await getScheduleForToday();
    } catch (e) {
        console.error('[Scheduler] Schedule fetch failed:', e.message);
    }

    const ROOM_LIST = getRoomList();
    const results = [];

    for (const roomId of ROOM_LIST) {
        try {
            const roomStatus = await checkRoomStatus(roomId, dateString, fileServers);
            const roomSchedule = todaySchedule[roomId] || [];
            const scheduled = isRoomScheduledNow(roomSchedule);

            results.push({
                id: roomId,
                name: `Room ${roomId}`,
                recordFile: roomStatus.status,
                lastRecorded: roomStatus.time,
                fileName: '',
                fileSize: '',
                schedule: roomSchedule,
                isScheduled: scheduled,
                lastCheck: new Date().toLocaleTimeString('en-GB'),
            });
        } catch (e) {
            results.push({
                id: roomId,
                name: `Room ${roomId}`,
                recordFile: 'Error',
                lastRecorded: '',
                schedule: [],
                isScheduled: false,
                lastCheck: new Date().toLocaleTimeString('en-GB'),
            });
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    return results;
}

// ─── 1. Daily Report Email ───────────────────────────────────────────

async function sendDailyReport() {
    console.log('[Scheduler] Sending daily report...');
    const settings = loadSettings();
    const recipients = getRecipients(settings);

    try {
        const rooms = await fetchAllRoomStatuses();

        const activeCounts = rooms.filter(r => r.recordFile === 'Active').length;
        const stoppedCounts = rooms.filter(r => r.recordFile === 'Stopped').length;
        const errorCounts = rooms.filter(r => ['No Record', 'Error'].includes(r.recordFile)).length;
        const finishedCounts = rooms.filter(r => ['Finished', 'Idle', 'Empty'].includes(r.recordFile)).length;

        const now = new Date();
        const timestamp = now.toLocaleString('th-TH');
        const todayDisplay = now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
        const todayStr = getTodayStr();

        // Build incident section
        let incidentHtml = '';
        let hasIncidents = false;
        for (const room of rooms) {
            try {
                const logs = getRoomIncidents(room.id);
                if (!logs) continue;

                let roomRows = '';
                if (logs.ongoingIncident) {
                    const det = new Date(logs.ongoingIncident.startTime);
                    const detStr = det.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + det.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    roomRows += `<tr>
                        <td style="padding:8px;border:1px solid #d0d7de;font-weight:bold">${room.name}</td>
                        <td style="padding:8px;border:1px solid #d0d7de;color:#cf222e;font-weight:bold">⚠ Ongoing</td>
                        <td style="padding:8px;border:1px solid #d0d7de">Since ${detStr}</td>
                        <td style="padding:8px;border:1px solid #d0d7de;color:#cf222e">${logs.ongoingIncident.reason}</td>
                    </tr>`;
                }

                if (logs.incidentHistory) {
                    const todayLogs = logs.incidentHistory.filter(h => {
                        const d = new Date(h.startTime);
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr;
                    });
                    for (const h of todayLogs) {
                        const det = new Date(h.startTime);
                        const cls = new Date(h.endTime);
                        roomRows += `<tr>
                            <td style="padding:8px;border:1px solid #d0d7de;font-weight:bold">${room.name}</td>
                            <td style="padding:8px;border:1px solid #d0d7de;color:#9a6700">Resolved</td>
                            <td style="padding:8px;border:1px solid #d0d7de">${det.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} → ${cls.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} (${h.durationMinutes} min)</td>
                            <td style="padding:8px;border:1px solid #d0d7de">${h.resolution || h.reason}</td>
                        </tr>`;
                    }
                }
                if (roomRows) { hasIncidents = true; incidentHtml += roomRows; }
            } catch (e) { /* skip */ }
        }

        // Room table rows
        const roomRows = rooms.map(r => {
            let statusColor = '#57606a', statusBg = 'transparent';
            if (r.recordFile === 'Active') { statusColor = '#1a7f37'; statusBg = '#e6ffed'; }
            else if (r.recordFile === 'Stopped') { statusColor = '#9a6700'; statusBg = '#fff8c5'; }
            else if (['No Record', 'Error'].includes(r.recordFile)) { statusColor = '#cf222e'; statusBg = '#ffebe9'; }

            const scheduleText = Array.isArray(r.schedule) && r.schedule.length > 0
                ? r.schedule.map(s => `${s.start}-${s.end} ${s.name || ''}`).join('<br/>')
                : 'Free';

            return `<tr>
                <td style="padding:10px;border:1px solid #d0d7de;font-weight:bold">${r.name}</td>
                <td style="padding:10px;border:1px solid #d0d7de;color:${statusColor};background:${statusBg};font-weight:bold">${r.recordFile}</td>
                <td style="padding:10px;border:1px solid #d0d7de;color:#57606a">${r.lastRecorded || '-'}</td>
                <td style="padding:10px;border:1px solid #d0d7de;color:#57606a">${scheduleText}</td>
            </tr>`;
        }).join('');

        const htmlContent = `
        <div style="font-family:Arial,sans-serif;color:#333;max-width:800px;margin:0 auto;line-height:1.6">
            <h2 style="color:#238636;border-bottom:2px solid #eaebf1;padding-bottom:10px">
                📊 Automated Daily Report — Campus RS
            </h2>
            <p><strong>Report Date:</strong> ${todayDisplay}</p>
            <p style="margin-top:-5px"><strong>Generated at:</strong> ${timestamp} (Automated)</p>

            <div style="display:flex;gap:10px;margin-bottom:25px">
                <div style="background:#e6ffed;padding:15px;border-radius:6px;text-align:center;flex:1">
                    <h3 style="margin:0;color:#1a7f37;font-size:24px">${activeCounts}</h3>
                    <span style="font-size:13px;color:#1a7f37;font-weight:bold">Active</span>
                </div>
                <div style="background:#fff8c5;padding:15px;border-radius:6px;text-align:center;flex:1">
                    <h3 style="margin:0;color:#9a6700;font-size:24px">${stoppedCounts}</h3>
                    <span style="font-size:13px;color:#9a6700;font-weight:bold">Stopped</span>
                </div>
                <div style="background:#ffebe9;padding:15px;border-radius:6px;text-align:center;flex:1">
                    <h3 style="margin:0;color:#cf222e;font-size:24px">${errorCounts}</h3>
                    <span style="font-size:13px;color:#cf222e;font-weight:bold">Error</span>
                </div>
                <div style="background:#f6f8fa;padding:15px;border-radius:6px;text-align:center;flex:1">
                    <h3 style="margin:0;color:#57606a;font-size:24px">${finishedCounts}</h3>
                    <span style="font-size:13px;color:#57606a;font-weight:bold">Finished</span>
                </div>
            </div>

            ${hasIncidents ? `
            <div style="margin-top:20px;border:1px solid #cf222e;border-radius:6px;overflow:hidden">
                <div style="background:#ffebe9;padding:10px 15px;border-bottom:1px solid #cf222e">
                    <h3 style="margin:0;color:#cf222e;font-size:16px">🚨 Incident Logs — ${todayDisplay}</h3>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f6f8fa">
                        <th style="padding:8px;border:1px solid #d0d7de;text-align:left">Room</th>
                        <th style="padding:8px;border:1px solid #d0d7de;text-align:left">State</th>
                        <th style="padding:8px;border:1px solid #d0d7de;text-align:left">Timeline</th>
                        <th style="padding:8px;border:1px solid #d0d7de;text-align:left">Detail</th>
                    </tr></thead>
                    <tbody>${incidentHtml}</tbody>
                </table>
            </div>` : ''}

            <h3 style="color:#444;margin-top:30px">All Rooms (${rooms.length}):</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
                <thead><tr style="background:#f6f8fa">
                    <th style="padding:10px;border:1px solid #d0d7de;text-align:left">Room</th>
                    <th style="padding:10px;border:1px solid #d0d7de;text-align:left">Status</th>
                    <th style="padding:10px;border:1px solid #d0d7de;text-align:left">Last Update</th>
                    <th style="padding:10px;border:1px solid #d0d7de;text-align:left">Schedule</th>
                </tr></thead>
                <tbody>${roomRows}</tbody>
            </table>

            <hr style="border:0;border-top:1px solid #eaebf1;margin:30px 0"/>
            <p style="font-size:11px;color:#888;text-align:center">
                This is an automated report from the SIIT Classroom Monitoring System.
            </p>
        </div>`;

        const transporter = getEmailTransporter();
        await transporter.sendMail({
            from: `"Classroom Monitor" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: `📊 Daily Report: Campus RS (${timestamp})`,
            html: htmlContent,
        });

        lastDailyReportSent = new Date().toISOString();
        console.log(`[Scheduler] ✅ Daily report sent to ${recipients.length} recipients`);
    } catch (error) {
        console.error('[Scheduler] ❌ Failed to send daily report:', error.message);
    }
}

// ─── 2. Unrecorded Room Alert ────────────────────────────────────────

async function checkAndAlertUnrecordedRooms() {
    const settings = loadSettings();
    const automation = settings.automation || {};
    if (automation.unrecordedAlertEnabled === false) return;

    const cooldownMinutes = automation.alertCooldownMinutes || 30;
    const recipients = getRecipients(settings);
    const now = new Date();

    console.log('[Scheduler] Checking for unrecorded rooms with scheduled classes...');

    try {
        const rooms = await fetchAllRoomStatuses();

        // --- Save Full Status Snapshot ---
        saveSnapshot(rooms);

        // Find rooms that are scheduled NOW but NOT actively recording
        const problemRooms = rooms.filter(room => {
            if (!room.isScheduled) return false;
            // These statuses mean the room is NOT recording properly
            return ['No Record', 'Stopped', 'Error', 'Empty', 'Old Folder', 'Idle', 'Bad Recording'].includes(room.recordFile);
        });

        if (problemRooms.length === 0) {
            console.log('[Scheduler] All scheduled rooms are recording properly ✅');
            return;
        }

        // Apply cooldown — don't re-alert same room within cooldown period
        const roomsToAlert = problemRooms.filter(room => {
            const lastAlert = sentAlerts[room.id];
            if (!lastAlert) return true;
            const minutesSinceAlert = (now.getTime() - lastAlert) / 60000;
            return minutesSinceAlert >= cooldownMinutes;
        });

        if (roomsToAlert.length === 0) {
            console.log(`[Scheduler] ${problemRooms.length} room(s) have issues but cooldown active`);
            return;
        }

        // Build alert email
        const timestamp = now.toLocaleString('th-TH');
        const roomListHtml = roomsToAlert.map(room => {
            const currentClass = room.schedule.find(s => {
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const [sH, sM] = s.start.split(':').map(Number);
                const [eH, eM] = s.end.split(':').map(Number);
                return nowMin >= (sH * 60 + sM) && nowMin < (eH * 60 + eM);
            });

            return `<tr>
                <td style="padding:12px;border:1px solid #d0d7de;font-weight:bold;color:#24292f">${room.name}</td>
                <td style="padding:12px;border:1px solid #d0d7de;color:#cf222e;font-weight:bold;background:#ffebe9">${room.recordFile}</td>
                <td style="padding:12px;border:1px solid #d0d7de;color:#57606a">${room.lastRecorded || 'ไม่มี'}</td>
                <td style="padding:12px;border:1px solid #d0d7de;color:#1a7f37;font-weight:bold">
                    ${currentClass ? `${currentClass.start}-${currentClass.end} ${currentClass.name || ''}` : 'มีคลาสเรียน'}
                </td>
            </tr>`;
        }).join('');

        const htmlContent = `
        <div style="font-family:Arial,sans-serif;color:#333;max-width:700px;margin:0 auto;line-height:1.6">
            <div style="background:#ffebe9;border:2px solid #cf222e;border-radius:8px;padding:20px;margin-bottom:20px">
                <h2 style="margin:0 0 5px;color:#cf222e">🚨 แจ้งเตือน: ห้องที่ไม่ถูกบันทึก</h2>
                <p style="margin:0;color:#57606a;font-size:14px">
                    พบ <strong>${roomsToAlert.length} ห้อง</strong> ที่มีคลาสเรียนอยู่แต่ไม่ได้ถูกบันทึกภาพ
                </p>
                <p style="margin:5px 0 0;font-size:12px;color:#888">ตรวจสอบเมื่อ: ${timestamp}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
                <thead>
                    <tr style="background:#f6f8fa">
                        <th style="padding:12px;border:1px solid #d0d7de;text-align:left">ห้อง</th>
                        <th style="padding:12px;border:1px solid #d0d7de;text-align:left">สถานะ</th>
                        <th style="padding:12px;border:1px solid #d0d7de;text-align:left">บันทึกล่าสุด</th>
                        <th style="padding:12px;border:1px solid #d0d7de;text-align:left">คลาสเรียนปัจจุบัน</th>
                    </tr>
                </thead>
                <tbody>${roomListHtml}</tbody>
            </table>

            <p style="font-size:13px;color:#57606a">
                กรุณาตรวจสอบระบบบันทึกในห้องเรียนดังกล่าว<br/>
                ระบบจะแจ้งเตือนอีกครั้งหลังจาก ${cooldownMinutes} นาที หากยังไม่ได้รับการแก้ไข
            </p>

            <hr style="border:0;border-top:1px solid #eaebf1;margin:20px 0"/>
            <p style="font-size:11px;color:#888;text-align:center">
                Automated alert from SIIT Classroom Monitoring System
            </p>
        </div>`;

        const transporter = getEmailTransporter();
        const subjectDate = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

        // Use a deterministic thread ID for the entire day.
        // Even if the server restarts, every email today will link to this ID.
        const todayStr = getTodayStr();
        const dailyThreadId = `<alert-thread-${todayStr}@classroom-monitor.local>`;

        const mailOptions = {
            from: `"Classroom Monitor ⚠️" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: `🚨 แจ้งเตือน: ปัญหาระบบบันทึกห้องเรียน (${subjectDate})`,
            html: htmlContent,
            messageId: `<alert-reply-${now.getTime()}@classroom-monitor.local>`,
            inReplyTo: dailyThreadId,
            references: [dailyThreadId]
        };

        await transporter.sendMail(mailOptions);

        // Update cooldown tracker
        for (const room of roomsToAlert) {
            sentAlerts[room.id] = now.getTime();
        }

        lastAlertSent = now.toISOString();
        lastAlertRooms = roomsToAlert.map(r => r.id);
        console.log(`[Scheduler] ⚠️ Alert sent for ${roomsToAlert.length} rooms: ${roomsToAlert.map(r => r.id).join(', ')}`);
    } catch (error) {
        console.error('[Scheduler] ❌ Failed to check/alert:', error.message);
    }
}

// ─── Main Scheduler ──────────────────────────────────────────────────

export function startScheduler() {
    if (isRunning) {
        console.log('[Scheduler] Already running, skipping duplicate start');
        return;
    }

    const settings = loadSettings();
    const automation = settings.automation || {};
    const reportTimes = automation.dailyReportTimes || ['09:30', '13:30'];
    const alertInterval = (automation.alertIntervalMinutes || 5) * 60 * 1000;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  📧 Email Automation Scheduler Started           ║');
    console.log(`║  Daily Report: ${reportTimes.join(', ').padEnd(35)}║`);
    console.log(`║  Alert Check:  every ${automation.alertIntervalMinutes || 5} min${' '.repeat(24)}║`);
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');

    isRunning = true;

    // ── Daily Report Timer (check every 30 seconds) ──
    dailyReportTimer = setInterval(() => {
        const currentTime = getCurrentHHMM();
        const todayDate = getTodayStr();

        for (const reportTime of reportTimes) {
            if (currentTime === reportTime && dailyReportSentFlags[reportTime] !== todayDate) {
                dailyReportSentFlags[reportTime] = todayDate;
                sendDailyReport();
            }
        }
    }, 30 * 1000);

    // ── Unrecorded Room Alert Timer ──
    if (automation.unrecordedAlertEnabled !== false) {
        // First check after 2 minutes (let server warm up)
        setTimeout(() => {
            checkAndAlertUnrecordedRooms();
        }, 2 * 60 * 1000);

        alertTimer = setInterval(() => {
            // Only check during class hours (07:00 - 20:00)
            const hour = new Date().getHours();
            if (hour >= 7 && hour < 20) {
                checkAndAlertUnrecordedRooms();
            }
        }, alertInterval);
    }
}

export function stopScheduler() {
    if (dailyReportTimer) clearInterval(dailyReportTimer);
    if (alertTimer) clearInterval(alertTimer);
    isRunning = false;
    console.log('[Scheduler] Stopped');
}

export function getSchedulerStatus() {
    return {
        isRunning,
        lastDailyReportSent,
        lastAlertSent,
        lastAlertRooms,
        dailyReportSentFlags,
    };
}
