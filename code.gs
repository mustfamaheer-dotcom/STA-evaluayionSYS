// ============================================================
//  CODE.GS  –  entry point + all generic data functions
// ============================================================

const SPREADSHEET_ID = '1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU';

// ── Web App Entry Point ───────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('STA — Instructor Evaluation System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Client-facing aliases ─────────────────────────────────────────────────────

function getRowsFromTable(tableName) {
  return getActiveRows(tableName);
}

// Write aliases
function addNewDepartmentRow(p, optionalToken) { return addDepartment(p, optionalToken); }
function addNewClassRow(p, optionalToken)      { return addClass({ name: p.name, departmentId: p.department_id, grade: p.grade }, optionalToken); }
function addNewQuestionRow(p, optionalToken)   { return addQuestion(p, optionalToken); }
function addNewInstructorRow(p, optionalToken) {
  return addInstructor({
    name:         p.name,
    email:        p.email,
    departmentId: p.department,
    branch:       p.branch,
    branchId:     p.branchId,
    position:     p.position
  }, optionalToken);
}
function addNewManagerRow(p, optionalToken) { return addManager(p, optionalToken); }

/**
 * Maps the client payload to submitEvaluation()'s shape.
 * Stores basic info fields directly in the Evaluations sheet.
 */
function saveEvaluationSubmission(payload, optionalToken) {
  var token = optionalToken || (payload && (payload.authToken || payload.token));
  return submitEvaluation({
    teacherId:      payload.teacherId || '',
    teacherName:    payload.teacherName || '',
    teacherSpec:    payload.teacherSpec || '',
    school:         payload.school || '',
    grade:          payload.grade || '',
    className:      payload.className || '',
    classSpec:      payload.classSpec || '',
    semester:       payload.semester || '',
    notes:          payload.notes || '',
    responses:      payload.ratings,
    authToken:      token,
    userEmail:      payload.userEmail || ''
  }, token);
}

// ── Generic Table Reader ──────────────────────────────────────────────────────

/**
 * Returns all Active rows from any sheet.
 * Delegates to AppUtils.sheetToObjects which uses the in-execution cache.
 */
function getActiveRows(tableName) {
  var data = AppUtils._getRawData(tableName);
  if (!data) return [];

  var headers = data[0].map(function (h) { return h.toString().trim(); });
  var tz      = AppUtils.getTZ();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var allBlank = true;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== '' && row[k] !== null && row[k] !== undefined) { allBlank = false; break; }
    }
    if (allBlank) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      obj[headers[j]] = (val instanceof Date)
        ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
        : (val === null || val === undefined ? '' : val);
    }

    var statusVal = (obj['status'] || '').toString().trim().toLowerCase();
    if (statusVal === 'active' || statusVal === '') {
      results.push(obj);
    }
  }
  return results;
}

// Convenience wrappers
function getDepartments() { return getActiveRows('Departments'); }
function getClasses()     { return getActiveRows('Classes');     }
function getSubjects()    { return getActiveRows('Subjects');    }

function getTeachers() {
  var rows  = getActiveRows('Employees');
  var depts = getActiveRows('Departments');
  var branches = getActiveRows('Branches');
  var deptMap = {};
  var deptNameToId = {};
  for (var di = 0; di < depts.length; di++) {
    var dId = (depts[di]['department_id'] || '').toString().trim();
    var dName = (depts[di]['department_name'] || '').toString().trim();
    deptMap[dId] = dName;
    if (dName) deptNameToId[dName.toLowerCase()] = dId;
  }
  var branchMap = {};
  var branchNameToId = {};
  for (var bi = 0; bi < branches.length; bi++) {
    var bId = (branches[bi]['branch_id'] || '').toString().trim();
    var bName = (branches[bi]['branch_name'] || '').toString().trim();
    branchMap[bId] = bName;
    if (bName) branchNameToId[bName.toLowerCase()] = bId;
  }
  return rows.map(function(r) {
    var did = (r['department_id'] || '').toString().trim();
    var bid = (r['branch_id'] || '').toString().trim();
    var schoolBranch = (r['school_branch'] || '').toString().trim();

    // Fallback: resolve branchId from school_branch if branch_id is blank
    if (!bid && schoolBranch && branchNameToId[schoolBranch.toLowerCase()]) {
      bid = branchNameToId[schoolBranch.toLowerCase()];
    }
    // Fallback: resolve deptId from dept name if department_id is a name instead of ID
    if (!deptMap[did] && did && deptNameToId[did.toLowerCase()]) {
      did = deptNameToId[did.toLowerCase()];
    }

    var bName = branchMap[bid] || schoolBranch || (bid ? 'فرع ' + bid : 'الفرع الرئيسي');
    var dName = deptMap[did] || did || 'القسم العام';

    if (!bid) bid = bName;
    if (!did) did = dName;

    return {
      id:       (r['employee_id']    || '').toString(),
      name:     (r['name']            || '').toString(),
      spec:     (r['position']       || '').toString(),
      school:   bName,
      dept:     dName,
      branchId: bid,
      deptId:   did
    };
  });
}

function getGrades() {
  var rows = getActiveRows('Classes');
  var seen = {};
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var g = (rows[i]['grade'] || '').toString().trim();
    if (g && !seen[g]) { seen[g] = true; result.push(g); }
  }
  return result.sort();
}

function getClassesByGrade(grade, branchId) {
  return getClassesByGradeAndSpec(grade, null, branchId);
}

function getBranchDeptIds(branchId) {
  if (!branchId) return null;
  var bds = AppUtils.sheetToObjects('BranchDepartments');
  var ids = {};
  for (var i = 0; i < bds.length; i++) {
    if ((bds[i]['branch_id'] || '').toString().trim() === branchId.toString().trim()) {
      ids[(bds[i]['department_id'] || '').toString().trim()] = true;
    }
  }
  return Object.keys(ids);
}

