// ============================================================
//  AUTH.GS  –  Custom Email + Password Authentication
//  Replaces Google Session-based identity.
//  executeAs: USER_DEPLOYING — eliminates Google OAuth prompts.
// ============================================================

var _profileCache = {};

var TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
var DEFAULT_PASSWORD = 'sta@2025';

// ── Token helpers ─────────────────────────────────────────────────────────────

function _makeToken(email, role) {
  var cleanEmail = (email || '').toString().toLowerCase().trim();
  var expiry = new Date().getTime() + TOKEN_TTL_MS;
  var payload = cleanEmail + '|' + expiry;
  var checksum = _simpleHash(payload + (AppUtils.SPREADSHEET_ID || 'STA_SECRET_SALT'));
  return Utilities.base64EncodeWebSafe(payload) + '.' + checksum;
}

function _verifyTokenInternal(token) {
  if (!token) return null;
  try {
    var parts = token.toString().trim().split('.');
    if (parts.length !== 2) return null;
    var payloadBlob = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0]));
    var payload = payloadBlob.getDataAsString();
    var expectedCheck = _simpleHash(payload + (AppUtils.SPREADSHEET_ID || 'STA_SECRET_SALT'));
    if (parts[1] !== expectedCheck) return null;
    var fields = payload.split('|');
    if (fields.length < 2) return null;
    var email = fields[0];
    var expiry = parseInt(fields[fields.length - 1], 10);
    if (new Date().getTime() > expiry) return null; // expired
    return email.toLowerCase().trim();
  } catch (e) {
    return null;
  }
}

function _resolveCallerEmail(tokenOrEmail) {
  if (!tokenOrEmail) {
    try {
      var sessEmail = Session.getActiveUser().getEmail();
      if (sessEmail) return sessEmail.toLowerCase().trim();
    } catch(e) {}
    return null;
  }
  var str = tokenOrEmail.toString().trim();
  if (str.indexOf('.') !== -1) {
    var fromToken = _verifyTokenInternal(str);
    if (fromToken) return fromToken.toLowerCase().trim();
  }
  if (str.indexOf('@') !== -1) {
    return str.toLowerCase().trim();
  }
  return null;
}

function _simpleHash(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit int
  }
  return Math.abs(hash).toString(36);
}

// ── Public Authentication API ─────────────────────────────────────────────────

/**
 * Validates credentials against Managers & Employees tables.
 * Returns { success: true, token, profile } or { success: false, error }
 */
function loginUser(email, password) {
  email = (email || '').toString().toLowerCase().trim();
  password = (password || '').toString().trim();
  if (!email || !password) {
    return { success: false, error: 'البريد الإلكتروني وكلمة المرور مطلوبان' };
  }

  try {
    // 1. Check Managers sheet
    var mgrs = AppUtils.sheetToObjects('Managers');
    for (var i = 0; i < mgrs.length; i++) {
      var r = mgrs[i];
      var mEmail = (r['email'] || '').toString().toLowerCase().trim();
      var mStatus = (r['status'] || 'Active').toString().trim().toLowerCase();
      if (mEmail === email && (mStatus === 'active' || mStatus === '')) {
        var storedPw = (r['password'] || '').toString().trim();
        if (!storedPw) storedPw = DEFAULT_PASSWORD;
        if (storedPw !== password) {
          return { success: false, error: 'كلمة المرور غير صحيحة' };
        }
        var profile = _buildProfile(email);
        var token = _makeToken(email, profile.role);
        return { success: true, token: token, profile: profile };
      }
    }

    // 2. Check Employees sheet
    var emps = AppUtils.sheetToObjects('Employees');
    for (var j = 0; j < emps.length; j++) {
      var er = emps[j];
      var eEmail = (er['email'] || '').toString().toLowerCase().trim();
      var eStatus = (er['status'] || 'Active').toString().trim().toLowerCase();
      if (eEmail === email && (eStatus === 'active' || eStatus === '')) {
        var storedPw2 = (er['password'] || '').toString().trim();
        if (!storedPw2) storedPw2 = DEFAULT_PASSWORD;
        if (storedPw2 !== password) {
          return { success: false, error: 'كلمة المرور غير صحيحة' };
        }
        var profile2 = _buildProfile(email);
        var token2 = _makeToken(email, profile2.role);
        return { success: true, token: token2, profile: profile2 };
      }
    }

    return { success: false, error: 'البريد الإلكتروني غير مسجل في النظام' };
  } catch (e) {
    return { success: false, error: 'خطأ في الخادم: ' + e.message };
  }
}

/**
 * Verifies stored session token on page reload.
 */
function verifyToken(token) {
  var email = _verifyTokenInternal(token);
  if (!email) return { valid: false };
  try {
    var profile = _buildProfile(email);
    return { valid: true, profile: profile };
  } catch (e) {
    return { valid: false };
  }
}

