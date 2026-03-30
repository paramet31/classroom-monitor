// ═══════════════════════════════════════════════════════════════════════
// Google Apps Script — Lab Room Booking (standalone-booking)
// ═══════════════════════════════════════════════════════════════════════
//
// วิธีติดตั้ง:
// 1. ไปที่ Google Sheets ที่ใช้เก็บข้อมูล Lab Booking
// 2. เลือก Extensions > Apps Script
// 3. ลบ code เดิมออก แล้ว copy-paste code ทั้งหมดในไฟล์นี้ลงไป
// 4. แก้ SHEET_ID ให้ตรงกับ Spreadsheet ID ของคุณ
// 5. แก้ SHEET_NAME ให้ตรงกับชื่อ Sheet (เช่น 'Sheet1' หรือ 'Requests')
// 6. กด Deploy > New deployment
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 7. กด Deploy แล้ว copy URL ที่ได้
// 8. นำ URL ไปใส่ใน:
//    - standalone-booking/index.html → GOOGLE_SCRIPT_URL
//    - .env.local → GOOGLE_APPS_SCRIPT_LAB_URL
//
// ⚠️ หมายเหตุ: ทุกครั้งที่แก้ code ต้อง Deploy > New deployment ใหม่
// ═══════════════════════════════════════════════════════════════════════

var SHEET_ID = '1wa-1JaLiaCnF1TU3swgheircNI0mETUqpUhUeNIvQiE';
var SHEET_NAME = 'Sheet1'; // ← ตรวจสอบว่าตรงกับชื่อ Tab ด้านล่างของ Google Sheet

// ─── doGet: ดึงข้อมูล booking (รองรับ filter ด้วย email) ───
function doGet(e) {
    try {
        var ss = SpreadsheetApp.openById(SHEET_ID);
        var sheet = ss.getSheetByName(SHEET_NAME);

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify([]))
                .setMimeType(ContentService.MimeType.JSON);
        }

        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var results = [];
        var emailFilter = e && e.parameter ? e.parameter.email : null;

        for (var i = 1; i < data.length; i++) {
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                var val = data[i][j];
                // Convert Date objects to ISO strings
                if (val instanceof Date) {
                    val = val.toISOString();
                }
                row[headers[j]] = val;
            }
            row.rowNumber = i + 1; // Sheet row number (1-indexed, header = row 1)

            // Filter by email if provided
            if (emailFilter) {
                var rowEmail = (row['Email'] || '').toString().toLowerCase().trim();
                if (rowEmail !== emailFilter.toLowerCase().trim()) {
                    continue;
                }
            }

            results.push(row);
        }

        return ContentService.createTextOutput(JSON.stringify(results))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// ─── doPost: เพิ่ม booking ใหม่ หรือ ลบ booking ───
function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var ss = SpreadsheetApp.openById(SHEET_ID);
        var sheet = ss.getSheetByName(SHEET_NAME);

        // ─── Action: DELETE ───
        if (data.action === 'delete') {
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Sheet not found' }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            var allData = sheet.getDataRange().getValues();
            var targetTimestamp = data.timestamp;

            // Search from bottom up to avoid row-shift issues
            for (var i = allData.length - 1; i >= 1; i--) {
                var cellTs = allData[i][0]; // Timestamp is column A
                if (cellTs instanceof Date) {
                    cellTs = cellTs.toISOString();
                }

                if (targetTimestamp && cellTs) {
                    var targetTime = new Date(targetTimestamp).getTime();
                    var cellTime = new Date(cellTs).getTime();
                    if (targetTime === cellTime) {
                        sheet.deleteRow(i + 1);
                        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Row deleted' }))
                            .setMimeType(ContentService.MimeType.JSON);
                    }
                }
            }

            return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Row not found' }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // ─── Action: ADD (default) ───
        if (!sheet) {
            sheet = ss.insertSheet(SHEET_NAME);
            sheet.appendRow([
                'Timestamp', 'Campus', 'Term', 'Year', 'Lecturer Name', 'Email',
                'Course Name', 'Program', 'Section', 'Total Students',
                'Requested Day', 'Requested Slot', 'Remarks', 'Status', 'Source'
            ]);
            sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
        }

        var row = [
            data.submittedAt || new Date().toISOString(),
            data.campus || '',
            data.term || '',
            data.year || '',
            data.lecturerName || '',
            data.email || '',
            data.courseName || '',
            data.program || '',
            data.section || '',
            data.totalStudents || '',
            data.requestedDay || '',
            data.requestedSlot || '',
            data.remarks || '',
            data.status || 'pending',
            data.source || 'standalone-form'
        ];

        sheet.appendRow(row);

        return ContentService.createTextOutput(JSON.stringify({ success: true }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
