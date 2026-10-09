// ============================================================
//  EMPLOYEE  –  read operations for the Employees sheet
// ============================================================

function getActiveEmployees() {
  // sheetToObjects uses the in-execution cache — free on second call
  var rows = AppUtils.sheetToObjects('Employees');
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if ((r['status'] || '').toString().trim().toLowerCase() !== 'active') continue;
    result.push({
      id:       (r['employee_id']   || '').toString(),
      name:     (r['name']          || '').toString(),
      email:    (r['email']         || '').toString(),
      deptId:   (r['department_id'] || '').toString(),
      branch:   (r['school_branch'] || '').toString(),
      position: (r['position']      || '').toString()
    });
  }
  return result;
}

/**
 * Returns the full profile for one employee with department name resolved.
 * Reads from cache — no extra spreadsheet round-trips if called after
 * getActiveEmployees() or getDashboardStats() in the same execution.
 */
function getEmployeeProfile(employeeId) {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  PermissionGuard.require(callerEmail, 'canEvaluate');

  var empIdStr = employeeId.toString();
  var deptMap  = _buildDeptMap();   // uses cache
  var rows     = AppUtils.sheetToObjects('Employees'); // uses cache

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r['employee_id'].toString() === empIdStr &&
        (r['status'] || '').toString().trim().toLowerCase() === 'active') {
      return {
        id:         r['employee_id'].toString(),
        name:       r['name'].toString(),
        email:      r['email'].toString(),
        deptId:     (r['department_id'] || '').toString(),
        department: deptMap[r['department_id']] || r['department_id'].toString(),
        branch:     (r['school_branch'] || '').toString(),
        position:   (r['position']      || '').toString()
      };
    }
  }
  throw new Error('المعلم غير موجود أو غير نشط: ' + employeeId);
}

/**
 * Returns the logged-in user's own employee record matched by email.
 */
function getMyEmployeeRecord() {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  if (!callerEmail) return null;

  var rows = AppUtils.sheetToObjects('Employees');
  var deptMap = _buildDeptMap();

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var empEmail = (r['email'] || '').toString().toLowerCase().trim();
    if (empEmail === callerEmail.toLowerCase().trim()) {
      var did = (r['department_id'] || '').toString().trim();
      return {
        id:       (r['employee_id']   || '').toString(),
        name:     (r['name']          || '').toString(),
        email:    empEmail,
        deptId:   did,
        department: deptMap[did] || did,
        spec:     (r['position']      || '').toString(),
        school:   (r['school_branch'] || '').toString(),
        position: (r['position']      || '').toString()
      };
    }
  }
  return null;
}

/** Builds a map of department_id → department_name (uses cache) */
function _buildDeptMap() {
  var map  = {};
  var rows = AppUtils.sheetToObjects('Departments');
  for (var i = 0; i < rows.length; i++) {
    map[rows[i]['department_id']] = rows[i]['department_name'];
  }
  return map;
}


