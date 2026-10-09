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
   * Unifies duplicate school/branch spellings into one canonical name.
   * Zhor→Zohr, Sadaat→Sadat, Domiatta→Damietta (case-insensitive).
   */
  normalizeSchool: function (name) {
    var s = (name || '').toString().trim();
    if (!s) return '';
    var map = {
      'zhor':     'Zohr',
      'zohr':     'Zohr',
      'sadaat':   'Sadat',
      'sadat':    'Sadat',
      'domiatta': 'Damietta',
      'damietta': 'Damietta',
      'sta3':     'Sadat',
      'sta 3':    'Sadat'
    };
    return map[s.toLowerCase()] || s;
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
        obj[headers[j]] = (val instanceof Date)
          ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
          : (val === null || val === undefined ? '' : val);
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
