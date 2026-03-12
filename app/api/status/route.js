import { NextResponse } from 'next/server';

// Configuration for target servers
const SERVERS = {
    RS: {
        fileServers: [
            { url: 'http://192.168.10.240/dir/', label: 'Server-240' },
            { url: 'http://192.168.10.180/dir/', label: 'Server-180' }
        ],
        encoderPage: 'http://lecturelive-rs.siit.tu.ac.th/rooms',
        encoderBaseUrl: 'http://lecturelive-rs.siit.tu.ac.th',
        schedule: 'https://crrs.siit.tu.ac.th/calendar/',
        email: 'comservice@siit.tu.ac.th',
        password: 'comav1234'
    },
    BKD: {
        fileServers: [
            { url: 'http://192.168.10.180/dir/', label: 'Server-180' }
        ],
        encoderPage: 'http://lecturelive-bkd.siit.tu.ac.th/rooms',
        schedule: 'https://crrs.siit.tu.ac.th/calendar/'
    }
};

// Generic function to fetch with timeout and stealth headers
async function fetchWithStealth(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                // Pretend to be a standard Chrome browser
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
                'Cache-Control': 'no-cache',
            }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        return await response.text();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error.message);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Helper to get today's date in DD-Mon-YYYY format (e.g. 20-Feb-2026)
function getTodayDateString() {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Logic to check file server for today's folder AND latest file inside
// Returns: { status: 'Found'|'Missing'|'Old', time: '14:34', fileName: '...', fileSize: '...' }
async function deepCheckFileServer(html, roomId, dateString, serverUrl) {
    if (!html) return { status: 'Error', time: '', fileName: '', fileSize: '' };

    const folderName = `CRRS-${roomId}`;
    const lines = html.split('\n');
    const targetLine = lines.find(line => line.includes(folderName));

    if (!targetLine) return { status: 'Missing', time: '', fileName: '', fileSize: '' };

    // If folder exists, we now "click" into it to check files
    if (targetLine.includes(dateString)) {
        const deepUrl = `${serverUrl}${folderName}/`;
        const deepHtml = await fetchWithStealth(deepUrl);

        if (!deepHtml) return { status: 'Found', time: 'Check Fail', fileName: '', fileSize: '' };

        // Find all file lines matching today's date and video formats
        const fileLines = deepHtml.split('\n').filter(l => l.includes(dateString) && (l.includes('.mp4') || l.includes('.mkv')));

        if (fileLines.length > 0) {
            // Parse all files to extract their true timestamp
            const parsedFiles = fileLines.map(line => {
                const fileMatch = line.match(/href="([^"]+)"/);
                const fileName = fileMatch ? fileMatch[1].replace(/\/$/, '') : 'Unknown File';

                const timeMatch = line.match(/\d{2}:\d{2}/);
                const timeStr = timeMatch ? timeMatch[0] : '00:00';

                // Convert HH:mm to total minutes for easy sorting
                const [hours, mins] = timeStr.split(':').map(Number);
                const timeValue = (hours * 60) + (mins || 0);

                const sizeMatch = line.match(/\s(\d+(\.\d+)?[GKM]?)\s*$/i);
                const fileSize = sizeMatch ? sizeMatch[1] : 'N/A';

                // Check if this is a bad recording: filename ends with -0.mp4/.mkv and small size
                const isBadFile = /\-0\.(mp4|mkv)$/i.test(fileName);
                const isSmallFile = /^\d+K?$/i.test(fileSize) && !fileSize.toUpperCase().endsWith('M') && !fileSize.toUpperCase().endsWith('G');

                return { fileName, timeStr, timeValue, fileSize, originalLine: line, isBadFile, isSmallFile };
            });

            // Sort descending by timeValue (latest time first)
            parsedFiles.sort((a, b) => b.timeValue - a.timeValue);

            // The first element is now the truly latest file chronologically
            const latestFile = parsedFiles[0];

            // Detect bad recording: file ends with -0 and has small file size (K range)
            const isBadRecording = latestFile.isBadFile && latestFile.isSmallFile;

            return {
                status: isBadRecording ? 'Bad Recording' : 'Found',
                time: latestFile.timeStr,
                fileName: latestFile.fileName,
                fileSize: latestFile.fileSize
            };
        }

        return { status: 'Empty', time: '', fileName: '', fileSize: '' };
    } else {
        return { status: 'Old Folder', time: '', fileName: '', fileSize: '' };
    }
}

// Convert HH:mm to total minutes for comparison
function timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return -1;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + (m || 0);
}

// Helper to calculate recording status based on file's last modified time
function calculateRecordingStatus(timeStr) {
    if (!timeStr) return 'No Record';

    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Note: Assuming the file is from today as we only check today's folder
    const fileTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

    const diffMs = now - fileTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Active'; // System time differences
    if (diffMins <= 5) return 'Active'; // Modified within last 5 minutes
    if (diffMins <= 60) return 'Stopped'; // Modified between 5 mins and 1 hour ago
    return 'Finished'; // More than 1 hour ago
}

import { getRoomList } from './roomConfig';
import { logIncident } from '../../../lib/incidentLogger';
import { getScheduleForToday, isRoomScheduledNow } from '../../../lib/scheduleScraper';

