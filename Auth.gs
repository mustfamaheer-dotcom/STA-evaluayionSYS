// ============================================================
//  AUTH  –  resolves the current user's role & permissions
// ============================================================

var _profileCache = {};

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
  var key = email.toLowerCase().trim();
  if (_profileCache[key]) return _profileCache[key];

  var role         = _resolveRole(key);
  var permissions  = _resolvePermissions(role);
  var roleLabel    = _getRoleLabel(role);
  var profile = { email: email, name: _getUserName(key), role: roleLabel, permissions: permissions };
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
        // If assigned as ADMIN or MANAGER, prefer it immediately
        if (norm === 'ADMIN' || norm === 'MANAGER') {
          return norm;
        }
        foundManagerRole = norm;
      }
    }
    if (foundManagerRole) return foundManagerRole;

    // 2. Check Employees sheet — these are the teachers (معلم)
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