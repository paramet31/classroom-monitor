import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// Get today's date string YYYY-MM-DD
function getTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get current HH:mm
function getCurrentTimeStr() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Saves a full snapshot of all room statuses for the current minute.
 * Overwrites if a snapshot for the exact same minute already exists to prevent bloat.
 * 
 * @param {Array} rooms - The full array of room objects
 */
export function saveSnapshot(rooms) {
    if (!rooms || rooms.length === 0) return;

    const dateStr = getTodayStr();
    const timeStr = getCurrentTimeStr();
    const filePath = path.join(SNAPSHOTS_DIR, `${dateStr}.json`);

    let dailyData = {};
    if (fs.existsSync(filePath)) {
        try {
            dailyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error('Failed to read snapshot file:', e);
            dailyData = {};
        }
    }

    // Add or overwrite the snapshot for this minute
    dailyData[timeStr] = {
        timestamp: new Date().toISOString(),
        rooms: rooms
    };

    try {
        fs.writeFileSync(filePath, JSON.stringify(dailyData, null, 2));
    } catch (e) {
        console.error('Failed to write snapshot file:', e);
    }
}

/**
 * Returns an array of available snapshot dates (YYYY-MM-DD)
 */
export function getAvailableSnapshotDates() {
    try {
        if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
        const files = fs.readdirSync(SNAPSHOTS_DIR);
        return files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
            .sort((a, b) => b.localeCompare(a)); // Newest first
    } catch (e) {
        console.error('Failed to list snapshot dates:', e);
        return [];
    }
}

/**
 * Returns an array of available HH:mm times for a specific date
 */
export function getAvailableSnapshotTimes(dateStr) {
    try {
        const filePath = path.join(SNAPSHOTS_DIR, `${dateStr}.json`);
        if (!fs.existsSync(filePath)) return [];

        const dailyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Object.keys(dailyData).sort((a, b) => b.localeCompare(a)); // Newest first
    } catch (e) {
        console.error('Failed to get snapshot times for date:', dateStr, e);
        return [];
    }
}

/**
 * Returns the array of rooms for a specific date and time
 */
export function getSnapshot(dateStr, timeStr) {
    try {
        const filePath = path.join(SNAPSHOTS_DIR, `${dateStr}.json`);
        if (!fs.existsSync(filePath)) return null;

        const dailyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (dailyData[timeStr]) {
            return dailyData[timeStr].rooms;
        }
        return null; // Time not found
    } catch (e) {
        console.error('Failed to get snapshot for:', dateStr, timeStr, e);
        return null;
    }
}
