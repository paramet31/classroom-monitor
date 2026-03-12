// Configuration for Rooms — reads from data/settings.json
// Falls back to hardcoded list if settings file is unavailable.
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

function loadRooms() {
    try {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        return settings.rooms
            .filter(r => r.enabled)
            .map(r => r.id);
    } catch (e) {
        console.warn('[roomConfig] Could not read settings.json, using fallback');
        return [
            '1-101', '1-102',
            '1-301', '1-304', '1-306', '1-307', '1-312', '1-313',
            '1-401', '1-402', '1-403', '1-404', '1-405', '1-406', '1-407', '1-408', '1-409', '1-410', '1-411',
            '1-501', '1-502', '1-503', '1-504', '1-506', '1-507',
            '3203', '3204', '3303', '3304', '3305', '3401',
        ];
    }
}

export function getRoomList() {
    return loadRooms();
}

export const CAMPUS_CONFIG = {
    id: 'RS',
    name: 'Rangsit Campus'
};
