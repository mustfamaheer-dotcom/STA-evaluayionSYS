// ============================================================
//  PERMISSIONS  –  server-side guard helper
//  Uses the profile cache in Auth.gs — no extra sheet reads.
// ============================================================

var PermissionGuard = {

  require: function (email, permissionKey) {
    var profile = _buildProfile(email || 'anonymous@unknown.com');
    if (profile.permissions.indexOf(permissionKey) !== -1) return true;
    throw new Error('غير مصرح. الصلاحية المطلوبة: ' + permissionKey);
  },

  check: function (email, permissionKey) {
    try {
      var profile = _buildProfile(email || 'anonymous@unknown.com');
      return profile.permissions.indexOf(permissionKey) !== -1;
    } catch (e) {
      return false;
    }
  }
};