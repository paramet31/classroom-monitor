import fs from 'fs';
import path from 'path';

// Define paths
const DATA_DIR = path.join(process.cwd(), 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'incidents');
const FILE_PATH = path.join(DATA_DIR, 'incidents.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// Ensure JSON file exists
if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2));
}

// Track which date the current incidents.json belongs to
let currentFileDate = null;

/**
 * Get today's date string in YYYY-MM-DD format (local time)
 */
function getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Archive yesterday's data if the day has changed.
 * Moves current incidents.json content into data/incidents/YYYY-MM-DD.json
 * and resets incidents.json for the new day.
 */
function archiveIfNewDay() {
    const today = getTodayStr();

    if (currentFileDate === null) {
        // First run: detect the date from last modification of the file
        try {
            const stats = fs.statSync(FILE_PATH);
            const mtime = stats.mtime;
            const my = mtime.getFullYear();
            const mm = String(mtime.getMonth() + 1).padStart(2, '0');
            const md = String(mtime.getDate()).padStart(2, '0');
            currentFileDate = `${my}-${mm}-${md}`;
        } catch {
            currentFileDate = today;
        }
    }

    if (currentFileDate !== today) {
        // Archive the old day's data
        const currentData = readData();
        if (Object.keys(currentData).length > 0) {
            const archivePath = path.join(ARCHIVE_DIR, `${currentFileDate}.json`);

            // If archive already exists for that day, merge
            let existingArchive = {};
            if (fs.existsSync(archivePath)) {
                try {
                    existingArchive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
                } catch { /* ignore */ }
            }

            // Merge: append incidentHistory entries
            for (const [roomId, roomData] of Object.entries(currentData)) {
                if (!existingArchive[roomId]) {
                    existingArchive[roomId] = roomData;
                } else {
                    // Merge incident histories
                    const existingHistory = existingArchive[roomId].incidentHistory || [];
                    const newHistory = roomData.incidentHistory || [];
                    existingArchive[roomId].incidentHistory = [...newHistory, ...existingHistory];
                    existingArchive[roomId].latestStatus = roomData.latestStatus;
                    // Close any ongoing incidents from old day
                    if (roomData.ongoingIncident) {
                        existingArchive[roomId].ongoingIncident = roomData.ongoingIncident;
                    }
                }
            }

            fs.writeFileSync(archivePath, JSON.stringify(existingArchive, null, 2));
        }

        // Reset incidents.json for new day, but keep room entries with no history
        const freshData = {};
        const oldData = readData();
        for (const [roomId, roomData] of Object.entries(oldData)) {
            freshData[roomId] = {
                latestStatus: roomData.latestStatus,
                ongoingIncident: roomData.ongoingIncident, // carry over ongoing
                incidentHistory: []
            };
        }
        fs.writeFileSync(FILE_PATH, JSON.stringify(freshData, null, 2));
        currentFileDate = today;
    }
}

// Read current data
function readData() {
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

// Write data
function writeData(data) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

/**
 * Calculates the duration between two date objects in minutes.
 */
function getDurationMinutes(start, end) {
    const diffMs = end - start;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 60000);
}

/**
 * Parses time string "HH:mm" from the file server and pairs it with today's date
 */
function parseTimeStrToDate(timeStr) {
    if (!timeStr) return new Date();
    const now = new Date();
    const [hours, mins] = timeStr.split(':').map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins);
}

/**
 * Logs a room's status and updates incident history based on state transitions.
 */
export function logIncident(roomId, currentStatus, timeStr, isScheduled = false) {
    // Check if day changed → archive old data
    archiveIfNewDay();

    const data = readData();
    const nowISO = new Date().toISOString();

    // Initialize room if not exists
    if (!data[roomId]) {
        data[roomId] = {
            latestStatus: currentStatus,
            ongoingIncident: null,
            incidentHistory: []
        };
    }

    const roomData = data[roomId];
    const wasBroken = roomData.ongoingIncident !== null;
    const isNowBroken = ['Stopped', 'Finished', 'Idle', 'Error', 'No Record'].includes(currentStatus);

    // Transition 1: Active -> Broken (Incident Starts)
    if (!wasBroken && isNowBroken && isScheduled) {
        let actualStartTime = nowISO;
        if (timeStr && timeStr.includes(':')) {
            actualStartTime = parseTimeStrToDate(timeStr).toISOString();
        }

        roomData.ongoingIncident = {
            startTime: actualStartTime,
            fileTimeWhenStopped: timeStr,
            reason: currentStatus
        };
    }

    // Transition 2: Broken -> Active (Recording resumed)
    if (wasBroken && !isNowBroken) {
        const startTime = new Date(roomData.ongoingIncident.startTime);
        const endTime = new Date();
        const durationMins = getDurationMinutes(startTime, endTime);

        roomData.incidentHistory.unshift({
            startTime: roomData.ongoingIncident.startTime,
            endTime: nowISO,
            durationMinutes: durationMins,
            reason: roomData.ongoingIncident.reason,
            resolution: 'Recording resumed',
            lastFileTime: roomData.ongoingIncident.fileTimeWhenStopped
        });

        if (roomData.incidentHistory.length > 50) {
            roomData.incidentHistory.pop();
        }

        roomData.ongoingIncident = null;
    }

    // Auto-close incident when class period ends
    if (wasBroken && !isScheduled) {
        const startTime = new Date(roomData.ongoingIncident.startTime);
        const endTime = new Date();
        const durationMins = getDurationMinutes(startTime, endTime);

        roomData.incidentHistory.unshift({
            startTime: roomData.ongoingIncident.startTime,
            endTime: nowISO,
            durationMinutes: durationMins,
            reason: roomData.ongoingIncident.reason,
            resolution: 'Class period ended',
            lastFileTime: roomData.ongoingIncident.fileTimeWhenStopped
        });

        if (roomData.incidentHistory.length > 50) {
            roomData.incidentHistory.pop();
        }

        roomData.ongoingIncident = null;
    }

    // Ongoing Incident Update
    if (wasBroken && isNowBroken && isScheduled) {
        roomData.ongoingIncident.reason = currentStatus;
    }

    roomData.latestStatus = currentStatus;

    writeData(data);
    return roomData;
}

/**
 * Retrieves incident history for a specific room.
 * @param {string} roomId
 * @param {string|null} dateStr - Optional YYYY-MM-DD to read from archive
 */
export function getRoomIncidents(roomId, dateStr = null) {
    if (dateStr && dateStr !== getTodayStr()) {
        // Read from archive
        const archivePath = path.join(ARCHIVE_DIR, `${dateStr}.json`);
        if (!fs.existsSync(archivePath)) {
            return { incidentHistory: [], ongoingIncident: null };
        }
        try {
            const archiveData = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
            return archiveData[roomId] || { incidentHistory: [], ongoingIncident: null };
        } catch {
            return { incidentHistory: [], ongoingIncident: null };
        }
    }

    // Default: today's data
    const data = readData();
    return data[roomId] || null;
}

/**
 * Returns a list of available archive date strings (YYYY-MM-DD).
 */
export function getAvailableDates() {
    const dates = [];

    // Always include today
    dates.push(getTodayStr());

    // Scan archive directory
    if (fs.existsSync(ARCHIVE_DIR)) {
        const files = fs.readdirSync(ARCHIVE_DIR);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const dateStr = file.replace('.json', '');
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !dates.includes(dateStr)) {
                    dates.push(dateStr);
                }
            }
        }
    }

    // Sort descending (newest first)
    dates.sort((a, b) => b.localeCompare(a));
    return dates;
}
