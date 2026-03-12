import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { getRoomIncidents } from '../../../lib/incidentLogger';

export async function POST(request) {
    try {
        const body = await request.json();
        const { rooms, campus } = body;

        if (!rooms || !Array.isArray(rooms)) {
            return NextResponse.json({ error: 'Invalid room data provided' }, { status: 400 });
        }

        // Email Configuration
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Read email recipients from settings
        let targetEmails = ['payoot@siit.tu.ac.th', 'narut@siit.tu.ac.th', 'kowit@siit.tu.ac.th', 'paramet@siit.tu.ac.th'];
        try {
            const settingsPath = path.join(process.cwd(), 'data', 'settings.json');
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.emailRecipients && settings.emailRecipients.length > 0) {
                targetEmails = settings.emailRecipients;
            }
        } catch (e) {
            console.warn('[Report] Could not read settings, using default emails');
        }

        // Format stats
        let activeCounts = 0;
        let stoppedCounts = 0;
        let finishedCounts = 0;
        let errorCounts = 0;

        const problematicRooms = [];

        // Incident parsing
        let incidentHtml = '';
        let hasIncidents = false;

        // Helper: get today's date string for filtering
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayDisplay = now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

        rooms.forEach(room => {
            if (room.recordFile === 'Active') activeCounts++;
            else if (room.recordFile === 'Stopped') {
                stoppedCounts++;
                problematicRooms.push(room);
            }
            else if (room.recordFile === 'Finished' || room.recordFile === 'Idle') finishedCounts++;
            else {
                errorCounts++;
                if (room.recordFile === 'No Record' || room.recordFile === 'Error' || room.recordFile === 'Bad Recording') {
                    problematicRooms.push(room);
                }
            }

            // Fetch logs for this room
            try {
                const logs = getRoomIncidents(room.id);
                if (logs) {
                    let roomIncidentRows = '';

                    if (logs.ongoingIncident) {
                        const detectedDate = new Date(logs.ongoingIncident.startTime);
                        const detectedStr = detectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + detectedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        roomIncidentRows += `
                            <tr>
                                <td style="padding: 10px; border: 1px solid #d0d7de; font-weight: bold;">${room.name}</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de; color: #cf222e; font-weight: bold;">⚠ Ongoing</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de;">Detected at ${detectedStr}</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de; color: #cf222e;">${logs.ongoingIncident.reason}</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de; color: #cf222e;">—</td>
                            </tr>
                         `;
                    }

                    if (logs.incidentHistory && logs.incidentHistory.length > 0) {
                        // Filter to only today's incidents
                        const todayLogs = logs.incidentHistory.filter(h => {
                            const incDate = new Date(h.startTime);
                            const incDateStr = `${incDate.getFullYear()}-${String(incDate.getMonth() + 1).padStart(2, '0')}-${String(incDate.getDate()).padStart(2, '0')}`;
                            return incDateStr === todayStr;
                        });
                        todayLogs.forEach(history => {
                            const detectedDate = new Date(history.startTime);
                            const detectedStr = detectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + detectedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                            const closedDate = new Date(history.endTime);
                            const closedStr = closedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + closedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                            const issue = (history.reason || '').replace(' (class ended)', '');
                            const resolution = history.resolution || (history.reason?.includes('class ended') ? 'Class period ended' : 'Recording resumed');
                            roomIncidentRows += `
                             <tr>
                                <td style="padding: 10px; border: 1px solid #d0d7de; font-weight: bold;">${room.name}</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de; color: #9a6700; font-weight: bold;">Resolved</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de;">Detected ${detectedStr} → Closed ${closedStr} (${history.durationMinutes} min)</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de;">${issue}</td>
                                <td style="padding: 10px; border: 1px solid #d0d7de; color: #57606a;">${resolution}</td>
                            </tr>
                           `;
                        });
                    }

                    if (roomIncidentRows) {
                        hasIncidents = true;
                        incidentHtml += roomIncidentRows;
                    }
                }
            } catch (e) {
                console.error("Failed to parse logs for report: ", e);
            }
        });

        // Current Datetime for report
        const timestamp = new Date().toLocaleString('th-TH');

        // Build HTML Report
        const htmlContent = `
                            < div style = "font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6;" >
                <h2 style="color: #238636; border-bottom: 2px solid #eaebf1; padding-bottom: 10px;">
                    Classroom Monitor Report - Campus ${campus}
                </h2>
                <p><strong>Report Date:</strong> ${todayDisplay}</p>
                <p style="margin-top: -5px;"><strong>Generated at:</strong> ${timestamp}</p>
                
                <div style="display: flex; gap: 10px; margin-bottom: 25px;">
                    <div style="background: #e6ffed; padding: 15px; border-radius: 6px; text-align: center; flex: 1;">
                        <h3 style="margin: 0; color: #1a7f37; font-size: 24px;">${activeCounts}</h3>
                        <span style="font-size: 13px; color: #1a7f37; font-weight: bold;">Active</span>
                    </div>
                    <div style="background: #fff8c5; padding: 15px; border-radius: 6px; text-align: center; flex: 1;">
                        <h3 style="margin: 0; color: #9a6700; font-size: 24px;">${stoppedCounts}</h3>
                        <span style="font-size: 13px; color: #9a6700; font-weight: bold;">Stopped</span>
                    </div>
                    <div style="background: #ffebe9; padding: 15px; border-radius: 6px; text-align: center; flex: 1;">
                        <h3 style="margin: 0; color: #cf222e; font-size: 24px;">${errorCounts}</h3>
                        <span style="font-size: 13px; color: #cf222e; font-weight: bold;">Error / No Record</span>
                    </div>
                     <div style="background: #f6f8fa; padding: 15px; border-radius: 6px; text-align: center; flex: 1;">
                        <h3 style="margin: 0; color: #57606a; font-size: 24px;">${finishedCounts}</h3>
                        <span style="font-size: 13px; color: #57606a; font-weight: bold;">Finished</span>
                    </div>
                </div>
                
                ${hasIncidents ? `
                <div style="margin-top: 30px; border: 1px solid #cf222e; border-radius: 6px; overflow: hidden;">
                    <div style="background: #ffebe9; padding: 10px 15px; border-bottom: 1px solid #cf222e;">
                        <h3 style="margin: 0; color: #cf222e; font-size: 16px;">🚨 Incident & Downtime Logs — ${todayDisplay}</h3>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #f6f8fa;">
                                <th style="padding: 10px; border: 1px solid #d0d7de; text-align: left;">Room</th>
                                <th style="padding: 10px; border: 1px solid #d0d7de; text-align: left;">State</th>
                                <th style="padding: 10px; border: 1px solid #d0d7de; text-align: left;">Timeline</th>
                                <th style="padding: 10px; border: 1px solid #d0d7de; text-align: left;">Issue</th>
                                <th style="padding: 10px; border: 1px solid #d0d7de; text-align: left;">Resolution</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidentHtml}
                        </tbody>
                    </table>
                </div>
                ` : ''
            }

                <h3 style="color: #444; margin-top: 30px;">All Room Details (${rooms.length} Rooms):</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f6f8fa;">
                            <th style="padding: 12px; border: 1px solid #d0d7de; text-align: left;">Room</th>
                            <th style="padding: 12px; border: 1px solid #d0d7de; text-align: left;">Status</th>
                            <th style="padding: 12px; border: 1px solid #d0d7de; text-align: left;">Last Update</th>
                            <th style="padding: 12px; border: 1px solid #d0d7de; text-align: left;">File Name</th>
                            <th style="padding: 12px; border: 1px solid #d0d7de; text-align: left;">Size</th>
                            <th style="padding: 12px; border: 1px solid #d0d7de; text-align: left;">Schedule</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rooms.map(r => {
                let statusColor = '#57606a'; // default grey
                let statusBg = 'transparent';
                if (r.recordFile === 'Active') {
                    statusColor = '#1a7f37';
                    statusBg = '#e6ffed';
                } else if (r.recordFile === 'Stopped') {
                    statusColor = '#9a6700';
                    statusBg = '#fff8c5';
                } else if (r.recordFile === 'Error' || r.recordFile === 'No Record') {
                    statusColor = '#cf222e';
                    statusBg = '#ffebe9';
                } else if (r.recordFile === 'Bad Recording') {
                    statusColor = '#d97706';
                    statusBg = '#fef3c7';
                }

                return `
                            <tr>
                                <td style="padding: 12px; border: 1px solid #d0d7de; font-weight: bold; color: #24292f;">
                                    ${r.name}
                                </td>
                                <td style="padding: 12px; border: 1px solid #d0d7de; color: ${statusColor}; background-color: ${statusBg}; font-weight: bold;">
                                    ${r.recordFile}
                                </td>
                                <td style="padding: 12px; border: 1px solid #d0d7de; color: #57606a;">
                                    ${r.lastRecorded || '-'}
                                </td>
                                <td style="padding: 12px; border: 1px solid #d0d7de; color: #0969da; font-family: monospace;">
                                    ${r.fileName || '-'}
                                </td>
                                <td style="padding: 12px; border: 1px solid #d0d7de; color: #57606a;">
                                    ${r.fileSize || '-'}
                                </td>
                                <td style="padding: 12px; border: 1px solid #d0d7de; color: #57606a;">
                                    ${Array.isArray(r.schedule) && r.schedule.length > 0
                        ? r.schedule.map(s => `${s.start}-${s.end}${s.name ? ' ' + s.name : ''}`).join('<br/>')
                        : 'Free'}
                                </td>
                            </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>

                <br />
                <hr style="border: 0; border-top: 1px solid #eaebf1; margin: 30px 0;" />
                <p style="font-size: 11px; color: #888; text-align: center;">This is an automated report from the SIIT Classroom Monitoring System.</p>
            </div >
                            `;

        // Send Email
        const info = await transporter.sendMail({
            from: `"Classroom Monitor" < ${process.env.EMAIL_USER}> `,
            to: targetEmails.join(', '),
            subject: `🚨 System Report: Campus ${campus} Status(${timestamp})`,
            html: htmlContent,
        });

        console.log("Message sent: %s", info.messageId);

        return NextResponse.json({ success: true, message: 'Report sent successfully!' });

    } catch (error) {
        console.error('Email sending error:', error);
        return NextResponse.json(
            { error: 'Failed to send report. Check email config details.' },
            { status: 500 }
        );
    }
}