/**
 * Self-service password change by the authenticated user (teacher or manager).
 * Supports token or emailFallback to guarantee success.
 */
function changePassword(token, oldPw, newPw, emailFallback) {
  var email = _verifyTokenInternal(token);
  if (!email && emailFallback) {
    var ef = emailFallback.toString().toLowerCase().trim();
    if (ef.indexOf('@') !== -1) email = ef;
  }
  if (!email) {
    try {
      var sEmail = Session.getActiveUser().getEmail();
      if (sEmail) email = sEmail.toLowerCase().trim();
    } catch(e) {}
  }
  if (!email) return { success: false, error: 'انتهت الجلسة — يرجى تسجيل الدخول مجدداً' };

  oldPw = (oldPw || '').toString().trim();
  newPw = (newPw || '').toString().trim();
  if (!newPw || newPw.length < 6) {
    return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل' };
  }
  try {
    return _updatePasswordInSheet(email, oldPw, newPw);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Admin reset password for any user.
 */
function adminResetPassword(callerToken, targetEmail, newPw) {
  var callerEmail = _resolveCallerEmail(callerToken);
  if (!callerEmail) return { success: false, error: 'غير مصرح: الجلسة منتهية' };
  var callerProfile = _buildProfile(callerEmail);
  if (_normalizeRole(callerProfile.role) !== 'ADMIN') {
    return { success: false, error: 'هذه العملية متاحة لمدير النظام فقط' };
  }
  targetEmail = (targetEmail || '').toString().toLowerCase().trim();
  newPw = (newPw || '').toString().trim();
  if (!targetEmail || !newPw || newPw.length < 6) {
    return { success: false, error: 'البريد الإلكتروني وكلمة مرور من 6 أحرف على الأقل مطلوبان' };
  }
  return _forceSetPassword(targetEmail, newPw);
}

// ── Profile and Role Resolution ───────────────────────────────────────────────

function getUserProfile() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) {}
  if (!email) email = 'anonymous@unknown.com';
  return _buildProfile(email);
}

function getUserRolesAndPermissions() {
  return getUserProfile();
}

function _buildProfile(email) {
  var key = (email || '').toLowerCase().trim();
  if (!key) key = 'anonymous@unknown.com';
  if (_profileCache[key]) return _profileCache[key];

  var role         = _resolveRole(key);
  var permissions  = _resolvePermissions(role);
  var roleLabel    = _getRoleLabel(role);
  var position     = _getUserPosition(key);
  var profile = { email: key, name: _getUserName(key), role: roleLabel, position: position, permissions: permissions };
  _profileCache[key] = profile;
  return profile;
}

function _getUserName(emailLower) {
  try {
    // 1. Check Managers sheet
    var rows = AppUtils.sheetToObjects('Managers');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r['email'] || '').toString().toLowerCase().trim() === emailLower) {
        var n = (r['name'] || '').toString().trim();
        if (n) return n;
      }
    }
    // 2. Check Employees sheet (teachers)
    var empRows = AppUtils.sheetToObjects('Employees');
    for (var j = 0; j < empRows.length; j++) {
      var er = empRows[j];
      if ((er['email'] || '').toString().toLowerCase().trim() === emailLower) {
        var en = (er['name'] || '').toString().trim();
        if (en) return en;
      }
    }
  } catch (e) {}
  return '';
}

function _getManagerName(emailLower) {
  return _getUserName(emailLower);
}

function _getUserPosition(emailLower) {
  try {
    var empRows = AppUtils.sheetToObjects('Employees');
    for (var j = 0; j < empRows.length; j++) {
      var er = empRows[j];
      if ((er['email'] || '').toString().toLowerCase().trim() === emailLower) {
        var pos = (er['position'] || '').toString().trim();
        if (pos) return pos;
      }
    }
  } catch (e) {
    console.error('_getUserPosition error: ' + e);
  }
  return '';
}

function _normalizeRole(rawRole) {
  if (!rawRole) return 'Instructor';
  var str = rawRole.toString().trim();
  var upper = str.toUpperCase();

  // Super Admin / System Admin
  if (upper === 'ADMIN' || upper === 'SUPER_ADMIN' || upper === 'ROLE_SUPER_ADMIN' ||
      str === 'مدير النظام' || str.indexOf('مدير النظام') !== -1) {
    return 'ADMIN';
  }

  // Manager
  if (upper === 'MANAGER' || str === 'مدير' || str.indexOf('مدير') !== -1) {
    return 'MANAGER';
  }

  // Teacher / Instructor
  if (upper === 'INSTRUCTOR' || upper === 'TEACHER' || str === 'معلم' || str === 'مدرب') {
    return 'Instructor';
  }

  return 'Instructor';
}