function getClassSpecsByGrade(grade, branchId) {
  try {
    var rows = getActiveRows('Classes');
    var deptRows = getActiveRows('Departments');
    var deptMap = {};
    for (var d = 0; d < deptRows.length; d++) {
      deptMap[deptRows[d]['department_id']] = (deptRows[d]['department_name'] || '').toString();
    }
    var allowedDepts = branchId ? getBranchDeptIds(branchId) : null;
    var targetGrade = (grade || '').toString().trim();
    var specs = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r['grade'] || '').toString().trim() !== targetGrade) continue;
      var deptId = (r['department_id'] || '').toString();
      if (allowedDepts && allowedDepts.indexOf(deptId) < 0) continue;
      var specName = deptMap[deptId] || deptId;
      if (specName) specs[specName] = true;
    }
    var result = [];
    for (var s in specs) { if (specs.hasOwnProperty(s)) result.push(s); }
    return result.sort();
  } catch (e) {
    return [];
  }
}

function getClassesByGradeAndSpec(grade, spec, branchId) {
  var rows = getActiveRows('Classes');
  var deptRows = getActiveRows('Departments');
  var deptMap = {};
  for (var d = 0; d < deptRows.length; d++) {
    deptMap[deptRows[d]['department_id']] = (deptRows[d]['department_name'] || '').toString();
  }
  var allowedDepts = branchId ? getBranchDeptIds(branchId) : null;
  var targetGrade = (grade || '').toString().trim();
  return rows
    .filter(function(r) {
      if (targetGrade && (r['grade'] || '').toString().trim() !== targetGrade) return false;
      var deptId = (r['department_id'] || '').toString();
      if (allowedDepts && allowedDepts.indexOf(deptId) < 0) return false;
      if (spec) {
        var specName = deptMap[deptId] || deptId;
        if (specName !== spec.toString().trim()) return false;
      }
      return true;
    })
    .map(function(r) {
      var deptId = (r['department_id'] || '').toString();
      return {
        id:    (r['class_id']      || '').toString(),
        name:  (r['class_name']    || '').toString(),
        spec:  deptMap[deptId] || deptId
      };
    });
}

// ── Debug helper (run from Apps Script editor only) ───────────────────────────
function debugGetRows(tableName) {
  var ss      = AppUtils.getDB();
  var sheet   = ss.getSheetByName(tableName || 'Classes');
  if (!sheet) return 'Sheet not found';
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().trim(); });
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      var v = row[i];
      obj[h] = (v instanceof Date) ? v.toString() : v;
    });
    return obj;
  });
}

// ── Write Operations ──────────────────────────────────────────────────────────

/**
 * Generic row-append.
 * Reads headers once, writes the row, invalidates the sheet cache.
 */
function _extractCallerEmail() {
  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    if (!arg) continue;
    var resolved = _resolveCallerEmail(arg);
    if (resolved) return resolved;
  }
  return _resolveCallerEmail(null);
}

function addRow(tableName, payload, optionalToken) {
  try {
    var callerEmail = _extractCallerEmail(optionalToken, payload);
    PermissionGuard.require(callerEmail, 'canManageSystem');

    var ss    = AppUtils.getDB();
    var sheet = ss.getSheetByName(tableName);
    if (!sheet) return { success: false, error: 'الصفحة غير موجودة: ' + tableName };

    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return h.toString().trim(); })
      : [];

    var idMap = {
      Departments:      { col: 'department_id',      prefix: 'dept' },
      Classes:          { col: 'class_id',             prefix: 'cls'  },
      Subjects:         { col: 'subject_id',           prefix: 'sub'  },
      Questions:        { col: 'question_id',         prefix: 'qst'  },
      Employees:        { col: 'employee_id',         prefix: 'emp'  },
      Managers:         { col: 'manager_id',           prefix: 'mgr'  },
      Branches:         { col: 'branch_id',            prefix: 'brn'  },
      BranchDepartments:{ col: 'branch_dept_id',       prefix: 'bdp'  },
      ManagerDepartments:{ col: 'mgr_dept_id',         prefix: 'mdp'  }
    };

    var meta   = idMap[tableName] || { col: 'id', prefix: tableName.substring(0, 3).toLowerCase() };
    var newRow = new Array(headers.length).fill('');

    var idIdx = headers.indexOf(meta.col);
    if (idIdx !== -1) newRow[idIdx] = AppUtils.generateId(meta.prefix);

    for (var i = 0; i < headers.length; i++) {
      if (payload[headers[i]] !== undefined && payload[headers[i]] !== null) {
        newRow[i] = payload[headers[i]];
      }
    }

    var statusIdx = headers.indexOf('status');
    if (statusIdx !== -1 && !newRow[statusIdx]) newRow[statusIdx] = 'Active';

    var createdIdx = headers.indexOf('created_at');
    if (createdIdx !== -1 && !newRow[createdIdx]) newRow[createdIdx] = new Date();

    sheet.appendRow(newRow);

    AppUtils.invalidate(tableName);

    AppUtils.writeLog(callerEmail, 'ADD_ROW', tableName, 'Row added', 'SUCCESS');
    return { success: true };

  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Convenience write wrappers ───────────────────────────────────────────────

function addDepartment(p, optionalToken) {
  return addRow('Departments', { department_name: p.name }, optionalToken);
}
function addClass(p, optionalToken) {
  return addRow('Classes', { class_name: p.name, department_id: p.departmentId, grade: p.grade }, optionalToken);
}
function addQuestion(p, optionalToken) {
  return addRow('Questions', {
    category:      p.category,
    question_text: p.text,
    weight:        p.weight,
    status:        'Active'
  }, optionalToken);
}
function addInstructor(p, optionalToken) {
  var row = {
    name:          p.name,
    email:         p.email,
    department_id: p.departmentId,
    position:      p.position
  };
  if (p.branchId) row.branch_id = p.branchId;
  if (p.branch) row.school_branch = p.branch;
  return addRow('Employees', row, optionalToken);
}

function getBranches() {
  return getActiveRows('Branches');
}

function addNewBranchRow(p, optionalToken) {
  return addRow('Branches', { branch_name: p.name }, optionalToken);
}

/**
 * Returns all active classes with resolved department names for management
 */
function getClassesWithDetails() {
  var rows = getActiveRows('Classes');
  var depts = getActiveRows('Departments');
  var deptMap = {};
  for (var di = 0; di < depts.length; di++) {
    deptMap[(depts[di]['department_id'] || '').toString().trim()] = (depts[di]['department_name'] || '').toString();
  }
  return rows.map(function (r) {
    var dId = (r['department_id'] || '').toString().trim();
    return {
      class_id: (r['class_id'] || '').toString().trim(),
      class_name: (r['class_name'] || '').toString().trim(),
      department_id: dId,
      department_name: deptMap[dId] || '',
      grade: (r['grade'] || '').toString().trim(),
      status: (r['status'] || 'Active').toString().trim()
    };
  });
}

