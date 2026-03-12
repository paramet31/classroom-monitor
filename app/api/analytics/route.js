import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'incidents');
const FILE_PATH = path.join(DATA_DIR, 'incidents.json');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');

function readData(dateStr) {
    if (!dateStr || dateStr === 'today') {
        try {
            return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        } catch {
            return {};
        }
    } else {
        const archivePath = path.join(ARCHIVE_DIR, `${dateStr}.json`);
        try {
            return JSON.parse(fs.readFileSync(archivePath, 'utf8'));
        } catch {
            return {};
        }
    }
}

// Generate an array of times every X minutes from start to end of day
function generateTimeSlots(intervalMinutes = 15) {
    const slots = [];
    let h = 0;
    while (h < 24) {
        let m = 0;
        while (m < 60) {
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            m += intervalMinutes;
        }
        h++;
    }
    return slots;
}

function timeStrToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

// Read snapshot file for a given date
// Returns: { "07:28": { timestamp, rooms: [...] }, "07:31": { ... }, ... }
function readSnapshots(dateStr) {
    let fileDateStr = dateStr;
    if (!dateStr || dateStr === 'today') {
        fileDateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    }
    const snapshotPath = path.join(SNAPSHOT_DIR, `${fileDateStr}.json`);
    try {
        return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
        return {};
    }
}

// Count rooms with recordFile === 'Active' in a snapshot's rooms array
// Returns { count, roomIds }
function getActiveRoomsInSnapshot(rooms) {
    if (!rooms || !Array.isArray(rooms)) return { count: 0, roomIds: [] };
    const activeRooms = rooms.filter(r => r.recordFile === 'Active');
    return { count: activeRooms.length, roomIds: activeRooms.map(r => r.id) };
}

// Find the nearest snapshot for a given time (in minutes)
function findNearestSnapshot(snapshots, targetMinutes) {
    const keys = Object.keys(snapshots);
    if (keys.length === 0) return null;

    let bestKey = null;
    let bestDiff = Infinity;
    for (const key of keys) {
        const snapshotMinutes = timeStrToMinutes(key);
        const diff = Math.abs(snapshotMinutes - targetMinutes);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestKey = key;
        }
    }
    return bestKey ? snapshots[bestKey] : null;
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get('date') || 'today';
        const rawData = readData(dateStr);

        // Ensure total rooms count is correct based on what is registered
        const totalRooms = Object.keys(rawData).length;
        if (totalRooms === 0) {
            return NextResponse.json({ timeSeries: [], logs: [] });
        }

        // Read snapshot data for counting active rooms
        const snapshots = readSnapshots(dateStr);
        const hasSnapshots = Object.keys(snapshots).length > 0;

        // Pre-compute active room data per snapshot for efficiency
        const snapshotKeys = Object.keys(snapshots).sort();
        const snapshotActiveMap = {};
        for (const key of snapshotKeys) {
            snapshotActiveMap[key] = getActiveRoomsInSnapshot(snapshots[key].rooms);
        }

        const intervals = generateTimeSlots(5);
        const timeSeries = intervals.map(time => {
            const minutesAtSlot = timeStrToMinutes(time);

            // Find active room count from the nearest snapshot
            let activeCount = 0;
            let activeRoomIds = [];
            if (hasSnapshots) {
                let bestKey = null;
                let bestDiff = Infinity;
                for (const key of snapshotKeys) {
                    const snapMin = timeStrToMinutes(key);
                    // Only use snapshots that are at or before this time slot
                    if (snapMin <= minutesAtSlot) {
                        const diff = minutesAtSlot - snapMin;
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            bestKey = key;
                        }
                    }
                }
                if (bestKey !== null) {
                    activeCount = snapshotActiveMap[bestKey].count;
                    activeRoomIds = snapshotActiveMap[bestKey].roomIds;
                }
            }

            return {
                time,
                active: activeCount,
                activeRooms: activeRoomIds,
                issues: 0,
                issueRooms: [],
                minutesAtSlot
            };
        });

        const logs = [];

        // Build logs and apply issues count to timeSeries
        Object.entries(rawData).forEach(([roomId, roomData]) => {
            // Process History
            (roomData.incidentHistory || []).forEach(inc => {
                const sDate = new Date(inc.startTime);
                const eDate = new Date(inc.endTime);

                const startMins = sDate.getHours() * 60 + sDate.getMinutes();
                const endMins = eDate.getHours() * 60 + eDate.getMinutes();

                logs.push({
                    roomId,
                    reason: inc.reason,
                    startTime: sDate.toISOString(),
                    endTime: eDate.toISOString(),
                    duration: inc.durationMinutes,
                    status: 'Resolved'
                });

                // Mark issues across corresponding timeslots
                timeSeries.forEach(slot => {
                    if (slot.minutesAtSlot >= startMins && slot.minutesAtSlot <= endMins) {
                        slot.issues += 1;
                        slot.active -= 1;
                        if (!slot.issueRooms.includes(roomId)) {
                            slot.issueRooms.push(roomId);
                        }
                    }
                });
            });

            // Process Ongoing
            if (roomData.ongoingIncident) {
                const sDate = new Date(roomData.ongoingIncident.startTime);
                const startMins = sDate.getHours() * 60 + sDate.getMinutes();

                // End time is effectively "now" if it's today
                let endMins = 24 * 60; // default to end of day
                const isToday = dateStr === 'today' || dateStr === new Date().toLocaleDateString('en-CA');

                if (isToday) {
                    const now = new Date();
                    endMins = now.getHours() * 60 + now.getMinutes();
                    const duration = Math.floor((now - sDate) / 60000);

                    logs.push({
                        roomId,
                        reason: roomData.ongoingIncident.reason,
                        startTime: sDate.toISOString(),
                        duration: duration,
                        status: 'Ongoing'
                    });
                } else {
                    logs.push({
                        roomId,
                        reason: roomData.ongoingIncident.reason,
                        startTime: sDate.toISOString(),
                        duration: -1, // unresolved
                        status: 'Unresolved'
                    });
                }

                timeSeries.forEach(slot => {
                    if (slot.minutesAtSlot >= startMins && slot.minutesAtSlot <= endMins) {
                        slot.issues += 1;
                        slot.active = Math.max(0, slot.active - 1);
                        if (!slot.issueRooms.includes(roomId)) {
                            slot.issueRooms.push(roomId);
                        }
                    }
                });
            }
        });

        // Filter out future timeslots if checking today
        // Cut-off: remove slots before 06:00
        let finalSeries = timeSeries.filter(slot => slot.minutesAtSlot >= 360);
        if (dateStr === 'today' || dateStr === new Date().toLocaleDateString('en-CA')) {
            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            finalSeries = finalSeries.filter(slot => slot.minutesAtSlot <= currentMins);
        }

        // Clean up internal properties before returning
        const cleanedSeries = finalSeries.map(s => {
            const { minutesAtSlot, ...rest } = s;
            return rest;
        });

        // Sort logs newest first
        logs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

        return NextResponse.json({
            timeSeries: cleanedSeries,
            logs,
            summary: {
                totalRooms,
                activeRoomsNow: hasSnapshots && snapshotKeys.length > 0
                    ? snapshotActiveMap[snapshotKeys[snapshotKeys.length - 1]].count
                    : totalRooms,
                totalIncidents: logs.length
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