// --- Global Cache ---
const CACHE_TTL = 30 * 1000; // 30 seconds
let memoryCache = { RS: null, BKD: null };
let cacheTime = { RS: 0, BKD: 0 };
let pendingRequests = { RS: null, BKD: null };

async function performHardwareCheck(campus, config, dateString) {
    console.log(`[API] Fetching data for ${campus} from hardware...`);

    let serverFetches = [];
    let todaySchedule = {};

    try {
        [serverFetches, todaySchedule] = await Promise.all([
            Promise.all(config.fileServers.map(async (server) => {
                try {
                    const html = await fetchWithStealth(server.url);
                    return { ...server, html };
                } catch (e) {
                    console.error(`[API] Server ${server.label} unreachable:`, e.message);
                    return { ...server, html: null };
                }
            })),
            getScheduleForToday().catch(e => {
                console.error('[API] Schedule fetch failed:', e.message);
                return {};
            })
        ]);
    } catch (e) {
        console.error('[API] Initial data fetch failed:', e.message);
    }

    const ROOM_LIST = getRoomList();
    const results = [];
    for (const roomId of ROOM_LIST) {
        try {
            const roomName = `Room ${roomId}`;
            const perServerResults = [];
            for (const server of serverFetches) {
                try {
                    const fileData = await deepCheckFileServer(server.html, roomId, dateString, server.url);
                    let serverStatus;
                    if (fileData.status === 'Missing') {
                        serverStatus = 'No Record';
                    } else if (fileData.status === 'Bad Recording') {
                        serverStatus = 'Bad Recording';
                    } else {
                        const recStatus = fileData.time ? calculateRecordingStatus(fileData.time) : 'Idle';
                        serverStatus = recStatus;
                    }

                    perServerResults.push({
                        label: server.label, url: server.url, status: serverStatus,
                        time: fileData.time || '', fileName: fileData.fileName || '', fileSize: fileData.fileSize || ''
                    });
                } catch (e) {
                    perServerResults.push({
                        label: server.label, url: server.url, status: 'Error',
                        time: '', fileName: '', fileSize: ''
                    });
                }
            }

            let bestIdx = 0, bestTime = -1;
            perServerResults.forEach((sr, idx) => {
                const mins = timeToMinutes(sr.time);
                if (mins > bestTime) { bestTime = mins; bestIdx = idx; }
            });
            const best = perServerResults[bestIdx] || { status: 'Error', time: '', fileName: '', fileSize: '', label: 'N/A', url: '' };

            const serverHealth = perServerResults.map((sr, idx) => ({ ...sr, isActiveSource: idx === bestIdx }));
            const finalStatus = best.status;
            const roomSchedule = todaySchedule[roomId] || [];
            const scheduled = isRoomScheduledNow(roomSchedule);

            let incidentData = null;
            try { incidentData = logIncident(roomId, finalStatus, best.time, scheduled); } catch (e) { }

            results.push({
                id: roomId, name: roomName, recordFile: finalStatus, lastRecorded: best.time,
                fileName: best.fileName, fileSize: best.fileSize, folderUrl: `${best.url}CRRS-${roomId}/`,
                activeServer: best.label, serverHealth, schedule: roomSchedule, isScheduled: scheduled,
                automation: 'Auto', lastCheck: new Date().toLocaleTimeString('en-GB'), incident: incidentData
            });
        } catch (e) {
            console.error(`[API] Error processing room ${roomId}:`, e.message);
            results.push({
                id: roomId, name: `Room ${roomId}`, recordFile: 'Error', lastRecorded: '',
                fileName: '', fileSize: '', folderUrl: '', activeServer: 'N/A',
                serverHealth: [], schedule: [], isScheduled: false,
                automation: 'Auto', lastCheck: new Date().toLocaleTimeString('en-GB'), incident: null
            });
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return results;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const campus = searchParams.get('campus') || 'RS';
    const config = SERVERS[campus];

    if (!config) {
        return NextResponse.json({ error: `Unknown campus: ${campus}` }, { status: 400 });
    }

    const dateString = getTodayDateString();

    // Deduplicate concurrent requests — if another request is already in-flight, wait for it
    if (pendingRequests[campus]) {
        console.log(`[API] Waiting for ongoing hardware fetch for ${campus}...`);
        try {
            const results = await pendingRequests[campus];
            return NextResponse.json(results);
        } catch (err) {
            return NextResponse.json([], { status: 200 });
        }
    }

    // Create the promise and store it BEFORE awaiting
    const fetchPromise = performHardwareCheck(campus, config, dateString)
        .catch(err => {
            console.error(`[API] Hardware check failed for ${campus}:`, err);
            return [];
        })
        .finally(() => {
            pendingRequests[campus] = null;
        });

    pendingRequests[campus] = fetchPromise;

    // Add overall timeout: if it takes more than 45 seconds, return whatever we have
    const timeoutPromise = new Promise(resolve => {
        setTimeout(() => resolve([]), 45000);
    });

    const results = await Promise.race([fetchPromise, timeoutPromise]);
    return NextResponse.json(results);
}
