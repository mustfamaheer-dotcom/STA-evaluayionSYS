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
  if (tableName === 'Branches') {
    return getBranches();
  }
  return getActiveRows(tableName);
}

// Write aliases
function addNewDepartmentRow(p, optionalToken) { return addDepartment(p, optionalToken); }
function addNewClassRow(p, optionalToken) {
  return addClass({
    name: p.name,
    grade: p.grade,
    branchId: p.branch_id || p.branchId,
    branch: p.branch || p.school_branch || p.branch_name,
    departmentId: p.department_id || p.departmentId
  }, optionalToken);
}
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
      var hName = headers[j];
      if (obj[hName] !== undefined && (val === '' || val === null || val === undefined)) {
        continue;
      }
      obj[hName] = (val instanceof Date)
        ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
        : (val === null || val === undefined ? '' : val);
    }

    // Special resilience for Employees sheet (TID shifted column / duplicate created_at)
    if (tableName === 'Employees') {
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

    var statusVal = (obj['status'] || '').toString().trim();
    if (AppUtils.isStatusActive(statusVal)) {
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
    if (dName) {
      deptNameToId[dName.toLowerCase()] = dId;
      var normD = AppUtils.normalizeDept(dName);
      if (normD) deptNameToId[normD.toLowerCase()] = dId;
    }
  }
  var branchMap = {};
  var branchNameToId = {};
  for (var bi = 0; bi < branches.length; bi++) {
    var bId = (branches[bi]['branch_id'] || '').toString().trim();
    var bName = (branches[bi]['branch_name'] || '').toString().trim();
    branchMap[bId] = bName;
    if (bName) {
      branchNameToId[bName.toLowerCase()] = bId;
      var normB = AppUtils.normalizeSchool(bName);
      if (normB) branchNameToId[normB.toLowerCase()] = bId;
    }
  }

  // Known standard branch mappings as fallback
  var standardBranchNameToId = {
    'sta-1': 'brn-9lq1z',
    'sta-2': 'brn-rx0g2',
    'sta3 - el-sadat': 'brn-8hb7q',
    'zohr - portsaid': 'brn-7si8d',
    'new-damietta': 'brn-7ha75',
    'new el-alamein': 'brn-6si5d',
    'ain-sokhna school': 'brn-pp8e6',
    "coc's - belbeis": 'brn-579f9',
    "coc's - maghagha": 'brn-3xhyn',
    'm8-gets': 'brn-31t71',
    'shubra hospitality school': 'brn-d5gj5'
  };
  for (var sKey in standardBranchNameToId) {
    if (!branchNameToId[sKey]) branchNameToId[sKey] = standardBranchNameToId[sKey];
    if (!branchMap[standardBranchNameToId[sKey]]) branchMap[standardBranchNameToId[sKey]] = AppUtils.normalizeSchool(sKey);
  }

  // Pre-mapped standard department IDs by keyword / position
  var positionToDeptId = {
    'arabic': 'dept-d5mia', 'عرب': 'dept-d5mia',
    'english': 'dept-qhl8h', 'إنجل': 'dept-qhl8h', 'انجل': 'dept-qhl8h',
    'math': 'dept-nimz2', 'رياض': 'dept-nimz2',
    'mechanical': 'dept-lvyhm', 'ميكانيك': 'dept-lvyhm',
    'electrical': 'dept-wdqjy', 'كهرب': 'dept-wdqjy',
    'chemistry': 'dept-lm5to', 'كيم': 'dept-lm5to', 'science': 'dept-lm5to', 'علوم': 'dept-lm5to',
    'computer': 'dept-dv50x', 'حاسب': 'dept-dv50x', 'كمبيوتر': 'dept-dv50x',
    'italian': 'dept-x8qgn', 'إيطال': 'dept-x8qgn', 'ايطال': 'dept-x8qgn',
    'german': 'dept-l24cb', 'ألمان': 'dept-l24cb', 'المان': 'dept-l24cb',
    'automotive': 'dept-601dj', 'سيار': 'dept-601dj',
    'f&b': 'dept-00y8p', 'فندق': 'dept-00y8p',
    'logistics': 'dept-tks3u', 'sales': 'dept-tks3u', 'لوجست': 'dept-tks3u', 'مبيع': 'dept-tks3u',
    'electronic': 'dept-fh7ms', 'إلكترون': 'dept-fh7ms', 'الكترون': 'dept-fh7ms',
    'pe': 'dept-x2qzh', 'بدني': 'dept-x2qzh',
    'social': 'dept-5uwce', 'اجتماع': 'dept-5uwce',
    'development': 'dept-ktxyo', 'تطوير': 'dept-ktxyo', 'تنمية': 'dept-ktxyo',
    'printing': 'dept-lsctr', 'طباع': 'dept-lsctr',
    'ict': 'dept-4dgth', 'تكنولوج': 'dept-4dgth',
    'medical': 'dept-ecqby', 'صحي': 'dept-ecqby',
    'constriction': 'dept-4sxhd', 'تشييد': 'dept-4sxhd', 'بناء': 'dept-4sxhd'
  };

  return rows.map(function(r) {
    var did       = (r['department_id']  || '').toString().trim();
    var bid       = (r['branch_id']      || '').toString().trim();
    var schoolTxt = (r['school_branch']  || '').toString().trim();
    var pos       = (r['position']       || '').toString().trim();

    // ── Resolve branchId: must be a real brn-xxx ID ──────────────────────
    var resolvedBid = '';
    if (bid && bid.indexOf('brn-') === 0) {
      resolvedBid = bid;
    } else if (bid && branchNameToId[bid.toLowerCase()]) {
      resolvedBid = branchNameToId[bid.toLowerCase()];
    } else if (bid) {
      var normB = AppUtils.normalizeSchool(bid);
      if (normB && branchNameToId[normB.toLowerCase()]) resolvedBid = branchNameToId[normB.toLowerCase()];
    }

    if (!resolvedBid && schoolTxt) {
      var normSchool = AppUtils.normalizeSchool(schoolTxt);
      if (branchNameToId[schoolTxt.toLowerCase()]) {
        resolvedBid = branchNameToId[schoolTxt.toLowerCase()];
      } else if (normSchool && branchNameToId[normSchool.toLowerCase()]) {
        resolvedBid = branchNameToId[normSchool.toLowerCase()];
      }
    }

    // ── Resolve deptId: must be a real dept-xxx ID ───────────────────────
    var resolvedDid = '';
    if (did && did.indexOf('dept-') === 0) {
      resolvedDid = did;
    } else if (did && deptNameToId[did.toLowerCase()]) {
      resolvedDid = deptNameToId[did.toLowerCase()];
    } else if (did) {
      var normD = AppUtils.normalizeDept(did);
      if (normD && deptNameToId[normD.toLowerCase()]) resolvedDid = deptNameToId[normD.toLowerCase()];
    }

    if (!resolvedDid && pos) {
      var posLower = pos.toLowerCase();
      for (var pKey in positionToDeptId) {
        if (posLower.indexOf(pKey) !== -1) {
          resolvedDid = positionToDeptId[pKey];
          break;
        }
      }
    }

    // ── Resolved display names ────────────────────────────────────────────
    var bName = (resolvedBid && branchMap[resolvedBid]) || (schoolTxt ? AppUtils.normalizeSchool(schoolTxt) : '') || schoolTxt || '';
    var dName = (resolvedDid && deptMap[resolvedDid]) || (pos ? AppUtils.normalizeDept(pos) : '') || pos || '';

    return {
      id:       (r['employee_id'] || '').toString(),
      name:     (r['name']        || '').toString(),
      spec:     pos || dName,
      school:   bName,
      dept:     dName,
      branchId: resolvedBid,
      deptId:   resolvedDid,
      tid:      (r['tid'] || r['TID'] || '').toString()
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
    var targetBranch = (branchId || '').toString().trim();

    var branches = getBranches();
    var branchMap = {};
    for (var bi = 0; bi < branches.length; bi++) {
      var bid = (branches[bi]['branch_id'] || '').toString().trim();
      var bname = (branches[bi]['branch_name'] || '').toString().trim();
      if (bid) branchMap[bid] = bname;
      if (bname) branchMap[bname.toLowerCase()] = bid;
    }
    var targetBranchName = (branchMap[targetBranch] || targetBranch).toLowerCase();

    var specs = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r['grade'] || '').toString().trim() !== targetGrade) continue;

      var cBranchId = (r['branch_id'] || '').toString().trim();
      var cSchool = (r['school_branch'] || r['branch_name'] || '').toString().trim();
      var deptId = (r['department_id'] || '').toString().trim();

      if (targetBranch) {
        if (cBranchId || cSchool) {
          var matchesBranch = (cBranchId === targetBranch) ||
                              (cSchool.toLowerCase() === targetBranchName) ||
                              (branchMap[cBranchId] && branchMap[cBranchId].toLowerCase() === targetBranchName);
          if (!matchesBranch) continue;
        } else if (deptId && allowedDepts && allowedDepts.indexOf(deptId) < 0) {
          continue;
        }
      }

      var specName = deptMap[deptId] || deptId;
      if (specName) {
        specs[specName] = true;
      } else {
        specs['عام'] = true;
      }
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
  var targetBranch = (branchId || '').toString().trim();

  var branches = getBranches();
  var branchMap = {};
  for (var bi = 0; bi < branches.length; bi++) {
    var bid = (branches[bi]['branch_id'] || '').toString().trim();
    var bname = (branches[bi]['branch_name'] || '').toString().trim();
    if (bid) branchMap[bid] = bname;
    if (bname) branchMap[bname.toLowerCase()] = bid;
  }
  var targetBranchName = (branchMap[targetBranch] || targetBranch).toLowerCase();

  return rows
    .filter(function(r) {
      if (targetGrade && (r['grade'] || '').toString().trim() !== targetGrade) return false;

      var cBranchId = (r['branch_id'] || '').toString().trim();
      var cSchool = (r['school_branch'] || r['branch_name'] || '').toString().trim();
      var deptId = (r['department_id'] || '').toString().trim();

      if (targetBranch) {
        if (cBranchId || cSchool) {
          var matchesBranch = (cBranchId === targetBranch) ||
                              (cSchool.toLowerCase() === targetBranchName) ||
                              (branchMap[cBranchId] && branchMap[cBranchId].toLowerCase() === targetBranchName);
          if (!matchesBranch) return false;
        } else if (deptId && allowedDepts && allowedDepts.indexOf(deptId) < 0) {
          return false;
        }
      }

      if (spec) {
        var specTrim = spec.toString().trim();
        var specName = deptMap[deptId] || deptId;
        if (specTrim === 'عام' || specTrim === '—') {
          if (specName && specName !== 'عام' && specName !== '—') return false;
        } else {
          if (specName !== specTrim) return false;
        }
      }
      return true;
    })
    .map(function(r) {
      var deptId = (r['department_id'] || '').toString().trim();
      var cBranchId = (r['branch_id'] || '').toString().trim();
      var bName = (r['school_branch'] || r['branch_name'] || branchMap[cBranchId] || '').toString().trim();
      return {
        id:          (r['class_id']      || '').toString(),
        name:        (r['class_name']    || '').toString(),
        spec:        deptMap[deptId] || deptId || 'عام',
        branchId:    cBranchId,
        branchName:  bName
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
    var callerEmail = _extractCallerEmail(optionalToken, payload && (payload.authToken || payload.callerEmail || payload.userEmail));
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
function ensureClassHeaders() {
  try {
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Classes');
    if (!sheet) return;
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h.toString().trim(); });
    
    var needed = ['branch_id', 'school_branch', 'grade'];
    for (var k = 0; k < needed.length; k++) {
      var colName = needed[k];
      if (headers.indexOf(colName) === -1) {
        lastCol++;
        sheet.getRange(1, lastCol).setValue(colName);
        sheet.getRange(1, lastCol).setBackground('#212121');
        sheet.getRange(1, lastCol).setFontColor('#FFFFFF');
        sheet.getRange(1, lastCol).setFontWeight('bold');
        headers.push(colName);
      }
    }
  } catch (e) {
    console.error('ensureClassHeaders error: ' + e);
  }
}

function addClass(p, optionalToken) {
  var bId = (p.branchId || p.branch_id || '').toString().trim();
  var bName = (p.branch || p.school_branch || p.branch_name || '').toString().trim();
  if (bId && !bName) {
    var branches = getBranches();
    for (var i = 0; i < branches.length; i++) {
      if ((branches[i]['branch_id'] || '').toString().trim() === bId) {
        bName = (branches[i]['branch_name'] || '').toString().trim();
        break;
      }
    }
  } else if (bName && !bId) {
    var branches = getBranches();
    for (var i = 0; i < branches.length; i++) {
      if ((branches[i]['branch_name'] || '').toString().trim().toLowerCase() === bName.toLowerCase()) {
        bId = (branches[i]['branch_id'] || '').toString().trim();
        break;
      }
    }
  }

  ensureClassHeaders();

  var row = {
    class_name: p.name,
    grade: p.grade
  };
  if (bId) row.branch_id = bId;
  if (bName) row.school_branch = bName;
  if (p.departmentId || p.department_id) row.department_id = p.departmentId || p.department_id;

  return addRow('Classes', row, optionalToken);
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

function getBranches(optionalToken) {
  try {
    var rows = getActiveRows('Branches');
    if (rows && rows.length > 0) return rows;
  } catch (e) {
    console.error('getBranches error: ' + e);
  }

  // Fallback: extract distinct active branches from Employees sheet
  try {
    var emps = getActiveRows('Employees');
    var seen = {};
    var fallback = [];
    for (var i = 0; i < emps.length; i++) {
      var bName = (emps[i]['school_branch'] || '').toString().trim();
      var bId = (emps[i]['branch_id'] || '').toString().trim() || bName;
      if (bName && !seen[bName.toLowerCase()]) {
        seen[bName.toLowerCase()] = true;
        fallback.push({
          branch_id: bId,
          branch_name: bName,
          status: 'Active'
        });
      }
    }
    if (fallback.length > 0) return fallback;
  } catch (e2) {
    console.error('Fallback getBranches error: ' + e2);
  }
  return [];
}

function addNewBranchRow(p, optionalToken) {
  return addRow('Branches', { branch_name: p.name }, optionalToken);
}

/**
 * Returns all active classes with resolved branch and department names for management
 */
function getClassesWithDetails() {
  ensureClassHeaders();
  var rows = getActiveRows('Classes');
  var branches = getBranches();
  var branchMap = {};
  for (var bi = 0; bi < branches.length; bi++) {
    var bid = (branches[bi]['branch_id'] || '').toString().trim();
    var bname = (branches[bi]['branch_name'] || '').toString().trim();
    if (bid) branchMap[bid] = bname;
  }

  var depts = getActiveRows('Departments');
  var deptMap = {};
  for (var di = 0; di < depts.length; di++) {
    deptMap[(depts[di]['department_id'] || '').toString().trim()] = (depts[di]['department_name'] || '').toString();
  }

  return rows.map(function (r) {
    var bId = (r['branch_id'] || '').toString().trim();
    var bName = (r['school_branch'] || r['branch_name'] || '').toString().trim();
    if (!bName && bId && branchMap[bId]) {
      bName = branchMap[bId];
    }
    var dId = (r['department_id'] || '').toString().trim();

    return {
      class_id: (r['class_id'] || '').toString().trim(),
      class_name: (r['class_name'] || '').toString().trim(),
      branch_id: bId,
      branch_name: bName,
      school_branch: bName,
      department_id: dId,
      department_name: deptMap[dId] || '',
      grade: (r['grade'] || '').toString().trim(),
      status: (r['status'] || 'Active').toString().trim()
    };
  });
}

/**
 * Updates a class's name, branch, department, or grade
 */
function updateClass(classId, p, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken, p);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var targetId = (classId || '').toString().trim();
  if (!targetId) return { success: false, error: 'معرف الفصل مطلوب' };

  try {
    ensureClassHeaders();
    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Classes');
    if (!sheet) return { success: false, error: 'صفحة Classes غير موجودة' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().trim(); });
    var idIdx = headers.indexOf('class_id');
    var nameIdx = headers.indexOf('class_name');
    var deptIdx = headers.indexOf('department_id');
    var branchIdx = headers.indexOf('branch_id');
    var schoolBranchIdx = headers.indexOf('school_branch');
    var gradeIdx = headers.indexOf('grade');
    var statusIdx = headers.indexOf('status');

    if (idIdx === -1) return { success: false, error: 'عمود class_id غير موجود' };

    var bId = (p.branch_id !== undefined ? p.branch_id : p.branchId);
    var bName = (p.branch !== undefined ? p.branch : (p.school_branch !== undefined ? p.school_branch : p.branch_name));
    if (bId && !bName) {
      var branches = getBranches();
      for (var bi = 0; bi < branches.length; bi++) {
        if ((branches[bi]['branch_id'] || '').toString().trim() === bId.toString().trim()) {
          bName = (branches[bi]['branch_name'] || '').toString().trim();
          break;
        }
      }
    }

    for (var i = 1; i < data.length; i++) {
      if ((data[i][idIdx] || '').toString().trim() === targetId) {
        var rowNum = i + 1;
        if (p.name !== undefined && nameIdx !== -1) sheet.getRange(rowNum, nameIdx + 1).setValue(p.name);
        if (p.grade !== undefined && gradeIdx !== -1) sheet.getRange(rowNum, gradeIdx + 1).setValue(p.grade);
        if (bId !== undefined && branchIdx !== -1) sheet.getRange(rowNum, branchIdx + 1).setValue(bId);
        if (bName !== undefined && schoolBranchIdx !== -1) sheet.getRange(rowNum, schoolBranchIdx + 1).setValue(bName);
        if (p.department_id !== undefined && deptIdx !== -1) sheet.getRange(rowNum, deptIdx + 1).setValue(p.department_id);
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
  return addRow('BranchDepartments', { branch_id: branchId, department_id: departmentId }, optionalToken || callerEmail);
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

  if (!mId || !dId) {
    return { success: false, error: 'المدير والقسم مطلوبان' };
  }

  // Find manager role
  var mgrRows = AppUtils.sheetToObjects('Managers');
  var mRole = '';
  for (var mi = 0; mi < mgrRows.length; mi++) {
    if ((mgrRows[mi]['manager_id'] || '').toString().trim() === mId) {
      mRole = (mgrRows[mi]['role'] || '').toString().trim();
      break;
    }
  }

  var isBranchMgr = (_normalizeRole(mRole) === 'BRANCH_MANAGER');
  if (isBranchMgr && (!bId || bId === 'all')) {
    return { success: false, error: 'تحديد الفرع مطلوب لمدير الفرع' };
  }
  if (!isBranchMgr && bId === 'all') {
    bId = '';
  }

  var mds = AppUtils.sheetToObjects('ManagerDepartments');
  for (var i = 0; i < mds.length; i++) {
    var r = mds[i];
    var status = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (status !== 'active' && status !== '') continue;

    if ((r['manager_id'] || '').toString().trim() === mId &&
        (r['department_id'] || '').toString().trim() === dId &&
        (r['branch_id'] || '').toString().trim() === bId) {
      return { success: false, error: 'هذا التعيين مضاف بالفعل لهذا المدير' };
    }
  }

  return addRow('ManagerDepartments', {
    manager_id: mId,
    department_id: dId,
    branch_id: bId,
    status: 'Active'
  }, optionalToken || callerEmail);
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
 * Fallbacks safely so managers are never blocked from evaluating.
 */
function getTeachersForCurrentManager(optionalToken, optionalEmail) {
  var callerEmail = _extractCallerEmail(optionalToken, optionalEmail);
  var allTeachers = getTeachers();
  if (!callerEmail) return allTeachers;

  var userRole = (_resolveRole(callerEmail.toLowerCase().trim()) || '').toUpperCase();
  var isSuperAdmin = (userRole === 'ADMIN' || userRole === 'ROLE_SUPER_ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'مدير النظام');

  try {
    var p = _buildProfile(callerEmail);
    if (p && p.permissions && p.permissions.indexOf('canManageSystem') !== -1) {
      isSuperAdmin = true;
    }
  } catch(eProf) {}

  if (isSuperAdmin) {
    return allTeachers;
  }

  // Find manager ID and role
  var mgrRows = AppUtils.sheetToObjects('Managers');
  var currentMgrId = '';
  var currentMgrRole = '';
  for (var mi = 0; mi < mgrRows.length; mi++) {
    var mEmail = (mgrRows[mi]['email'] || '').toString().toLowerCase().trim();
    var mst = (mgrRows[mi]['status'] || 'Active').toString().trim().toLowerCase();
    if (_emailsMatch(mEmail, callerEmail) && (mst === 'active' || mst === '')) {
      currentMgrId = (mgrRows[mi]['manager_id'] || '').toString().trim();
      currentMgrRole = (mgrRows[mi]['role'] || '').toString().trim();
      break;
    }
  }

  // If not found in Managers sheet, allow evaluating all teachers
  if (!currentMgrId) {
    return allTeachers;
  }

  var normRole = _normalizeRole(currentMgrRole || userRole);
  var isBranchMgr = (normRole === 'BRANCH_MANAGER');
  var isDeptMgr   = (normRole === 'MANAGER');

  // Get active manager assignments
  var mdRows = AppUtils.sheetToObjects('ManagerDepartments');
  var allowedKeys = {}; // "deptId|branchId"
  var allowedDepts = {}; // deptId -> true (all branches)
  var allowedBranches = {}; // branchId -> true (all depts)
  var hasAnyAssignment = false;

  for (var i = 0; i < mdRows.length; i++) {
    var r = mdRows[i];
    var status = (r['status'] || 'Active').toString().trim().toLowerCase();
    if (status !== 'active' && status !== '') continue;

    if ((r['manager_id'] || '').toString().trim() === currentMgrId) {
      var dId = (r['department_id'] || '').toString().trim();
      var bId = (r['branch_id'] || '').toString().trim();
      hasAnyAssignment = true;

      var isAllBranches = (!bId || bId.toLowerCase() === 'all' || bId === 'جميع الفروع');

      if (isDeptMgr && isAllBranches) {
        // "مدير" (Department Manager with ALL branches): can evaluate employees in this department in ANY branch
        if (dId) allowedDepts[dId] = true;
      } else if (isBranchMgr || !isAllBranches) {
        // Specific branch assignment: strictly restricted to this branch and department
        if (dId && bId) {
          allowedKeys[dId + '|' + bId] = true;
        } else if (!dId && bId) {
          allowedBranches[bId] = true;
        } else if (dId && !bId) {
          allowedDepts[dId] = true;
        }
      } else {
        if (dId && bId) {
          allowedKeys[dId + '|' + bId] = true;
        } else if (dId && !bId) {
          allowedDepts[dId] = true;
        } else if (!dId && bId) {
          allowedBranches[bId] = true;
        }
      }
    }
  }

  // If manager has no specific restrictions in ManagerDepartments, allow all teachers
  if (!hasAnyAssignment) {
    return allTeachers;
  }

  // Filter teachers by matching assignments
  var filtered = allTeachers.filter(function(t) {
    var did = t.deptId;
    var bid = t.branchId;

    if (allowedKeys[did + '|' + bid]) return true;
    if (allowedKeys[t.dept + '|' + t.school]) return true;
    if (allowedKeys[did + '|' + t.school]) return true;
    if (allowedKeys[t.dept + '|' + bid]) return true;

    for (var k in allowedKeys) {
      var parts = k.split('|');
      var kDept = parts[0];
      var kBranch = parts[1];
      var dMatch = (did === kDept || t.dept === kDept || AppUtils.normalizeDept(t.dept) === AppUtils.normalizeDept(kDept) || AppUtils.normalizeDept(t.spec) === AppUtils.normalizeDept(kDept));
      var bMatch = (bid === kBranch || t.school === kBranch || AppUtils.normalizeSchool(t.school) === AppUtils.normalizeSchool(kBranch));
      if (dMatch && bMatch) return true;
    }

    if (allowedDepts[did] || allowedDepts[t.dept] || 
        Object.keys(allowedDepts).some(function(ad) { return AppUtils.normalizeDept(t.dept) === AppUtils.normalizeDept(ad); })) {
      return true;
    }

    if (allowedBranches[bid] || allowedBranches[t.school] ||
        Object.keys(allowedBranches).some(function(ab) { return AppUtils.normalizeSchool(t.school) === AppUtils.normalizeSchool(ab); })) {
      return true;
    }

    return false;
  });

  return (filtered && filtered.length > 0) ? filtered : [];
}

/**
 * Returns complete cascading data for the Classroom Observation form:
 * - branches: directly from the 'Branches' sheet
 * - departments: directly from the 'Departments' sheet
 * - branchDeptMap: mapping from 'BranchDepartments' sheet + teacher assignments
 * - teachers: teachers accessible to current manager (scoped by permissions)
 */
function getEvaluationFormData(optionalToken, optionalEmail) {
  var callerEmail = _extractCallerEmail(optionalToken, optionalEmail);
  if (callerEmail) {
    try {
      PermissionGuard.require(callerEmail, 'canEvaluate');
    } catch (permErr) {
      try {
        var p = _buildProfile(callerEmail);
        if (!p.permissions.includes('canEvaluate') && !p.permissions.includes('canViewDashboard')) {
          throw permErr;
        }
      } catch(eCheck) {
        throw permErr;
      }
    }
  }

  // 1. Branches directly from the Branches sheet (with fallback)
  var branches = [];
  try {
    var branchRows = getBranches(optionalToken);
    branches = (branchRows || []).map(function(b) {
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
  } catch (errB) {
    console.error('Error fetching branches in getEvaluationFormData: ' + errB);
  }

  // 2. Departments directly from the Departments sheet
  var depts = [];
  try {
    var deptRows = getActiveRows('Departments');
    depts = (deptRows || []).map(function(d) {
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
  } catch (errD) {
    console.error('Error fetching departments in getEvaluationFormData: ' + errD);
  }

  // 3. Teachers for current manager (scoped by permissions)
  var teachers = [];
  try {
    teachers = getTeachersForCurrentManager(callerEmail || optionalToken, optionalEmail);
  } catch (errT) {
    console.error('getTeachersForCurrentManager error: ' + errT);
  }
  if (!teachers || teachers.length === 0) {
    try {
      teachers = getTeachers();
    } catch(errT2) {
      console.error('getTeachers error: ' + errT2);
    }
  }

  // If branches sheet was empty, derive branches from teachers
  if (!branches || branches.length === 0) {
    var seenB = {};
    for (var ti = 0; ti < (teachers || []).length; ti++) {
      var tb = teachers[ti].branchId || teachers[ti].school;
      var tbn = teachers[ti].school || teachers[ti].branchId;
      if (tb && !seenB[tb]) {
        seenB[tb] = true;
        branches.push({ id: tb, name: tbn });
      }
    }
  }

  // If departments sheet was empty, derive departments from teachers
  if (!depts || depts.length === 0) {
    var seenD = {};
    for (var td = 0; td < (teachers || []).length; td++) {
      var did = teachers[td].deptId || teachers[td].dept;
      var dname = teachers[td].dept || teachers[td].deptId;
      if (did && !seenD[did]) {
        seenD[did] = true;
        depts.push({ id: did, name: dname });
      }
    }
  }

  // 4. BranchDepartments mapping (from sheet + from teacher assignments)
  var branchDeptMap = {};
  try {
    var bdRows = getActiveRows('BranchDepartments');
    for (var i = 0; i < bdRows.length; i++) {
      var bId = (bdRows[i]['branch_id'] || '').toString().trim();
      var dId = (bdRows[i]['department_id'] || '').toString().trim();
      if (bId && dId) {
        if (!branchDeptMap[bId]) branchDeptMap[bId] = {};
        branchDeptMap[bId][dId] = true;
      }
    }
  } catch (errBd) {
    console.error('Error fetching branchDeptMap in getEvaluationFormData: ' + errBd);
  }

  // Dynamically ensure branchDeptMap contains all departments present in teachers for each branch
  for (var k = 0; k < (teachers || []).length; k++) {
    var curT = teachers[k];
    var curB = curT.branchId;
    var curD = curT.deptId;
    if (curB && curD) {
      if (!branchDeptMap[curB]) branchDeptMap[curB] = {};
      branchDeptMap[curB][curD] = true;
    }
  }

  // 5. Identify Manager and Manager Assignments
  var mgrRows = AppUtils.sheetToObjects('Managers');
  var currentMgrId = '';
  var currentMgrRole = '';
  for (var mi = 0; mi < mgrRows.length; mi++) {
    var mEmail = (mgrRows[mi]['email'] || mgrRows[mi]['Email'] || mgrRows[mi]['البريد'] || '').toString().toLowerCase().trim();
    var mst = (mgrRows[mi]['status'] || mgrRows[mi]['Status'] || mgrRows[mi]['الحالة'] || 'Active').toString().trim().toLowerCase();
    if (_emailsMatch(mEmail, callerEmail) && (mst === 'active' || mst === '')) {
      currentMgrId = (mgrRows[mi]['manager_id'] || mgrRows[mi]['Manager_ID'] || mgrRows[mi]['id'] || '').toString().trim();
      currentMgrRole = (mgrRows[mi]['role'] || mgrRows[mi]['Role'] || mgrRows[mi]['الدور'] || '').toString().trim();
      break;
    }
  }

  var uRole = (_resolveRole(callerEmail ? callerEmail.toLowerCase().trim() : '') || '').toUpperCase();
  var normRole = _normalizeRole(currentMgrRole || uRole);
  var isSuperAdminUser = (normRole === 'ADMIN');
  var isBranchManager = (normRole === 'BRANCH_MANAGER');
  var isDeptManager = (normRole === 'MANAGER');

  try {
    var prof = _buildProfile(callerEmail);
    if (prof && prof.permissions && prof.permissions.indexOf('canManageSystem') !== -1) {
      isSuperAdminUser = true;
    }
  } catch(eP) {}

  var mdRows = AppUtils.sheetToObjects('ManagerDepartments');
  var assignedBranchMap = {};
  var assignedDeptMap = {};
  var assignedBranchList = [];
  var assignedDeptList = [];

  if (currentMgrId) {
    for (var mdi = 0; mdi < mdRows.length; mdi++) {
      var mdr = mdRows[mdi];
      var mdSt = (mdr['status'] || mdr['Status'] || 'Active').toString().trim().toLowerCase();
      if (mdSt !== 'active' && mdSt !== '') continue;

      var rMgrId = (mdr['manager_id'] || mdr['Manager_ID'] || '').toString().trim();
      if (rMgrId === currentMgrId) {
        var dIdVal = (mdr['department_id'] || mdr['Department_ID'] || '').toString().trim();
        var bIdVal = (mdr['branch_id'] || mdr['Branch_ID'] || '').toString().trim();

        if (bIdVal && !assignedBranchMap[bIdVal]) {
          assignedBranchMap[bIdVal] = true;
          assignedBranchList.push(bIdVal);
        }
        if (dIdVal && !assignedDeptMap[dIdVal]) {
          assignedDeptMap[dIdVal] = true;
          assignedDeptList.push(dIdVal);
        }
      }
    }
  }

  // 6. Filter branches and departments for scoped managers
  var hasSpecificBranchOnly = assignedBranchList.length > 0 && assignedBranchList.every(function(b){
    var bStr = b.toString().toLowerCase().trim();
    return bStr && bStr !== 'all' && bStr !== 'جميع الفروع';
  });
  if (isBranchManager || hasSpecificBranchOnly) {
    isBranchManager = true;
    if (assignedBranchList.length > 0) {
      var bmBranches = branches.filter(function(b) {
        return assignedBranchMap[b.id] || assignedBranchMap[b.name] ||
               assignedBranchList.some(function(ab) {
                 return b.id === ab || b.name === ab || AppUtils.normalizeSchool(b.name) === AppUtils.normalizeSchool(ab);
               });
      });
      if (bmBranches.length > 0) branches = bmBranches;
    }
    if (assignedDeptList.length > 0) {
      var bmDepts = depts.filter(function(d) {
        return assignedDeptMap[d.id] || assignedDeptMap[d.name] ||
               assignedDeptList.some(function(ad) {
                 return d.id === ad || d.name === ad || AppUtils.normalizeDept(d.name) === AppUtils.normalizeDept(ad);
               });
      });
      if (bmDepts.length > 0) depts = bmDepts;
    }
  } else if (!isSuperAdminUser && teachers && teachers.length > 0) {
    var validBranchMap = {};
    for (var vti = 0; vti < teachers.length; vti++) {
      if (teachers[vti].branchId) validBranchMap[teachers[vti].branchId] = true;
      if (teachers[vti].school) validBranchMap[teachers[vti].school.toLowerCase()] = true;
    }
    if (branches && branches.length > 0) {
      var mgrBranches = branches.filter(function(b) {
        return validBranchMap[b.id] || validBranchMap[b.name.toLowerCase()];
      });
      if (mgrBranches.length > 0) branches = mgrBranches;
    }
    if (assignedDeptList.length > 0) {
      var mgrDepts = depts.filter(function(d) {
        return assignedDeptMap[d.id] || assignedDeptMap[d.name] ||
               assignedDeptList.some(function(ad) {
                 return d.id === ad || d.name === ad || AppUtils.normalizeDept(d.name) === AppUtils.normalizeDept(ad);
               });
      });
      if (mgrDepts.length > 0) depts = mgrDepts;
    }
  }

  // 7. Resolve defaultBranchId and defaultDeptId
  var defaultBranchId = '';
  if (assignedBranchList.length > 0) {
    for (var abi = 0; abi < assignedBranchList.length; abi++) {
      var abId = assignedBranchList[abi];
      var matchB = branches.find(function(b){
        return b.id === abId || b.name.toLowerCase() === abId.toLowerCase() || AppUtils.normalizeSchool(b.name) === AppUtils.normalizeSchool(abId);
      });
      if (matchB) {
        defaultBranchId = matchB.id;
        break;
      }
    }
    if (!defaultBranchId && branches.length > 0) {
      defaultBranchId = branches[0].id;
    }
  } else if (!isSuperAdminUser && branches.length === 1) {
    defaultBranchId = branches[0].id;
  }

  if (!defaultBranchId && !isSuperAdminUser && teachers && teachers.length > 0) {
    var teacherBranches = {};
    for (var tbi = 0; tbi < teachers.length; tbi++) {
      if (teachers[tbi].branchId) teacherBranches[teachers[tbi].branchId] = true;
    }
    var tbKeys = Object.keys(teacherBranches);
    if (tbKeys.length === 1) {
      defaultBranchId = tbKeys[0];
    } else if (branches.length === 1) {
      defaultBranchId = branches[0].id;
    }
  }

  var defaultDeptId = '';
  if (assignedDeptList.length > 0) {
    for (var adi = 0; adi < assignedDeptList.length; adi++) {
      var adId = assignedDeptList[adi];
      var matchD = depts.find(function(d){
        return d.id === adId || d.name.toLowerCase() === adId.toLowerCase() || AppUtils.normalizeDept(d.name) === AppUtils.normalizeDept(adId);
      });
      if (matchD) {
        defaultDeptId = matchD.id;
        break;
      }
    }
    if (!defaultDeptId && depts.length > 0) {
      defaultDeptId = depts[0].id;
    }
  } else if (!isSuperAdminUser && depts.length === 1) {
    defaultDeptId = depts[0].id;
  }

  if (!defaultDeptId && !isSuperAdminUser && teachers && teachers.length > 0) {
    var teacherDepts = {};
    for (var tdi = 0; tdi < teachers.length; tdi++) {
      if (teachers[tdi].deptId) teacherDepts[teachers[tdi].deptId] = true;
    }
    var tdKeys = Object.keys(teacherDepts);
    if (tdKeys.length === 1) {
      defaultDeptId = tdKeys[0];
    } else if (depts.length === 1) {
      defaultDeptId = depts[0].id;
    }
  }

  return {
    branches: branches,
    departments: depts,
    branchDeptMap: branchDeptMap,
    teachers: teachers || [],
    defaultBranchId: defaultBranchId,
    defaultDeptId: defaultDeptId,
    managerRole: normRole,
    isBranchManager: isBranchManager
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
    if (AppUtils.isStatusActive(emp['status'])) {
      activeEmployees.push({
        id: (emp['employee_id'] || '').toString().trim(),
        deptId: (emp['department_id'] || '').toString().trim(),
        branchId: (emp['branch_id'] || '').toString().trim(),
        school: (emp['school_branch'] || '').toString().trim(),
        position: (emp['position'] || '').toString().trim()
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
    var rawRole = (mgr['role'] || 'مدير').toString().trim();
    var mgrName = (mgr['name'] || '').toString().trim();
    var mgrRoleNorm = _normalizeRole(rawRole);

    // Auto-detect branch manager: if role is BRANCH_MANAGER, OR if name/role has "branch" or "فرع",
    // OR if all manager's assignments are for specific branch(es) (not 'all')
    var hasSpecificBranchOnly = assignments.length > 0 && assignments.every(function(asgn){
      var b = (asgn.branchId || '').toLowerCase().trim();
      return b && b !== 'all' && b !== 'جميع الفروع';
    });
    var isBranchMgr = (mgrRoleNorm === 'BRANCH_MANAGER') || 
                      (rawRole.toLowerCase().indexOf('branch') !== -1) ||
                      (mgrName.toLowerCase().indexOf('branch') !== -1) ||
                      hasSpecificBranchOnly;
    var isDeptMgr = !isBranchMgr && (mgrRoleNorm === 'MANAGER');

    for (var a = 0; a < assignments.length; a++) {
      var asgn = assignments[a];
      var asgnBranch = (asgn.branchId || '').toString().trim();
      var asgnBranchName = (asgn.branchName || branchMap[asgnBranch] || asgnBranch).toString().trim();
      var asgnDept = (asgn.departmentId || '').toString().trim();
      var asgnDeptName = (asgn.departmentName || deptMap[asgnDept] || asgnDept).toString().trim();
      var isAllBranches = (!asgnBranch || asgnBranch.toLowerCase() === 'all' || asgnBranch === 'جميع الفروع');

      for (var e = 0; e < activeEmployees.length; e++) {
        var emp = activeEmployees[e];
        var deptMatch = (!asgnDept) || (emp.deptId === asgnDept) ||
                        (emp.deptId && deptMap[emp.deptId] === asgnDeptName) ||
                        (emp.position && asgnDeptName && AppUtils.normalizeDept(emp.position) === AppUtils.normalizeDept(asgnDeptName));
        if (!deptMatch) continue;

        if (isAllBranches && !isBranchMgr) {
          // Department manager with ALL branches: any teacher in this department
          scopedTeacherSet[emp.id] = true;
        } else {
          // Specific branch assignment: teacher must be in this specific branch
          var branchMatch = (emp.branchId === asgnBranch) ||
                            (emp.school && asgnBranchName && AppUtils.normalizeSchool(emp.school) === AppUtils.normalizeSchool(asgnBranchName)) ||
                            (asgnBranch && emp.school && AppUtils.normalizeSchool(emp.school) === AppUtils.normalizeSchool(asgnBranch));
          if (branchMatch) {
            scopedTeacherSet[emp.id] = true;
          }
        }
      }
    }

    var displayRole = (mgrRoleNorm === 'ADMIN') ? 'مدير النظام' : (isBranchMgr ? (rawRole.indexOf('فرع') !== -1 ? 'مدير فرع' : 'سينيور') : 'مدير');
    result.push({
      managerId:          mgrId,
      name:               mgrName,
      email:              (mgr['email'] || '').toString().trim(),
      role:               displayRole,
      rawRole:            rawRole,
      isBranchManager:    isBranchMgr,
      assignments:        assignments,
      scopedTeacherCount: Object.keys(scopedTeacherSet).length
    });
  }

  return result;
}

/**
 * Updates a manager's role in the Managers sheet
 */
function updateManagerRole(managerId, newRole, optionalToken) {
  var callerEmail = _extractCallerEmail(optionalToken);
  PermissionGuard.require(callerEmail, 'canManageSystem');

  var mId = (managerId || '').toString().trim();
  if (!mId) return { success: false, error: 'معرف المدير مطلوب' };

  var norm = _normalizeRole(newRole);
  var roleLabel = norm === 'ADMIN' ? 'مدير النظام' : (norm === 'BRANCH_MANAGER' ? (newRole.toString().indexOf('فرع') !== -1 ? 'مدير فرع' : 'سينيور') : 'مدير');

  var ss = AppUtils.getDB();
  var sheet = ss.getSheetByName('Managers');
  if (!sheet) return { success: false, error: 'الصفحة غير موجودة: Managers' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var idIdx = headers.indexOf('manager_id');
  var roleIdx = headers.indexOf('role');

  if (idIdx === -1 || roleIdx === -1) return { success: false, error: 'أعمدة غير صحيحة' };

  for (var i = 1; i < data.length; i++) {
    if ((data[i][idIdx] || '').toString().trim() === mId) {
      sheet.getRange(i + 1, roleIdx + 1).setValue(roleLabel);
      AppUtils.invalidate('Managers');
      _profileCache = {};
      AppUtils.writeLog(callerEmail, 'UPDATE_MANAGER_ROLE', 'Managers', 'Manager ' + mId + ' role -> ' + roleLabel, 'SUCCESS');
      return { success: true, role: roleLabel };
    }
  }

  return { success: false, error: 'المدير غير موجود' };
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
    if (!AppUtils.isStatusActive(r['status'])) continue;

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
    var callerEmail = _extractCallerEmail(optionalToken, p && (p.authToken || p.callerEmail || p.userEmail));
    PermissionGuard.require(callerEmail, 'canManageSystem');

    var name = (p.name || '').toString().trim();
    var email = (p.email || '').toString().toLowerCase().trim();
    var roleInput = (p.role || 'مدير').toString().trim();

    var norm = _normalizeRole(roleInput);
    var role = norm === 'ADMIN' ? 'مدير النظام' : (norm === 'BRANCH_MANAGER' ? (roleInput.toString().indexOf('فرع') !== -1 ? 'مدير فرع' : 'سينيور') : (norm === 'MANAGER' ? 'مدير' : 'معلم'));

    var ss = AppUtils.getDB();
    var sheet = ss.getSheetByName('Managers');
    if (!sheet) return { success: false, error: 'الصفحة غير موجودة: Managers' };

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      var res = addRow('Managers', { name: name, email: email, role: role }, optionalToken || callerEmail);
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
      if (_emailsMatch(rowEmail, email)) {
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
      }, optionalToken || callerEmail);
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

/**
 * Normalizes headers and row data in Employees sheet if needed.
 * Fixes misaligned TID/status/created_at columns in Google Sheets.
 */
function fixEmployeesTableAlignment() {
  var ss = AppUtils.getDB();
  var sheet = ss.getSheetByName('Employees');
  if (!sheet) return 'Sheet Employees not found';

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'No data in Employees';

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h.toString().trim(); });
  
  var createdCount = 0;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === 'created_at') createdCount++;
  }

  var sample = sheet.getRange(2, 1, Math.min(10, lastRow - 1), lastCol).getValues();
  var col8HasNumbers = false;
  for (var r = 0; r < sample.length; r++) {
    var v8 = (sample[r][8] || '').toString().trim();
    if (/^\d+$/.test(v8)) { col8HasNumbers = true; break; }
  }

  if (createdCount > 1 || col8HasNumbers) {
    var newHeaders = ['employee_id', 'name', 'email', 'password', 'department_id', 'branch_id', 'school_branch', 'position', 'TID', 'status', 'created_at', 'updated_at'];
    if (sheet.getMaxColumns() < newHeaders.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), newHeaders.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

    var headerRange = sheet.getRange(1, 1, 1, newHeaders.length);
    headerRange.setBackground('#212121');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(10);

    AppUtils.invalidate('Employees');
    return 'Employees sheet headers successfully normalized with TID column.';
  }

  return 'Employees sheet headers already properly aligned.';
}