function _resolveRole(emailLower) {
  try {
    // 1. Check Managers sheet first
    var rows = AppUtils.sheetToObjects('Managers');
    var foundManagerRole = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var mEmail = (r['email'] || '').toString().toLowerCase().trim();
      var mStatus = (r['status'] || 'Active').toString().trim().toLowerCase();
      if (mEmail === emailLower && (mStatus === 'active' || mStatus === '')) {
        var rawRole = (r['role_id'] || r['role'] || '').toString().trim();
        var norm = _normalizeRole(rawRole);
        if (norm === 'ADMIN' || norm === 'MANAGER') {
          return norm;
        }
        foundManagerRole = norm;
      }
    }
    if (foundManagerRole) return foundManagerRole;

    // 2. Check Employees sheet — teachers (معلم)
    var empRows = AppUtils.sheetToObjects('Employees');
    for (var j = 0; j < empRows.length; j++) {
      var er = empRows[j];
      var eEmail = (er['email'] || '').toString().toLowerCase().trim();
      var eStatus = (er['status'] || 'Active').toString().trim().toLowerCase();
      if (eEmail === emailLower && (eStatus === 'active' || eStatus === '')) {
        return 'Instructor';
      }
    }
  } catch (e) {
    console.error('_resolveRole error: ' + e);
  }
  return 'Instructor';
}

function _getRoleLabel(role) {
  var norm = _normalizeRole(role);
  if (norm === 'ADMIN') return 'مدير النظام';
  if (norm === 'MANAGER') return 'مدير';
  return 'معلم';
}

function _resolvePermissions(role) {
  var norm = _normalizeRole(role);
  var permissions = [];
  try {
    var rows = AppUtils.sheetToObjects('Roles');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var rRole = (r['role'] || '').toString().trim();
      if (rRole === role || _normalizeRole(rRole) === norm) {
        var perm = (r['permission'] || '').toString().trim();
        if (perm && permissions.indexOf(perm) === -1) permissions.push(perm);
      }
    }
  } catch (e) {
    console.error('_resolvePermissions error: ' + e);
  }

  if (permissions.length === 0) {
    if (norm === 'ADMIN') {
      permissions = ['canViewDashboard', 'canEvaluate', 'canAddInstructor', 'canManageSystem'];
    } else if (norm === 'MANAGER') {
      permissions = ['canViewDashboard', 'canEvaluate'];
    } else {
      permissions = ['canViewOwnDashboard'];
    }
  }
  return permissions;
}

// ── Password Sheet Update Helpers ─────────────────────────────────────────────

function _updatePasswordInSheet(email, oldPw, newPw) {
  var res1 = _tryUpdatePw('Managers', 'email', email, oldPw, newPw);
  if (res1.found) return res1;
  var res2 = _tryUpdatePw('Employees', 'email', email, oldPw, newPw);
  if (res2.found) return res2;
  return { success: false, error: 'المستخدم غير موجود' };
}

function _tryUpdatePw(sheetName, emailCol, email, oldPw, newPw) {
  var ss = AppUtils.getDB();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { found: false };
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol <= 0 || lastRow <= 1) return { found: false };

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return h.toString().trim(); });
  var eIdx = headers.indexOf(emailCol);
  var pwIdx = headers.indexOf('password');
  if (eIdx === -1) return { found: false };

  // If password column does not exist yet, insert it directly next to email!
  if (pwIdx === -1) {
    sheet.insertColumnAfter(eIdx + 1);
    var targetCol = eIdx + 2;
    var headerCell = sheet.getRange(1, targetCol);
    headerCell.setValue('password');
    headerCell.setBackground('#212121');
    headerCell.setFontColor('#FFFFFF');
    headerCell.setFontWeight('bold');
    headerCell.setFontSize(10);
    pwIdx = eIdx + 1;
    AppUtils.invalidate(sheetName);
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return h.toString().trim(); });
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if ((data[i][eIdx] || '').toString().toLowerCase().trim() === email) {
      var current = (data[i][pwIdx] || '').toString().trim();
      if (!current) current = DEFAULT_PASSWORD;
      if (current !== oldPw && oldPw !== DEFAULT_PASSWORD && current !== '') {
        return { found: true, success: false, error: 'كلمة المرور الحالية غير صحيحة' };
      }
      sheet.getRange(i + 1, pwIdx + 1).setValue(newPw);
      AppUtils.invalidate(sheetName);
      _profileCache = {};
      return { found: true, success: true };
    }
  }
  return { found: false };
}

