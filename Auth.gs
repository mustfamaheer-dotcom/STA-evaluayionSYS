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
  var profile = { email: email, name: _getManagerName(key), role: roleLabel, permissions: permissions };
  _profileCache[key] = profile;
  return profile;
}

function _getManagerName(emailLower) {
  try {
    var rows = AppUtils.sheetToObjects('Managers');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r['email'] || '').toString().toLowerCase().trim() === emailLower) {
        return (r['name'] || '').toString().trim();
      }
    }
  } catch (e) {}
  return '';
}

function _resolveRole(emailLower) {
  try {
    var rows = AppUtils.sheetToObjects('Managers');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r['email'] || '').toString().toLowerCase().trim() === emailLower &&
          (r['status'] || '').toString().trim() === 'Active') {
        return (r['role_id'] || r['role'] || 'Instructor').toString().trim();
      }
    }
  } catch (e) {
    console.error('_resolveRole error: ' + e);
  }
  return 'Instructor';
}

function _getRoleLabel(role) {
  var ru = role.toUpperCase();
  if (ru === 'ROLE_SUPER_ADMIN' || ru === 'ADMIN' || ru === 'SUPER_ADMIN') return 'مدير النظام';
  if (ru === 'MANAGER') return 'مدير';
  return 'معلم';
}

function _resolvePermissions(role) {
  var permissions = [];
  try {
    var rows = AppUtils.sheetToObjects('Roles');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r['role'] || '').toString().trim() === role) {
        var perm = (r['permission'] || '').toString().trim();
        if (perm && permissions.indexOf(perm) === -1) permissions.push(perm);
      }
    }
  } catch (e) {
    console.error('_resolvePermissions error: ' + e);
  }

  if (permissions.length === 0) {
    var ru = role.toUpperCase();
    if (ru === 'ROLE_SUPER_ADMIN' || ru === 'ADMIN' || ru === 'SUPER_ADMIN') {
      permissions = ['canViewDashboard', 'canEvaluate', 'canAddInstructor', 'canManageSystem'];
    } else if (ru === 'MANAGER') {
      permissions = ['canViewDashboard', 'canEvaluate'];
    } else {
      permissions = ['canViewOwnDashboard'];
    }
  }
  return permissions;
}