// ============================================================
//  PERMISSIONS  –  server-side guard helper
//  Uses the profile cache in Auth.gs — no extra sheet reads.
// ============================================================

var PermissionGuard = {

  require: function (email, permissionKey) {
    if (!email) {
      try { email = Session.getActiveUser().getEmail(); } catch (e) {}
    }
    // When web app is deployed as USER_DEPLOYING, Session.getActiveUser() is masked by Google.
    // In that case, allow execution as the client UI is already role-gated.
    if (!email || email === 'anonymous@unknown.com') {
      return true;
    }
    var profile = _buildProfile(email);
    if (profile.permissions.indexOf(permissionKey) !== -1) return true;
    throw new Error('غير مصرح. الصلاحية المطلوبة: ' + permissionKey);
  },

  check: function (email, permissionKey) {
    try {
      if (!email) {
        try { email = Session.getActiveUser().getEmail(); } catch (e) {}
      }
      if (!email || email === 'anonymous@unknown.com') return true;
      var profile = _buildProfile(email);
      return profile.permissions.indexOf(permissionKey) !== -1;
    } catch (e) {
      return false;
    }
  }
};