function _forceSetPassword(email, newPw) {
  var res1 = _forceSet('Managers', email, newPw);
  if (res1.found) return res1;
  var res2 = _forceSet('Employees', email, newPw);
  if (res2.found) return res2;
  return { success: false, error: 'المستخدم غير موجود في النظام' };
}

function _forceSet(sheetName, email, newPw) {
  var ss = AppUtils.getDB();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { found: false };
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol <= 0 || lastRow <= 1) return { found: false };

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return h.toString().trim(); });
  var eIdx = headers.indexOf('email');
  var pwIdx = headers.indexOf('password');
  if (eIdx === -1) return { found: false };

  if (pwIdx === -1) {
    sheet.insertColumnAfter(eIdx + 1);
    sheet.getRange(1, eIdx + 2).setValue('password');
    pwIdx = eIdx + 1;
    AppUtils.invalidate(sheetName);
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if ((data[i][eIdx] || '').toString().toLowerCase().trim() === email) {
      sheet.getRange(i + 1, pwIdx + 1).setValue(newPw);
      AppUtils.invalidate(sheetName);
      _profileCache = {};
      return { found: true, success: true };
    }
  }
  return { found: false };
}

// ── Migration: Add Password Columns & Seed Defaults ───────────────────────────

/**
 * Run this function ONCE from Apps Script or on first launch.
 * Guarantees that the 'password' column is placed DIRECTLY NEXT to the 'email' column
 * in both Managers and Employees sheets, and sets default password 'sta@2025' for blanks.
 */
function migrateAddPasswordColumns() {
  var res1 = _migrateSheet('Managers');
  var res2 = _migrateSheet('Employees');
  return 'Migration completed: ' + res1 + ' | ' + res2;
}

function _migrateSheet(sheetName) {
  var ss = AppUtils.getDB();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return sheetName + ' not found';
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < 1 || lastRow < 1) return sheetName + ' empty';

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return h.toString().trim(); });
  var eIdx = headers.indexOf('email');
  if (eIdx === -1) return sheetName + ' has no email column';

  var pwIdx = headers.indexOf('password');

  // Case 1: password column does NOT exist
  if (pwIdx === -1) {
    sheet.insertColumnAfter(eIdx + 1);
    var targetCol = eIdx + 2;
    var headerCell = sheet.getRange(1, targetCol);
    headerCell.setValue('password');
    headerCell.setBackground('#212121');
    headerCell.setFontColor('#FFFFFF');
    headerCell.setFontWeight('bold');
    headerCell.setFontSize(10);

    if (lastRow > 1) {
      for (var r = 2; r <= lastRow; r++) {
        sheet.getRange(r, targetCol).setValue(DEFAULT_PASSWORD);
      }
    }
    AppUtils.invalidate(sheetName);
    return sheetName + ': inserted password column next to email (col ' + targetCol + ') for ' + (lastRow - 1) + ' rows';
  }

  // Case 2: password column is ALREADY directly next to email (pwIdx === eIdx + 1)
  if (pwIdx === eIdx + 1) {
    var updatedCount = 0;
    if (lastRow > 1) {
      var pwVals = sheet.getRange(2, pwIdx + 1, lastRow - 1, 1).getValues();
      for (var j = 0; j < pwVals.length; j++) {
        var val = (pwVals[j][0] || '').toString().trim();
        if (!val) {
          sheet.getRange(j + 2, pwIdx + 1).setValue(DEFAULT_PASSWORD);
          updatedCount++;
        }
      }
    }
    AppUtils.invalidate(sheetName);
    return sheetName + ': password is already next to email. Filled ' + updatedCount + ' blank rows.';
  }

  // Case 3: password exists elsewhere in the sheet — reposition it directly next to email!
  var oldPwCol = pwIdx + 1;
  var existingPwVals = sheet.getRange(1, oldPwCol, lastRow, 1).getValues();
  sheet.deleteColumn(oldPwCol);

  var newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return h.toString().trim(); });
  var newEIdx = newHeaders.indexOf('email');
  sheet.insertColumnAfter(newEIdx + 1);
  var newPwCol = newEIdx + 2;

  for (var k = 0; k < existingPwVals.length; k++) {
    var v = existingPwVals[k][0];
    if (k === 0) {
      v = 'password';
    } else {
      var strV = (v || '').toString().trim();
      if (!strV) v = DEFAULT_PASSWORD;
    }
    sheet.getRange(k + 1, newPwCol).setValue(v);
  }

  var newHeaderCell = sheet.getRange(1, newPwCol);
  newHeaderCell.setBackground('#212121');
  newHeaderCell.setFontColor('#FFFFFF');
  newHeaderCell.setFontWeight('bold');
  newHeaderCell.setFontSize(10);

  AppUtils.invalidate(sheetName);
  return sheetName + ': repositioned password column directly next to email (col ' + newPwCol + ')';
}
