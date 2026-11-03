// ============================================================
//  UTILITIES  –  shared helpers
// ============================================================

var AppUtils = {

  SPREADSHEET_ID: '1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU',

  // ── Spreadsheet instance cache (lives for the duration of one script execution)
  _ss: null,
  getDB: function () {
    if (!this._ss) {
      this._ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
    }
    return this._ss;
  },

  // ── Sheet data cache: { sheetName: [[row],[row],...] }
  // Populated on first read, reused within the same execution.
  _sheetCache: {},
  _getRawData: function (sheetName) {
    if (!this._sheetCache[sheetName]) {
      var sheet = this.getDB().getSheetByName(sheetName);
      if (!sheet) { this._sheetCache[sheetName] = null; return null; }
      var data = sheet.getDataRange().getValues();
      this._sheetCache[sheetName] = data.length >= 2 ? data : null;
    }
    return this._sheetCache[sheetName];
  },

  // ── Invalidate a single sheet's cache after a write
  invalidate: function (sheetName) {
    delete this._sheetCache[sheetName];
  },

  // ── Script timezone (cached)
  _tz: null,
  getTZ: function () {
    if (!this._tz) this._tz = Session.getScriptTimeZone();
    return this._tz;
  },

  /** Generates a short random ID  e.g.  "emp-a3f9c" */
  generateId: function (prefix) {
    return (prefix || 'id') + '-' +
      Math.random().toString(36).substring(2, 7);
  },

  /**
   * Checks if an employee or record status is considered active.
   * Handles shifted columns, numbers (TID), and blanks gracefully.
   */
  isStatusActive: function (val) {
    if (val === null || val === undefined) return true;
    var s = val.toString().trim().toLowerCase();
    if (s === '' || s === 'active' || s === 'نشط' || s === 'true' || s === '1') return true;
    if (s === 'inactive' || s === 'غير نشط' || s === 'موقوف' || s === 'معطل' || s === 'disabled' || s === 'deleted' || s === 'false' || s === '0') return false;
    // Numbers (e.g. TID "16942") or other values indicate an active record with shifted data
    return true;
  },

  /**
   * Unifies duplicate school/branch spellings into one canonical name.
   */
  normalizeSchool: function (name) {
    var s = (name || '').toString().trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    if (lower === 'zhor' || lower === 'zohr' || lower.indexOf('zohr') !== -1 || lower.indexOf('portsaid') !== -1 || lower.indexOf('بورسعيد') !== -1) return 'ZOHR - Portsaid';
    if (lower === 'sadat' || lower === 'sadaat' || lower === 'sta3' || lower === 'sta 3' || lower === 'sta-3' || lower.indexOf('sadat') !== -1 || lower.indexOf('السادات') !== -1) return 'STA3 - El-Sadat';
    if (lower === 'domiatta' || lower === 'damietta' || lower.indexOf('damietta') !== -1 || lower.indexOf('دمياط') !== -1) return 'New-Damietta';
    if (lower === 'alamein' || lower === 'el-alamein' || lower.indexOf('alamein') !== -1 || lower.indexOf('العلمين') !== -1) return 'New El-Alamein';
    if (lower === 'sokhna' || lower.indexOf('sokhna') !== -1 || lower.indexOf('السخنة') !== -1) return 'Ain-Sokhna School';
    if (lower === 'belbeis' || lower.indexOf('belbeis') !== -1 || lower.indexOf('بلبيس') !== -1) return "COC's - Belbeis";
    if (lower === 'maghagha' || lower.indexOf('maghagha') !== -1 || lower.indexOf('مغاغة') !== -1) return "COC's - Maghagha";
    if (lower === 'm8' || lower === 'gets' || lower.indexOf('gets') !== -1 || lower.indexOf('m8') !== -1) return 'M8-GETS';
    if (lower === 'shubra' || lower.indexOf('shubra') !== -1 || lower.indexOf('شبرا') !== -1) return 'Shubra Hospitality School';
    if (lower === 'sta-1' || lower === 'sta 1' || lower === 'sta1') return 'STA-1';
    if (lower === 'sta-2' || lower === 'sta 2' || lower === 'sta2') return 'STA-2';
    if (lower === 'sta' || lower === 'الفرع الرئيسي') return 'STA';
    return s;
  },

  /**
   * Normalizes department names across Arabic and English terms.
   */
  normalizeDept: function (name) {
    var s = (name || '').toString().trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    if (lower.indexOf('عرب') !== -1 || lower.indexOf('arabic') !== -1) return 'اللغة العربية';
    if (lower.indexOf('انجل') !== -1 || lower.indexOf('إنجل') !== -1 || lower.indexOf('english') !== -1) return 'اللغة الإنجليزية';
    if (lower.indexOf('رياض') !== -1 || lower.indexOf('math') !== -1) return 'الرياضيات';
    if (lower.indexOf('ميكانيك') !== -1 || lower.indexOf('mechanic') !== -1) return 'ميكانيكا';
    if (lower.indexOf('كهرب') !== -1 || lower.indexOf('electr') !== -1) return 'كهرباء';
    if (lower.indexOf('كيم') !== -1 || lower.indexOf('chem') !== -1 || lower.indexOf('علوم') !== -1) return 'كيمياء';
    if (lower.indexOf('حاسب') !== -1 || lower.indexOf('كمبيوتر') !== -1 || lower.indexOf('computer') !== -1) return 'حاسب آلي';
    if (lower.indexOf('إيطال') !== -1 || lower.indexOf('ايطال') !== -1 || lower.indexOf('italian') !== -1) return 'اللغة الإيطالية';
    if (lower.indexOf('ألمان') !== -1 || lower.indexOf('المان') !== -1 || lower.indexOf('german') !== -1) return 'اللغة الألمانية';
    if (lower.indexOf('سيار') !== -1 || lower.indexOf('automotive') !== -1) return 'سيارات';
    if (lower.indexOf('فندق') !== -1 || lower.indexOf('f&b') !== -1 || lower.indexOf('مطاعم') !== -1) return 'فندقي';
    if (lower.indexOf('لوجست') !== -1 || lower.indexOf('logistics') !== -1 || lower.indexOf('مبيع') !== -1 || lower.indexOf('sales') !== -1) return 'لوجستيات';
    if (lower.indexOf('إلكترون') !== -1 || lower.indexOf('الكترون') !== -1 || lower.indexOf('electronic') !== -1) return 'إلكترونيات';
    if (lower.indexOf('بدني') !== -1 || lower.indexOf('pe') !== -1 || lower.indexOf('رياضي') !== -1) return 'تربية رياضية';
    if (lower.indexOf('اجتماع') !== -1 || lower.indexOf('social') !== -1) return 'أخصائي اجتماعي';
    if (lower.indexOf('تطور') !== -1 || lower.indexOf('تنمية') !== -1 || lower.indexOf('development') !== -1) return 'تطوير الطلاب';
    if (lower.indexOf('طباع') !== -1 || lower.indexOf('printing') !== -1) return 'طباعة';
    if (lower.indexOf('ict') !== -1 || lower.indexOf('تكنولوج') !== -1) return 'تكنولوجيا المعلومات';
    return s;
  },

  /**
   * Reads a sheet and returns an array of plain objects keyed by header row.
   * Uses the in-execution cache — subsequent calls for the same sheet are free.
   */
  sheetToObjects: function (sheetName) {
    var data = this._getRawData(sheetName);
    if (!data) return [];

    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var rows    = [];
    var tz      = this.getTZ();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row.every(function (c) { return c === '' || c === null || c === undefined; })) continue;

      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        var hName = headers[j];
        // If header already set and new val is empty, keep existing
        if (obj[hName] !== undefined && (val === '' || val === null || val === undefined)) {
          continue;
        }
        obj[hName] = (val instanceof Date)
          ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
          : (val === null || val === undefined ? '' : val);
      }

      // Special resilience for Employees table (handles TID inserted at col 8, duplicate created_at)
      if (sheetName === 'Employees') {
        var rawCol8 = row[8] !== undefined && row[8] !== null ? row[8].toString().trim() : '';
        var rawCol9 = row[9] !== undefined && row[9] !== null ? row[9].toString().trim() : '';

        if (/^\d+$/.test(rawCol8) || (!rawCol8 && rawCol9.toLowerCase() === 'active')) {
          obj['tid'] = rawCol8;
          obj['status'] = rawCol9 || 'Active';
        } else if (rawCol8.toLowerCase() === 'active' || rawCol8.toLowerCase() === 'inactive') {
          obj['status'] = rawCol8;
        } else if (!rawCol8 && !rawCol9) {
          obj['status'] = 'Active';
        }
      }

      rows.push(obj);
    }
    return rows;
  },

  /**
   * Appends a row to the Logs sheet asynchronously via a fire-and-forget
   * pattern — wraps in try/catch so it never blocks the main response.
   */
  writeLog: function (userEmail, action, module, details, status) {
    try {
      var sheet = this.getDB().getSheetByName('Logs');
      if (!sheet) return;
      sheet.appendRow([
        this.generateId('log'),
        new Date(),
        userEmail || 'unknown',
        action    || '',
        module    || '',
        details   || '',
        status    || 'INFO'
      ]);
    } catch (e) {
      // Log failures must never crash the caller
      console.error('Log write failed: ' + e);
    }
  }
};
