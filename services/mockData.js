export const CAMPUSES = [
    { id: 'RS', name: 'Rangsit (RS)' }
];

// Simulation of the http://lecturelive-rs.siit.tu.ac.th/rooms data
export const ROOM_STATUSES = {
    'RS': [
        { id: '301', name: 'Room 301', encoder: 'Active', schedule: 'Free', automation: 'Auto', recordFile: 'Found', lastCheck: '10:00 AM' },
        { id: '302', name: 'Room 302', encoder: 'Active', schedule: 'Occupied', automation: 'Auto', recordFile: 'Found', lastCheck: '10:00 AM' },
        { id: '303', name: 'Room 303', encoder: 'Offline', schedule: 'Free', automation: 'Manual', recordFile: 'Missing', lastCheck: '10:05 AM' },
        { id: '304', name: 'Room 304', encoder: 'Active', schedule: 'Occupied', automation: 'Auto', recordFile: 'Found', lastCheck: '10:00 AM' },
    ],
    'BKD': [
        { id: '501', name: 'Lab 501', encoder: 'Active', schedule: 'Occupied', automation: 'Auto', recordFile: 'Found', lastCheck: '09:55 AM' },
        { id: '502', name: 'Lab 502', encoder: 'Warning', schedule: 'Free', automation: 'Auto', recordFile: 'Pending', lastCheck: '09:55 AM' },
    ]
};

// Simulation of file checking on 192.168.10.x
export const NETWORK_DRIVES = {
    'RS': 'http://192.168.10.240/dir/',
    'BKD': 'http://192.168.10.180/dir/'
};