/**
 * Updates a class's name, department, or grade
 */
function updateClass(classId, p, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken, p);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (classId || '').toString().trim();
  if (!targetId) return { success: false, error: 'معرف الفصل مطلوب' };

  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Classes');
    if (!sheet) return { success: false, error: 'صفحة Classes غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('class_id');
    var nameIdx = headers.indexOf('class_name');
    var deptIdx = headers.indexOf('department_id');
    var gradeIdx = headers.indexOf('grade');
    var statusIdx = headers.indexOf('status');

    if (idIdx === -1) return { success: false, error: 'عمود class_id غير موجود' };

    for (var i = 1; i < data.length; i++) {
      if ((data[i][idIdx] || '').toString().trim() === targetId) {
        var rowNum = i + 1;
        if (p.name !== undefined && nameIdx !== -1) sheet.getRange(rowNum, nameIdx + 1).setValue(p.name);
        if (p.department_id !== undefined && deptIdx !== -1) sheet.getRange(rowNum, deptIdx + 1).setValue(p.department_id);
        if (p.grade !== undefined && gradeIdx !== -1) sheet.getRange(rowNum, gradeIdx + 1).setValue(p.grade);
        if (p.status !== undefined && statusIdx !== -1) sheet.getRange(rowNum, statusIdx + 1).setValue(p.status);

        AppUtils.invalidate('Classes');
        AppUtils.writeLog(callerEmail, 'UPDATE_CLASS', 'Classes', 'Class:' + targetId, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'لم يتم العثور على الفصل' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Deletes / deactivates a class
 */
function deleteClass(classId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (classId || '').toString().trim();
  if (!targetId) return { success: false, error: 'معرف الفصل مطلوب' };

  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Classes');
    if (!sheet) return { success: false, error: 'صفحة Classes غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('class_id');
    var statusIdx = headers.indexOf('status');

    if (idIdx === -1) return { success: false, error: 'عمود class_id غير موجود' };

    for (var i = 1; i < data.length; i++) {
      if ((data[i][idIdx] || '').toString().trim() === targetId) {
        var rowNum = i + 1;
        if (statusIdx !== -1) {
          sheet.getRange(rowNum, statusIdx + 1).setValue('Inactive');
        } else {
          sheet.deleteRow(rowNum);
        }
        AppUtils.invalidate('Classes');
        AppUtils.writeLog(callerEmail, 'DELETE_CLASS', 'Classes', 'Class:' + targetId, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'لم يتم العثور على الفصل' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Updates a branch's name or status
 */
function updateBranch(branchId, p, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken, p);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (branchId || '').toString().trim();
  if (!targetId) return { success: false, error: 'معرف الفرع مطلوب' };

  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Branches');
    if (!sheet) return { success: false, error: 'صفحة Branches غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('branch_id');
    var nameIdx = headers.indexOf('branch_name');
    var statusIdx = headers.indexOf('status');

    if (idIdx === -1) return { success: false, error: 'عمود branch_id غير موجود' };

    for (var i = 1; i < data.length; i++) {
      if ((data[i][idIdx] || '').toString().trim() === targetId) {
        var rowNum = i + 1;
        if (p.name !== undefined && nameIdx !== -1) sheet.getRange(rowNum, nameIdx + 1).setValue(p.name);
        if (p.status !== undefined && statusIdx !== -1) sheet.getRange(rowNum, statusIdx + 1).setValue(p.status);

        AppUtils.invalidate('Branches');
        AppUtils.writeLog(callerEmail, 'UPDATE_BRANCH', 'Branches', 'Branch:' + targetId, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'لم يتم العثور على الفرع' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Deletes / deactivates a branch
 */
function deleteBranch(branchId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (branchId || '').toString().trim();
  if (!targetId) return { success: false, error: 'معرف الفرع مطلوب' };

  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Branches');
    if (!sheet) return { success: false, error: 'صفحة Branches غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('branch_id');
    var statusIdx = headers.indexOf('status');

    if (idIdx === -1) return { success: false, error: 'عمود branch_id غير موجود' };

    for (var i = 1; i < data.length; i++) {
      if ((data[i][idIdx] || '').toString().trim() === targetId) {
        var rowNum = i + 1;
        if (statusIdx !== -1) {
          sheet.getRange(rowNum, statusIdx + 1).setValue('Inactive');
        } else {
          sheet.deleteRow(rowNum);
        }
        AppUtils.invalidate('Branches');
        AppUtils.writeLog(callerEmail, 'DELETE_BRANCH', 'Branches', 'Branch:' + targetId, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'لم يتم العثور على الفرع' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getBranchDepartments(branchId) {
  var bds = AppUtils.sheetToObjects('BranchDepartments');
  var depts = AppUtils.sheetToObjects('Departments');
  var deptMap = {};
  for (var di = 0; di < depts.length; di++) {
    deptMap[(depts[di]['department_id'] || '').toString().trim()] = depts[di];
  }
  var result = [];
  for (var i = 0; i < bds.length; i++) {
    var r = bds[i];
    if ((r['branch_id'] || '').toString().trim() !== branchId.toString().trim()) continue;
    var deptId = (r['department_id'] || '').toString().trim();
    var dept = deptMap[deptId] || null;
    if (dept) {
      result.push({
        branchDeptId: (r['branch_dept_id'] || '').toString(),
        branchId:     branchId,
        departmentId: deptId,
        departmentName: (dept['department_name'] || '').toString(),
        status:       (r['status'] || '').toString()
      });
    }
  }
  return result;
}

function addBranchDepartment(branchId, departmentId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');
  var bds = AppUtils.sheetToObjects('BranchDepartments');
  for (var i = 0; i < bds.length; i++) {
    var r = bds[i];
    if ((r['branch_id'] || '').toString().trim() === branchId.toString().trim() &&
        (r['department_id'] || '').toString().trim() === departmentId.toString().trim()) {
      return { success: false, error: 'هذا القسم مضاف بالفعل لهذا الفرع' };
    }
  }
  return addRow('BranchDepartments', { branch_id: branchId, department_id: departmentId });
}

function removeBranchDepartment(branchDeptId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');
  try {
    var sheet = AppUtils.getDB().getSheetByName('BranchDepartments');
    if (!sheet) return { success: false, error: 'Sheet not found' };
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().trim() === branchDeptId.toString().trim()) {
        sheet.deleteRow(i + 1);
        AppUtils.invalidate('BranchDepartments');
        return { success: true };
      }
    }
    return { success: false, error: 'Not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Manager Department Scoping Functions ─────────────────────────────────────

/**
 * Returns all active department assignments for a specific manager
 */
function getManagerDepartments(managerId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canViewDashboard');

  var mds = AppUtils.sheetToObjects('ManagerDepartments');
  var depts = AppUtils.sheetToObjects('Departments');
  var branches = AppUtils.sheetToObjects('Branches');

  var deptMap = {};
  for (var di = 0; di < depts.length; di++) {
    deptMap[(depts[di]['department_id'] || '').toString().trim()] = (depts[di]['department_name'] || '').toString();
  }
  var branchMap = {};
  for (var bi = 0; bi < branches.length; bi++) {
    branchMap[(branches[bi]['branch_id'] || '').toString().trim()] = (branches[bi]['branch_name'] || '').toString();
  }

  var targetMgrId = (managerId || '').toString().trim();
  var result = [];
  for (var i = 0; i < mds.length; i++) {
    var r = mds[i];
    var status = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (status !== 'active' && status !== '') continue;

    if ((r['manager_id'] || '').toString().trim() === targetMgrId) {
      var dId = (r['department_id'] || '').toString().trim();
      var bId = (r['branch_id'] || '').toString().trim();
      result.push({
        mgrDeptId:      (r['mgr_dept_id'] || '').toString().trim(),
        managerId:      targetMgrId,
        departmentId:   dId,
        departmentName: deptMap[dId] || dId,
        branchId:       bId,
        branchName:     branchMap[bId] || bId,
        status:         'Active'
      });
    }
  }
  return result;
}

/**
 * Add a department assignment to a manager in a specific branch
 */
function addManagerDepartment(managerId, departmentId, branchId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var mId = (managerId || '').toString().trim();
  var dId = (departmentId || '').toString().trim();
  var bId = (branchId || '').toString().trim();

  if (!mId || !dId || !bId) {
    return { success: false, error: 'جميع الحقول مطلوبة (المدير، القسم، الفرع)' };
  }

  var mds = AppUtils.sheetToObjects('ManagerDepartments');
  for (var i = 0; i < mds.length; i++) {
    var r = mds[i];
    var status = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (status !== 'active' && status !== '') continue;

    if ((r['manager_id'] || '').toString().trim() === mId &&
        (r['department_id'] || '').toString().trim() === dId &&
        (r['branch_id'] || '').toString().trim() === bId) {
      return { success: false, error: 'هذا القسم مضاف بالفعل لهذا المدير في هذا الفرع' };
    }
  }

  return addRow('ManagerDepartments', {
    manager_id: mId,
    department_id: dId,
    branch_id: bId,
    status: 'Active'
  });
}

/**
 * Remove a department assignment from a manager
 * Supports deletion by mgrDeptId or by triple combination (managerId, departmentId, branchId)
 */
function removeManagerDepartment(mgrDeptId, managerId, departmentId, branchId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (mgrDeptId || '').toString().trim();
  var mId = (managerId || '').toString().trim();
  var dId = (departmentId || '').toString().trim();
  var bId = (branchId || '').toString().trim();

  if (!targetId && (!mId || !dId)) {
    return { success: false, error: 'معرف الربط غير محدد' };
  }

  try {
    var sheet = AppUtils.getDB().getSheetByName('ManagerDepartments');
    if (!sheet) return { success: false, error: 'Sheet ManagerDepartments not found' };

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, error: 'لا توجد بيانات مسجلة في جدول التعيينات' };
    }

    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('mgr_dept_id');
    var mgrIdx = headers.indexOf('manager_id');
    var deptIdx = headers.indexOf('department_id');
    var branchIdx = headers.indexOf('branch_id');

    var deletedCount = 0;
    // Iterate backwards so deleting rows does not shift row indices of unprocessed rows
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      var rowId = idIdx !== -1 ? (row[idIdx] || '').toString().trim() : (row[0] || '').toString().trim();
      var rowMgr = mgrIdx !== -1 ? (row[mgrIdx] || '').toString().trim() : '';
      var rowDept = deptIdx !== -1 ? (row[deptIdx] || '').toString().trim() : '';
      var rowBranch = branchIdx !== -1 ? (row[branchIdx] || '').toString().trim() : '';

      var matched = false;
      if (targetId && rowId && rowId === targetId) {
        matched = true;
      } else if (mId && dId && rowMgr === mId && rowDept === dId) {
        if (!bId || branchIdx === -1 || !rowBranch || rowBranch === bId) {
          matched = true;
        }
      }

      if (matched) {
        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      AppUtils.invalidate('ManagerDepartments');
      AppUtils.writeLog(callerEmail, 'REMOVE_MGR_DEPT', 'ManagerDepartments', 'Removed: ' + (targetId || (mId + '-' + dId)), 'SUCCESS');
      return { success: true };
    }

    return { success: false, error: 'الربط غير موجود' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Returns teachers filtered by the logged-in manager's assigned departments and branches.
 * Super Admins see ALL teachers.
 */
function getTeachersForCurrentManager(optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canEvaluate');

  var userRole = (_resolveRole(callerEmail.toLowerCase().trim()) || '').toUpperCase();
  var isSuperAdmin = (userRole === 'ADMIN' || userRole === 'ROLE_SUPER_ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'مدير النظام');

  var allTeachers = getTeachers();
  if (isSuperAdmin) {
    return allTeachers;
  }

  // Find manager ID
  var mgrRows = AppUtils.sheetToObjects('Managers');
  var currentMgrId = '';
  for (var mi = 0; mi < mgrRows.length; mi++) {
    var mEmail = (mgrRows[mi]['email'] || '').toString().toLowerCase().trim();
    var mst = (mgrRows[mi]['status'] || 'Active').toString().trim().toLowerCase();
    if (mEmail === callerEmail.toLowerCase().trim() && (mst === 'active' || mst === '')) {
      currentMgrId = (mgrRows[mi]['manager_id'] || '').toString().trim();
      break;
    }
  }

  if (!currentMgrId) {
    return [];
  }

  // Get active manager assignments
  var mdRows = AppUtils.sheetToObjects('ManagerDepartments');
  var allowedKeys = {}; // "deptId|branchId"
  var hasAnyAssignment = false;
  for (var i = 0; i < mdRows.length; i++) {
    var r = mdRows[i];
    var status = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (status !== 'active' && status !== '') continue;

    if ((r['manager_id'] || '').toString().trim() === currentMgrId) {
      var dId = (r['department_id'] || '').toString().trim();
      var bId = (r['branch_id'] || '').toString().trim();
      allowedKeys[dId + '|' + bId] = true;
      hasAnyAssignment = true;
    }
  }

  if (!hasAnyAssignment) {
    return [];
  }

  // Filter teachers by matching department_id and branch_id
  var empRows = AppUtils.sheetToObjects('Employees');
  var empMap = {};
  for (var ei = 0; ei < empRows.length; ei++) {
    var e = empRows[ei];
    var eId = (e['employee_id'] || '').toString().trim();
    var dId = (e['department_id'] || '').toString().trim();
    var bId = (e['branch_id'] || '').toString().trim();
    empMap[eId] = { deptId: dId, branchId: bId };
  }

  return allTeachers.filter(function(t) {
    var empInfo = empMap[t.id];
    var did = (empInfo && empInfo.deptId) || t.deptId;
    var bid = (empInfo && empInfo.branchId) || t.branchId;
    var key = did + '|' + bid;
    return !!allowedKeys[key];
  });
}

/**
 * Returns complete cascading data for the Classroom Observation form:
 * - branches: directly from the 'Branches' sheet
 * - departments: directly from the 'Departments' sheet
 * - branchDeptMap: mapping from 'BranchDepartments' sheet
 * - teachers: teachers accessible to current manager (scoped by permissions)
 */
function getEvaluationFormData(optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canEvaluate');

  // 1. Branches directly from the Branches sheet
  var branchRows = getActiveRows('Branches');
  var branches = branchRows.map(function(b) {
    var bId = (b['branch_id'] || '').toString().trim();
    var bName = (b['branch_name'] || b['name'] || '').toString().trim();
    if (!bId) bId = bName;
    return {
      id: bId,
      name: bName
    };
  }).filter(function(b) {
    return b.name !== '';
  });

  // 2. Departments directly from the Departments sheet
  var deptRows = getActiveRows('Departments');
  var depts = deptRows.map(function(d) {
    var dId = (d['department_id'] || '').toString().trim();
    var dName = (d['department_name'] || d['name'] || '').toString().trim();
    if (!dId) dId = dName;
    return {
      id: dId,
      name: dName
    };
  }).filter(function(d) {
    return d.name !== '';
  });

  // 3. BranchDepartments mapping
  var bdRows = getActiveRows('BranchDepartments');
  var branchDeptMap = {};
  for (var i = 0; i < bdRows.length; i++) {
    var bId = (bdRows[i]['branch_id'] || '').toString().trim();
    var dId = (bdRows[i]['department_id'] || '').toString().trim();
    if (bId && dId) {
      if (!branchDeptMap[bId]) branchDeptMap[bId] = {};
      branchDeptMap[bId][dId] = true;
    }
  }

  // 4. Teachers for current manager
  var teachers = getTeachersForCurrentManager();

  return {
    branches: branches,
    departments: depts,
    branchDeptMap: branchDeptMap,
    teachers: teachers
  };
}

/**
 * Returns all managers with their department assignments & scoped teacher count (for Admin UI)
 */
function getManagersWithDepartments(optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var managers = AppUtils.sheetToObjects('Managers');
  var mds = AppUtils.sheetToObjects('ManagerDepartments');
  var depts = AppUtils.sheetToObjects('Departments');
  var branches = AppUtils.sheetToObjects('Branches');
  var employees = AppUtils.sheetToObjects('Employees');

  var deptMap = {};
  for (var di = 0; di < depts.length; di++) {
    deptMap[(depts[di]['department_id'] || '').toString().trim()] = (depts[di]['department_name'] || '').toString();
  }
  var branchMap = {};
  for (var bi = 0; bi < branches.length; bi++) {
    branchMap[(branches[bi]['branch_id'] || '').toString().trim()] = (branches[bi]['branch_name'] || '').toString();
  }

  // Active employees mapping
  var activeEmployees = [];
  for (var ei = 0; ei < employees.length; ei++) {
    var emp = employees[ei];
    var est = (emp['status'] || 'Active').toString().trim().toLowerCase();
    if (est === 'active' || est === '') {
      activeEmployees.push({
        id: (emp['employee_id'] || '').toString().trim(),
        deptId: (emp['department_id'] || '').toString().trim(),
        branchId: (emp['branch_id'] || '').toString().trim()
      });
    }
  }

  // Group assignments by manager_id
  var assignByMgr = {};
  for (var i = 0; i < mds.length; i++) {
    var r = mds[i];
    var st = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (st !== 'active' && st !== '') continue;

    var mId = (r['manager_id'] || '').toString().trim();
    var dId = (r['department_id'] || '').toString().trim();
    var bId = (r['branch_id'] || '').toString().trim();

    if (!assignByMgr[mId]) assignByMgr[mId] = [];
    assignByMgr[mId].push({
      mgrDeptId:      (r['mgr_dept_id'] || '').toString().trim(),
      departmentId:   dId,
      departmentName: deptMap[dId] || dId,
      branchId:       bId,
      branchName:     branchMap[bId] || bId
    });
  }

  var result = [];
  for (var m = 0; m < managers.length; m++) {
    var mgr = managers[m];
    var mst = (mgr['status'] || 'Active').toString().trim().toLowerCase();
    if (mst !== 'active' && mst !== '') continue;

    var mgrId = (mgr['manager_id'] || '').toString().trim();
    var assignments = assignByMgr[mgrId] || [];

    // Calculate scoped teachers
    var scopedTeacherSet = {};
    for (var a = 0; a < assignments.length; a++) {
      var asgn = assignments[a];
      for (var e = 0; e < activeEmployees.length; e++) {
        var emp = activeEmployees[e];
        if (emp.deptId === asgn.departmentId && emp.branchId === asgn.branchId) {
          scopedTeacherSet[emp.id] = true;
        }
      }
    }

    result.push({
      managerId:          mgrId,
      name:               (mgr['name'] || '').toString().trim(),
      email:              (mgr['email'] || '').toString().trim(),
      role:               (mgr['role'] || 'مدير').toString().trim(),
      assignments:        assignments,
      scopedTeacherCount: Object.keys(scopedTeacherSet).length
    });
  }

  return result;
}

/**
 * Returns all active teachers with department and branch assignment details
 */
function getAllTeachersForAssignment(optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var employees = AppUtils.sheetToObjects('Employees');
  var depts = AppUtils.sheetToObjects('Departments');
  var branches = AppUtils.sheetToObjects('Branches');

  var deptMap = {};
  for (var di = 0; di < depts.length; di++) {
    deptMap[(depts[di]['department_id'] || '').toString().trim()] = (depts[di]['department_name'] || '').toString();
  }
  var branchMap = {};
  for (var bi = 0; bi < branches.length; bi++) {
    branchMap[(branches[bi]['branch_id'] || '').toString().trim()] = (branches[bi]['branch_name'] || '').toString();
  }

  var result = [];
  for (var i = 0; i < employees.length; i++) {
    var r = employees[i];
    var status = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (status !== 'active' && status !== '') continue;

    var empId = (r['employee_id'] || '').toString().trim();
    var dId = (r['department_id'] || '').toString().trim();
    var bId = (r['branch_id'] || '').toString().trim();

    result.push({
      id: empId,
      name: (r['name'] || '').toString().trim(),
      email: (r['email'] || '').toString().trim(),
      position: (r['position'] || '').toString().trim(),
      departmentId: dId,
      departmentName: deptMap[dId] || '',
      branchId: bId,
      branchName: branchMap[bId] || (r['school_branch'] || '').toString().trim()
    });
  }

  // Sort by teacher name
  result.sort(function(a, b) {
    return a.name.localeCompare(b.name, 'ar');
  });

  return result;
}

/**
 * Updates a single teacher's department and branch assignment
 */
function updateTeacherDepartmentBranch(employeeId, departmentId, branchId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (employeeId || '').toString().trim();
  var dId = (departmentId || '').toString().trim();
  var bId = (branchId || '').toString().trim();

  if (!targetId) return { success: false, error: 'معرف المعلم مطلوب' };

  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet) return { success: false, error: 'صفحة المعلمين Employees غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('employee_id');
    var deptIdx = headers.indexOf('department_id');
    var branchIdx = headers.indexOf('branch_id');
    var schoolBranchIdx = headers.indexOf('school_branch');

    if (idIdx === -1 || deptIdx === -1) {
      return { success: false, error: 'أعمدة المعلم غير موجودة في الشيت' };
    }

    var branchName = '';
    if (bId && schoolBranchIdx !== -1) {
      var branches = AppUtils.sheetToObjects('Branches');
      for (var bi = 0; bi < branches.length; bi++) {
        if ((branches[bi]['branch_id'] || '').toString().trim() === bId) {
          branchName = (branches[bi]['branch_name'] || '').toString().trim();
          break;
        }
      }
    }

    for (var i = 1; i < data.length; i++) {
      if ((data[i][idIdx] || '').toString().trim() === targetId) {
        var rowNum = i + 1;
        sheet.getRange(rowNum, deptIdx + 1).setValue(dId);
        if (branchIdx !== -1) sheet.getRange(rowNum, branchIdx + 1).setValue(bId);
        if (schoolBranchIdx !== -1) sheet.getRange(rowNum, schoolBranchIdx + 1).setValue(branchName);

        AppUtils.invalidate('Employees');
        AppUtils.writeLog(callerEmail, 'UPDATE_TEACHER_ASSIGN', 'Employees', 'Emp:' + targetId + ' Dept:' + dId + ' Brn:' + bId, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'لم يتم العثور على المعلم' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Batch update multiple teachers' department and branch assignments
 */
function batchUpdateTeacherAssignments(assignments, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  if (!assignments || !assignments.length) return { success: false, error: 'لا توجد بيانات للتحديث' };

  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet) return { success: false, error: 'صفحة المعلمين Employees غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('employee_id');
    var deptIdx = headers.indexOf('department_id');
    var branchIdx = headers.indexOf('branch_id');
    var schoolBranchIdx = headers.indexOf('school_branch');

    var branches = AppUtils.sheetToObjects('Branches');
    var branchMap = {};
    for (var bi = 0; bi < branches.length; bi++) {
      branchMap[(branches[bi]['branch_id'] || '').toString().trim()] = (branches[bi]['branch_name'] || '').toString().trim();
    }

    var asgnMap = {};
    assignments.forEach(function(a) {
      if (a && a.employeeId) asgnMap[a.employeeId.toString().trim()] = a;
    });

    var updatedCount = 0;
    for (var i = 1; i < data.length; i++) {
      var empId = (data[i][idIdx] || '').toString().trim();
      var asgn = asgnMap[empId];
      if (asgn) {
        var rowNum = i + 1;
        var dId = (asgn.departmentId || '').toString().trim();
        var bId = (asgn.branchId || '').toString().trim();
        sheet.getRange(rowNum, deptIdx + 1).setValue(dId);
        if (branchIdx !== -1) sheet.getRange(rowNum, branchIdx + 1).setValue(bId);
        if (schoolBranchIdx !== -1 && bId && branchMap[bId]) {
          sheet.getRange(rowNum, schoolBranchIdx + 1).setValue(branchMap[bId]);
        }
        updatedCount++;
      }
    }

    AppUtils.invalidate('Employees');
    AppUtils.writeLog(callerEmail, 'BATCH_UPDATE_TEACHERS', 'Employees', 'Updated ' + updatedCount + ' teachers', 'SUCCESS');
    return { success: true, count: updatedCount };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getAllQuestionsWithWeights(optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');
  return AppUtils.sheetToObjects('Questions');
}

function updateQuestionWeight(questionId, newWeight, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');
  try {
    var sheet = AppUtils.getDB().getSheetByName('Questions');
    if (!sheet) return { success: false, error: 'Sheet not found' };
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){return h.toString().trim();});
    var weightIdx = headers.indexOf('weight');
    if (weightIdx === -1) return { success: false, error: 'Weight column not found' };
    for (var i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().trim() === questionId.toString().trim()) {
        sheet.getRange(i + 1, weightIdx + 1).setValue(parseFloat(newWeight));
        AppUtils.invalidate('Questions');
        AppUtils.writeLog(callerEmail, 'UPDATE_WEIGHT', 'Questions', 'Q:' + questionId + ' → ' + newWeight, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'Question not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateCategoryWeight(category, newWeight, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');
  try {
    var sheet = AppUtils.getDB().getSheetByName('Questions');
    if (!sheet) return { success: false, error: 'Sheet not found' };
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){return h.toString().trim();});
    var catIdx = headers.indexOf('category');
    var weightIdx = headers.indexOf('weight');
    if (catIdx === -1 || weightIdx === -1) return { success: false, error: 'Required columns not found' };
    var count = 0;
    for (var i = 1; i < data.length; i++) {
      if ((data[i][catIdx] || '').toString().trim() === category.toString().trim()) {
        sheet.getRange(i + 1, weightIdx + 1).setValue(parseFloat(newWeight));
        count++;
      }
    }
    AppUtils.invalidate('Questions');
    AppUtils.writeLog(callerEmail, 'UPDATE_CATEGORY_WEIGHT', 'Questions', 'Cat:' + category + ' → ' + newWeight + ' (' + count + ' questions)', 'SUCCESS');
    return { success: true, count: count };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function deleteQuestion(questionId, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');
  try {
    var sheet = AppUtils.getDB().getSheetByName('Questions');
    if (!sheet) return { success: false, error: 'Sheet not found' };
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().trim() === questionId.toString().trim()) {
        sheet.deleteRow(i + 1);
        AppUtils.invalidate('Questions');
        AppUtils.writeLog(callerEmail, 'DELETE_QUESTION', 'Questions', 'Q:' + questionId, 'SUCCESS');
        return { success: true };
      }
    }
    return { success: false, error: 'السؤال غير موجود' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function addManager(p, optionalToken) {
  try {
    var callerEmail = _extractCallerEmail(optionalToken, p);
    PermissionGuard.require(callerEmail, 'canManageSystem');

    var name = (p.name || '').toString().trim();
    var email = (p.email || '').toString().toLowerCase().trim();
    var roleInput = (p.role || 'مدير').toString().trim();

    var norm = _normalizeRole(roleInput);
    var role = norm === 'ADMIN' ? 'مدير النظام' : (norm === 'MANAGER' ? 'مدير' : 'معلم');

    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Managers');
    if (!sheet) return { success: false, error: 'الصفحة غير موجودة: Managers' };

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      var res = addRow('Managers', { name: name, email: email, role: role });
      _profileCache = {};
      return res;
    }

    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('manager_id');
    var emailIdx = headers.indexOf('email');
    var nameIdx = headers.indexOf('name');
    var roleIdx = headers.indexOf('role');
    var statusIdx = headers.indexOf('status');

    var foundRowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      var rowEmail = (data[i][emailIdx] || '').toString().toLowerCase().trim();
      if (rowEmail === email) {
        foundRowIndex = i + 1; // 1-based row index in sheet
        break;
      }
    }

    if (foundRowIndex > 0) {
      if (nameIdx !== -1 && name) sheet.getRange(foundRowIndex, nameIdx + 1).setValue(name);
      if (roleIdx !== -1) sheet.getRange(foundRowIndex, roleIdx + 1).setValue(role);
      if (statusIdx !== -1) sheet.getRange(foundRowIndex, statusIdx + 1).setValue('Active');

      if (idIdx !== -1) {
        var currentId = (data[foundRowIndex - 1][idIdx] || '').toString().trim();
        if (!currentId) {
          sheet.getRange(foundRowIndex, idIdx + 1).setValue(AppUtils.generateId('mgr'));
        }
      }

      AppUtils.invalidate('Managers');
      _profileCache = {};
      AppUtils.writeLog(callerEmail, 'UPDATE_MANAGER', 'Managers', 'Manager updated: ' + email + ' (' + role + ')', 'SUCCESS');
      return { success: true, updated: true };
    } else {
      var res = addRow('Managers', {
        name: name,
        email: email,
        role: role
      });
      _profileCache = {};
      return res;
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Seed Questions (run once from Apps Script editor) ──────────────────────
function setupQuestionsData() {
  var ss = AppUtils.getDB();
  var sheet = ss.getSheetByName('Questions');
  if (!sheet) {
    sheet = ss.insertSheet('Questions');
    sheet.appendRow(['question_id', 'category', 'question_text', 'weight', 'status', 'created_at']);
    sheet.getRange(1, 1, 1, 6).setBackground('#212121');
    sheet.getRange(1, 1, 1, 6).setFontColor('#FFFFFF');
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    sheet.getRange(1, 1, 1, 6).setFontSize(10);
    sheet.setFrozenRows(1);
  }

  var existing = sheet.getDataRange().getValues();
  var existingIds = {};
  for (var i = 1; i < existing.length; i++) {
    if (existing[i][0]) existingIds[existing[i][0].toString().trim()] = true;
  }

  var questions = [

    // ── 1. المعلومات الأساسية (no rating — context only) ──
    { cat: 'المعلومات الأساسية', text: 'الاسم', weight: 0 },
    { cat: 'المعلومات الأساسية', text: 'تخصص المعلم', weight: 0 },
    { cat: 'المعلومات الأساسية', text: 'المدرسة', weight: 0 },
    { cat: 'المعلومات الأساسية', text: 'الصف', weight: 0 },
    { cat: 'المعلومات الأساسية', text: 'الفصل', weight: 0 },
    { cat: 'المعلومات الأساسية', text: 'تخصص الفصل', weight: 0 },
    { cat: 'المعلومات الأساسية', text: 'الفصل الدراسي', weight: 0 },

    // ── 2. التخطيط للدرس (7 questions, weight 2.0) ──
    { cat: 'التخطيط للدرس', text: 'مستند خطة الدرس مكتمل ( يذكر عناصر خطة الدرس )', weight: 2 },
    { cat: 'التخطيط للدرس', text: 'خطوات سير الدرس بالخطة تحقق الأهداف', weight: 2 },
    { cat: 'التخطيط للدرس', text: 'الاستراتيجيات التي تم اختيارها تتناسب مع الأنشطة المخططة للدرس', weight: 2 },
    { cat: 'التخطيط للدرس', text: 'يخطط للتقويم بأناليب متنوعة ومختلفة', weight: 2 },
    { cat: 'التخطيط للدرس', text: 'يختار الوسائل التعليمية المناسبة لتحقيق أهداف الدرس', weight: 2 },
    { cat: 'التخطيط للدرس', text: 'صياغة أهداف تعليمية جيدة ( يذكر مقومات الهدف الجيد )', weight: 2 },

    // ── 3. الإدارة الصفية (6 questions, weight 2.0) ──
    { cat: 'الإدارة الصفية', text: 'ينفذ المعلم جدولاً زمنياً واضحاً للدرس حسب الخطة', weight: 2 },
    { cat: 'الإدارة الصفية', text: 'وجود بيئة صفية منضبطة', weight: 2 },
    { cat: 'الإدارة الصفية', text: 'يدير المعلم استخدام الموارد التعليمية المتاحة بكفاءة وفاعلية', weight: 2 },
    { cat: 'الإدارة الصفية', text: 'يجيد المعلم التعامل مع الأنماط المختلفة للطلاب', weight: 2 },
    { cat: 'الإدارة الصفية', text: 'ترتيب جلوس الطلاب يتناسب مع الأنشطة المخططة', weight: 2 },
    { cat: 'الإدارة الصفية', text: 'يوفر المعلم بيئة تعلم يسودها الاحترام', weight: 2 },

    // ── 4. العرض والتقديم (16 questions, weight 3.0) ──
    { cat: 'العرض والتقديم', text: 'يعرض أهداف الدرس على السبورة', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يضع تهيئة ترتبط بموضوع الدرس', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يجذب انتباه التلاميذ من خلال إثارة الدافعية وبيان أهمية الدرس', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يحفز مشاركة التلاميذ في الدرس', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يعرض المعلم الدرس بسرعة مقبولة', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يتحدث بصوت مسموع وصياغة واضحة تناسب مستوى الطلاب', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يستخدم المعلم لغة الجسد بطريقة تخدم أهداف الدرس ( التواصل البصري - الحركة - ... )', weight: 3 },
    { cat: 'العرض والتقديم', text: 'ينصت المعلم بجدية واحترام لتعليقات الطلاب', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يعرض المعلومات بشكل متدرج ومترابط', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يستخدم المعلم استراتيجيات التدريس بطريقة صحيحة', weight: 3 },
    { cat: 'العرض والتقديم', text: 'لا يعتمد المعلم على أسلوب التلقين فقط في عرض الدرس', weight: 3 },
    { cat: 'العرض والتقديم', text: 'ينهي الدرس في الوقت المخطط له', weight: 3 },
    { cat: 'العرض والتقديم', text: 'ينفذ المعلم الأنشطة المخططة لإغلاق الدرس ( تلخيص وإغلاق الدرس )', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يكلف الطلاب بأنشطة إثرائية مرتبطة بموضوع الدرس', weight: 3 },
    { cat: 'العرض والتقديم', text: 'يكلف المعلم الطلاب بأنشطة إثرائية مرتبطة بالدرس القادم ( استراتيجية الفصل المقلوب )', weight: 3 },

    // ── 5. مصادر التعلم (3 questions, weight 2.0) ──
    { cat: 'مصادر التعلم', text: 'يستخدم المعلم مصادر تعلم تتناسب مع أنشطة الدرس', weight: 2 },
    { cat: 'مصادر التعلم', text: 'يستخدم المعلم مصادر تعلم متنوعة', weight: 2 },
    { cat: 'مصادر التعلم', text: 'يشجع المعلم الطلاب للبحث عن مصادر متنوعة للتعلم', weight: 2 },

    // ── 6. تكنولوجيا التعليم (5 questions, weight 2.0) ──
    { cat: 'تكنولوجيا التعليم', text: 'يراعي المعلم معايير تصميم الوسائل التعليمية ( عرض تقديمي - ... )', weight: 2 },
    { cat: 'تكنولوجيا التعليم', text: 'يستخدم الوسيلة التعليمية بشكل صحيح', weight: 2 },
    { cat: 'تكنولوجيا التعليم', text: 'يستخدم الوسيلة التعليمية في الوقت المناسب', weight: 2 },
    { cat: 'تكنولوجيا التعليم', text: 'يستخدم إمكانيات الوسيلة التعليمية بما يتناسب مع تحقيق الأهداف', weight: 2 },
    { cat: 'تكنولوجيا التعليم', text: 'يستخدم وسائل تعليمية متنوعة تناسب مختلف أنماط المتعلمين', weight: 2 },

    // ── 7. التقويم (8 questions, weight 3.0) ──
    { cat: 'التقويم', text: 'يطرح المعلم أسئلة واضحة الصياغة', weight: 3 },
    { cat: 'التقويم', text: 'يطرح المعلم أسئلة تراعي مهارات التفكير المختلفة', weight: 3 },
    { cat: 'التقويم', text: 'يراعي المعلم التعدد في أنواع الأسئلة المطروحة', weight: 3 },
    { cat: 'التقويم', text: 'يعزز المعلم طرح المزيد من الأسئلة', weight: 3 },
    { cat: 'التقويم', text: 'يعيد المعلم طرح الأسئلة الغامضة على الطلاب مرة أخرى', weight: 3 },
    { cat: 'التقويم', text: 'يستخدم التقويم في تقسيم الطلاب ( مجموعات المستوى )', weight: 3 },
    { cat: 'التقويم', text: 'يقدم المعلم تغذية راجعة', weight: 3 },
    { cat: 'التقويم', text: 'بيئة تقييم داعمة وتفاعلية تشجع مشاركة الطلاب', weight: 3 }
  ];

  var count = 0;
  var now = new Date();
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var qId = 'q-' + String(i + 1).padStart(3, '0');
    if (existingIds[qId]) continue;
    sheet.appendRow([qId, q.cat, q.text, q.weight, 'Active', now]);
    count++;
  }

  AppUtils.invalidate('Questions');
  return 'تم إضافة ' + count + ' سؤال بنجاح. الإجمالي: ' + questions.length;
}