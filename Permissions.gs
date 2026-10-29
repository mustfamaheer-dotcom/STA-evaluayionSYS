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

  requireToken: function (token, permissionKey) {
    var email = _resolveCallerEmail(token);
    if (!email) throw new Error('انتهت جلستك — يرجى تسجيل الدخول مجدداً');
    var profile = _buildProfile(email);
    if (profile.permissions.indexOf(permissionKey) !== -1) return email;
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
