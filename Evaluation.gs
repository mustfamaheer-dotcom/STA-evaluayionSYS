// ============================================================
//  EVALUATION.GS  –  submit & query evaluation data
//
//  Evaluations sheet columns (exact order):
//    evaluation_id | manager_email | teacher_id | teacher_name | teacher_spec
//    school        | grade         | class_name | class_spec
//    semester      | avg_score     | notes      | submitted_at
//
//  EvaluationAnswers sheet columns (exact order):
//    answer_id | evaluation_id | question_id | rating | weight | weighted_score
// ============================================================

// ── Setup helper: call once from Apps Script editor to create headers ─────────
function setupSheetHeaders() {
  var ss = AppUtils.getDB();

  var evalHeaders = [
    'evaluation_id', 'manager_email', 'teacher_id', 'teacher_name', 'teacher_spec',
    'school', 'grade', 'class_name', 'class_spec',
    'semester', 'avg_score', 'notes', 'submitted_at'
  ];
  var ansHeaders = [
    'answer_id', 'evaluation_id', 'question_id', 'rating', 'weight', 'weighted_score'
  ];

  function ensureHeaders(sheetName, headers) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) { sheet = ss.insertSheet(sheetName); }
    var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var allMatch = headers.every(function (h, i) { return h === existing[i]; });
    if (!allMatch) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#212121');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);
    }
  }

  ensureHeaders('Evaluations',       evalHeaders);
  ensureHeaders('EvaluationAnswers', ansHeaders);
  ensureHeaders('Subjects',           ['subject_id', 'subject_name', 'grade', 'status', 'created_at']);
  ensureHeaders('Departments',         ['department_id', 'department_name', 'status', 'created_at']);
  ensureHeaders('Branches',            ['branch_id', 'branch_name', 'status', 'created_at']);
  ensureHeaders('BranchDepartments',   ['branch_dept_id', 'branch_id', 'department_id', 'status', 'created_at']);
  ensureHeaders('ManagerDepartments',  ['mgr_dept_id', 'manager_id', 'department_id', 'branch_id', 'status', 'created_at']);
  ensureHeaders('Employees',          ['employee_id', 'name', 'email', 'department_id', 'branch_id', 'school_branch', 'position', 'status', 'created_at']);
  ensureHeaders('Managers',           ['manager_id', 'name', 'email', 'role', 'status', 'created_at']);

  var clsSheet = ss.getSheetByName('Classes');
  if (clsSheet) {
    var lastCol = clsSheet.getLastColumn();
    var headers = lastCol > 0 ? clsSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return h.toString().trim(); }) : [];
    if (headers.indexOf('grade') === -1) {
      clsSheet.getRange(1, lastCol + 1).setValue('grade');
      clsSheet.getRange(1, lastCol + 1).setBackground('#212121');
      clsSheet.getRange(1, lastCol + 1).setFontColor('#FFFFFF');
      clsSheet.getRange(1, lastCol + 1).setFontWeight('bold');
    }
  }
  return 'Headers set successfully.';
}

// ── Active questions ──────────────────────────────────────────────────────────
function getActiveQuestions() {
  var rows = AppUtils.sheetToObjects('Questions');
  return rows
    .filter(function (r) {
      return (r['status'] || '').toString().trim().toLowerCase() === 'active';
    })
    .map(function (r) {
      return {
        id:       (r['question_id']   || '').toString(),
        category: (r['category']      || 'General').toString(),
        text:     (r['question_text'] || '').toString(),
        weight:   parseFloat(r['weight']) || 1.0
      };
    });
}

// ── Submit evaluation ─────────────────────────────────────────────────────────
function submitEvaluation(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var callerEmail = '';
    try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
    PermissionGuard.require(callerEmail, 'canEvaluate');

    // Verify Manager-Department-Branch assignment scoping (Super Admin bypasses)
    var userRole = (_resolveRole(callerEmail.toLowerCase().trim()) || '').toUpperCase();
    var isSuperAdmin = (userRole === 'ADMIN' || userRole === 'ROLE_SUPER_ADMIN' || userRole === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      var teacherId = (payload.teacherId || '').toString().trim();
      if (!teacherId) {
        throw new Error('لم يتم تحديد المعلم المراد تقييمه');
      }

      // Get teacher record from Employees sheet
      var empRows = AppUtils.sheetToObjects('Employees');
      var teacherRecord = null;
      for (var ti = 0; ti < empRows.length; ti++) {
        if ((empRows[ti]['employee_id'] || '').toString().trim() === teacherId) {
          teacherRecord = empRows[ti];
          break;
        }
      }

      if (!teacherRecord) {
        throw new Error('المعلم غير موجود في النظام');
      }

      var teacherDeptId = (teacherRecord['department_id'] || '').toString().trim();
      var teacherBranchId = (teacherRecord['branch_id'] || '').toString().trim();

      // Find current manager ID from Managers sheet
      var mgrRows = AppUtils.sheetToObjects('Managers');
      var currentMgrId = '';
      for (var mi = 0; mi < mgrRows.length; mi++) {
        var mEmail = (mgrRows[mi]['email'] || '').toString().toLowerCase().trim();
        if (mEmail === callerEmail.toLowerCase().trim()) {
          currentMgrId = (mgrRows[mi]['manager_id'] || '').toString().trim();
          break;
        }
      }

      if (!currentMgrId) {
        throw new Error('غير مصرح: لم يتم العثور على حساب مدير مسجل لهذا البريد');
      }

      // Check ManagerDepartments assignments
      var mdRows = AppUtils.sheetToObjects('ManagerDepartments');
      var hasPermission = false;
      for (var mdi = 0; mdi < mdRows.length; mdi++) {
        var md = mdRows[mdi];
        var st = (md['status'] || 'Active').toString().trim().toLowerCase();
        if (st !== 'active' && st !== '') continue;

        var mId = (md['manager_id'] || '').toString().trim();
        var dId = (md['department_id'] || '').toString().trim();
        var bId = (md['branch_id'] || '').toString().trim();

        if (mId === currentMgrId && dId === teacherDeptId && bId === teacherBranchId) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        throw new Error('غير مصرح: لا يمكنك تقييم هذا المعلم - ليس في قسمك');
      }
    }

    var ss        = AppUtils.getDB();
    var evalSheet = ss.getSheetByName('Evaluations');
    var ansSheet  = ss.getSheetByName('EvaluationAnswers');

    if (!evalSheet || !ansSheet) {
      throw new Error('لم يتم العثور على صفحات "التقييمات" أو "إجابات التقييم". قم بتشغيل setupSheetHeaders() أولاً.');
    }

    var totalWeightedScore = 0;
    var totalWeight        = 0;
    payload.responses.forEach(function (r) {
      var rating = parseInt(r.rating)   || 0;
      var weight = parseFloat(r.weight) || 1.0;
      totalWeightedScore += rating * weight;
      totalWeight        += weight;
    });
    var avgScore = totalWeight > 0
      ? (totalWeightedScore / totalWeight).toFixed(2)
      : '0.00';

    var evaluationId = AppUtils.generateId('eval');
    var now          = new Date();

    evalSheet.appendRow([
      evaluationId,                     // evaluation_id
      callerEmail,                      // manager_email
      payload.teacherId || '',          // teacher_id
      payload.teacherName || '',        // teacher_name
      payload.teacherSpec || '',        // teacher_spec
      payload.school || '',             // school
      payload.grade || '',              // grade
      payload.className || '',          // class_name
      payload.classSpec || '',          // class_spec
      payload.semester || '',           // semester
      avgScore,                         // avg_score
      payload.notes || '',              // notes
      now                               // submitted_at
    ]);

    AppUtils.invalidate('Evaluations');

    if (payload.responses.length > 0) {
      var answerRows = payload.responses.map(function (r) {
        var rating = parseInt(r.rating)   || 0;
        var weight = parseFloat(r.weight) || 1.0;
        return [
          AppUtils.generateId('ans'),
          evaluationId,
          r.questionId,
          rating,
          weight,
          (rating * weight).toFixed(2)
        ];
      });
      ansSheet.getRange(
        ansSheet.getLastRow() + 1, 1,
        answerRows.length, answerRows[0].length
      ).setValues(answerRows);
      AppUtils.invalidate('EvaluationAnswers');
    }

    AppUtils.writeLog(callerEmail, 'SUBMIT_EVAL', 'Evaluations', 'Created: ' + evaluationId, 'SUCCESS');
    return { success: true, evaluationId: evaluationId, avgScore: avgScore };

  } catch (err) {
    AppUtils.writeLog('', 'SUBMIT_EVAL_ERROR', 'Evaluations', err.toString(), 'ERROR');
    return { success: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────
function getDashboardStats(filters) {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  PermissionGuard.require(callerEmail, 'canViewDashboard');

  filters = filters || {};
  var filterManagerEmail = filters.filterManagerEmail || filters.managerEmail || null;
  var filterEmployeeId   = filters.filterEmployeeId   || filters.employeeId   || null;
  var filterMonth        = (filters.filterMonth        || filters.month        || '').toString().trim();
  if (filterMonth.toLowerCase() === 'all') filterMonth = '';

  var ARABIC_MONTH_NAMES = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  function extractMonthKey(val) {
    if (!val) return '';
    var d = null;
    if (val instanceof Date) {
      d = isNaN(val.getTime()) ? null : val;
    } else {
      var s = String(val).trim();
      if (!s) return '';
      d = new Date(s);
      if (isNaN(d.getTime())) {
        var parts = s.split(/[\/\-\.T\s]/);
        if (parts.length >= 3) {
          if (parts[0].length === 4) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          } else if (parts[2].length === 4) {
            d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          }
        }
      }
    }
    if (!d || isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    return y + '-' + m;
  }

  function formatMonthLabel(key) {
    if (!key || key.indexOf('-') === -1) return key;
    var parts = key.split('-');
    var y = parts[0];
    var mIdx = parseInt(parts[1], 10) - 1;
    var mName = (mIdx >= 0 && mIdx < 12) ? ARABIC_MONTH_NAMES[mIdx] : ('شهر ' + parts[1]);
    return mName + ' ' + y;
  }

  var evaluations = AppUtils.sheetToObjects('Evaluations');
  var questions    = AppUtils.sheetToObjects('Questions');
  var employees    = AppUtils.sheetToObjects('Employees');

  // Collect all available months across evaluations (for the dropdown)
  var monthCounts = {};
  for (var mvi = 0; mvi < evaluations.length; mvi++) {
    var mev = evaluations[mvi];
    var mmgr = (mev['manager_email'] || '').toString();
    if (filterManagerEmail && mmgr.toLowerCase() !== filterManagerEmail.toLowerCase()) continue;
    var mKey = extractMonthKey(mev['submitted_at']);
    if (mKey) {
      monthCounts[mKey] = (monthCounts[mKey] || 0) + 1;
    }
  }

  var availableMonths = [];
  var sortedMonthKeys = Object.keys(monthCounts).sort().reverse();
  for (var smi = 0; smi < sortedMonthKeys.length; smi++) {
    var mk = sortedMonthKeys[smi];
    availableMonths.push({
      key:   mk,
      label: formatMonthLabel(mk),
      count: monthCounts[mk]
    });
  }

  var semCounts    = {};
  var scoreBuckets = { excellent: 0, good: 0, average: 0, poor: 0 };
  var scoreSum     = 0;
  var scoreCount   = 0;
  var schoolScores  = {};
  var employeeScores = {};
  var deptScores    = {};
  var branchDeptScores = {};  // key: "branch|dept" → {sum, count}
  var empToBranch = {};
  for (var ei2 = 0; ei2 < employees.length; ei2++) {
    var eid2 = (employees[ei2]['employee_id'] || '').toString().trim();
    var bid2 = (employees[ei2]['branch_id'] || '').toString().trim();
    if (eid2) empToBranch[eid2] = bid2;
  }
  var branRows = AppUtils.sheetToObjects('Branches');
  var branchNameMap = {};
  for (var bri = 0; bri < branRows.length; bri++) {
    branchNameMap[(branRows[bri]['branch_id'] || '').toString().trim()] = (branRows[bri]['branch_name'] || '').toString();
  }

  for (var vi = 0; vi < evaluations.length; vi++) {
    var ev       = evaluations[vi];
    var mgrEmail = (ev['manager_email'] || '').toString();
    var empId    = (ev['teacher_id']    || '').toString();
    var empKey   = (ev['teacher_name']  || 'غير محدد').toString().trim();

    if (filterManagerEmail && mgrEmail.toLowerCase() !== filterManagerEmail.toLowerCase()) continue;
    if (filterEmployeeId   && empId               !== filterEmployeeId)                      continue;
    if (filterMonth && extractMonthKey(ev['submitted_at']) !== filterMonth)                  continue;

    var score   = parseFloat(ev['avg_score']);
    var school  = AppUtils.normalizeSchool((ev['school'] || '').toString()) || 'غير محدد';
    var empName = (ev['teacher_name']   || 'غير محدد').toString();
    var empSpec = (ev['teacher_spec']   || '').toString();

    if (!isNaN(score)) {
      scoreSum += score;
      scoreCount++;

      if      (score >= 4.5) scoreBuckets.excellent++;
      else if (score >= 3.5) scoreBuckets.good++;
      else if (score >= 2.5) scoreBuckets.average++;
      else                   scoreBuckets.poor++;

      if (!schoolScores[school]) schoolScores[school] = { sum: 0, count: 0 };
      schoolScores[school].sum   += score;
      schoolScores[school].count++;

      if (empKey) {
        if (!employeeScores[empKey]) employeeScores[empKey] = { employeeName: empName, specialty: empSpec, school: school, scores: [] };
        employeeScores[empKey].scores.push(score);
      }

      var deptName = (ev['class_spec'] || '').toString().trim();
      if (deptName) {
        if (!deptScores[deptName]) deptScores[deptName] = { sum: 0, count: 0 };
        deptScores[deptName].sum   += score;
        deptScores[deptName].count++;
      }

      var branchId = empToBranch[empId] || '';
      var branchName = AppUtils.normalizeSchool(branchNameMap[branchId] || school) || school;
      if (deptName && branchName) {
        var bdKey = branchName + '|' + deptName;
        if (!branchDeptScores[bdKey]) branchDeptScores[bdKey] = { branch: branchName, department: deptName, sum: 0, count: 0 };
        branchDeptScores[bdKey].sum   += score;
        branchDeptScores[bdKey].count++;
      }
    }

    var sem = (ev['semester'] || 'غير محدد').toString().trim();
    semCounts[sem] = (semCounts[sem] || 0) + 1;
  }

  var totalEvals = scoreCount;
  var overallAvg  = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(2) : '0.00';

  // Count unique teachers (respecting manager filter and month filter)
  var uniqT = {};
  for (var ut = 0; ut < evaluations.length; ut++) {
    if (filterManagerEmail && (evaluations[ut]['manager_email'] || '').toString().toLowerCase() !== filterManagerEmail.toLowerCase()) continue;
    if (filterEmployeeId   && (evaluations[ut]['teacher_id'] || '').toString() !== filterEmployeeId) continue;
    if (filterMonth && extractMonthKey(evaluations[ut]['submitted_at']) !== filterMonth) continue;
    var utId = (evaluations[ut]['teacher_id'] || '').toString().trim();
    if (utId) uniqT[utId] = true;
  }
  var totalTeachers = Object.keys(uniqT).length;

  var schoolAverages = [];
  var schoolKeys = Object.keys(schoolScores);
  for (var di = 0; di < schoolKeys.length; di++) {
    var dd = schoolScores[schoolKeys[di]];
    schoolAverages.push({ name: schoolKeys[di], avg: (dd.sum / dd.count).toFixed(2), count: dd.count });
  }
  schoolAverages.sort(function (a, b) { return parseFloat(b.avg) - parseFloat(a.avg); });

  var topPerformers = [];
  var empKeys = Object.keys(employeeScores);
  for (var ki = 0; ki < empKeys.length; ki++) {
    var ed = employeeScores[empKeys[ki]];
    var empAvg = ed.scores.reduce(function(s, v) { return s + v; }, 0) / ed.scores.length;
    topPerformers.push({
      employeeId:   empKeys[ki],
      employeeName: ed.employeeName,
      specialty:    ed.specialty,
      school:       ed.school,
      avgScore:     empAvg.toFixed(2),
      evalCount:    ed.scores.length
    });
  }
  topPerformers.sort(function(a, b) { return parseFloat(b.avgScore) - parseFloat(a.avgScore); });
  topPerformers = topPerformers.slice(0, 5);

  var departmentAverages = [];
  var deptKeys = Object.keys(deptScores);
  for (var di2 = 0; di2 < deptKeys.length; di2++) {
    var dd2 = deptScores[deptKeys[di2]];
    departmentAverages.push({ department: deptKeys[di2], avg: (dd2.sum / dd2.count).toFixed(2), count: dd2.count });
  }
  departmentAverages.sort(function(a, b) { return parseFloat(b.avg) - parseFloat(a.avg); });

  var semesterBreakdown = [];
  var semKeys = Object.keys(semCounts);
  for (var si = 0; si < semKeys.length; si++) {
    semesterBreakdown.push({ semester: semKeys[si], count: semCounts[semKeys[si]] });
  }

  var managersRows = AppUtils.sheetToObjects('Managers');
  var managerNameMap = {};
  for (var mi = 0; mi < managersRows.length; mi++) {
    var mEmail = (managersRows[mi]['email'] || '').toString().toLowerCase().trim();
    var mName  = (managersRows[mi]['name']  || '').toString();
    if (mEmail) managerNameMap[mEmail] = mName;
  }

  var answers = AppUtils.sheetToObjects('EvaluationAnswers');
  var evalIds  = {};
  for (var vi2 = 0; vi2 < evaluations.length; vi2++) {
    var evId = (evaluations[vi2]['evaluation_id'] || '').toString().trim();
    var mgrE = (evaluations[vi2]['manager_email'] || '').toString();
    var tId  = (evaluations[vi2]['teacher_id']    || '').toString();
    if (filterManagerEmail && mgrE.toLowerCase() !== filterManagerEmail.toLowerCase()) continue;
    if (filterEmployeeId   && tId               !== filterEmployeeId)                      continue;
    if (filterMonth && extractMonthKey(evaluations[vi2]['submitted_at']) !== filterMonth)  continue;
    evalIds[evId] = true;
  }
  var evalIdKeys = Object.keys(evalIds);

  var catScores = {};
  var catTotal  = {};
  var catCount  = {};
  var mgrCounts = {};
  for (var ai = 0; ai < answers.length; ai++) {
    var ans   = answers[ai];
    var eId   = (ans['evaluation_id'] || '').toString();
    var qId   = (ans['question_id']   || '').toString();
    var rat   = parseFloat(ans['rating']) || 0;
    var wt    = parseFloat(ans['weight']) || 1;
    if (!evalIds[eId]) continue;
    var qKey  = qId;
    var cat   = null;
    for (var qi = 0; qi < questions.length; qi++) {
      if ((questions[qi]['question_id'] || '').toString() === qKey) {
        cat = (questions[qi]['category'] || '—').toString();
        break;
      }
    }
    if (!cat) continue;
    if (!catScores[cat]) { catScores[cat] = 0; catTotal[cat] = 0; catCount[cat] = 0; }
    catScores[cat] += rat * wt;
    catTotal[cat]  += wt;
    catCount[cat]++;
  }
  var categoryAverages = [];
  var catKeys = Object.keys(catScores);
  for (var ci = 0; ci < catKeys.length; ci++) {
    var cname = catKeys[ci];
    var cavg  = catTotal[cname] > 0 ? (catScores[cname] / catTotal[cname]).toFixed(2) : '0.00';
    categoryAverages.push({ category: cname, avg: cavg, count: catCount[cname] });
  }
  categoryAverages.sort(function(a, b) { return parseFloat(b.avg) - parseFloat(a.avg); });

  var branchDeptAverages = [];
  var bdKeys = Object.keys(branchDeptScores);
  for (var bdi = 0; bdi < bdKeys.length; bdi++) {
    var bd = branchDeptScores[bdKeys[bdi]];
    branchDeptAverages.push({
      branch:     bd.branch,
      department: bd.department,
      avg:        bd.count > 0 ? (bd.sum / bd.count).toFixed(2) : '0.00',
      count:      bd.count
    });
  }
  branchDeptAverages.sort(function(a, b) { return a.branch.localeCompare(b.branch) || parseFloat(b.avg) - parseFloat(a.avg); });

  var allEvals = AppUtils.sheetToObjects('Evaluations');
  for (var vi3 = 0; vi3 < allEvals.length; vi3++) {
    var ev3       = allEvals[vi3];
    var mgrEmail3 = (ev3['manager_email'] || '').toString().toLowerCase().trim();
    if (filterManagerEmail && mgrEmail3 !== filterManagerEmail.toLowerCase()) continue;
    if (filterEmployeeId   && (ev3['teacher_id'] || '').toString() !== filterEmployeeId) continue;
    if (filterMonth && extractMonthKey(ev3['submitted_at']) !== filterMonth) continue;
    if (!mgrCounts[mgrEmail3]) mgrCounts[mgrEmail3] = { name: managerNameMap[mgrEmail3] || mgrEmail3, count: 0 };
    mgrCounts[mgrEmail3].count++;
  }
  var managerEvalCounts = [];
  var mgrKeys = Object.keys(mgrCounts);
  for (var mki = 0; mki < mgrKeys.length; mki++) {
    managerEvalCounts.push({ name: mgrCounts[mgrKeys[mki]].name, email: mgrKeys[mki], count: mgrCounts[mgrKeys[mki]].count });
  }
  managerEvalCounts.sort(function(a, b) { return b.count - a.count; });

  var recent = [];
  for (var ri = evaluations.length - 1; ri >= 0; ri--) {
    var ev2       = evaluations[ri];
    var mgrEmail2 = (ev2['manager_email'] || '').toString().toLowerCase().trim();
    var empId2    = (ev2['teacher_id']    || ev2['employee_id'] || '').toString();

    if (filterManagerEmail && mgrEmail2.toLowerCase() !== filterManagerEmail.toLowerCase()) continue;
    if (filterEmployeeId   && empId2               !== filterEmployeeId)                      continue;
    if (filterMonth && extractMonthKey(ev2['submitted_at']) !== filterMonth)                 continue;

    var dv    = ev2['submitted_at'] || '';
    var ds    = '—';
    if (dv) { try { ds = new Date(dv).toLocaleDateString('ar-EG'); } catch (x) { ds = dv; } }
    var sc2   = parseFloat(ev2['avg_score']);
    var mgrName = managerNameMap[mgrEmail2] || '';
    recent.push({
      evaluationId: (ev2['evaluation_id'] || '').toString(),
      teacherName:   (ev2['teacher_name']  || '—').toString(),
      teacherSpec:   (ev2['teacher_spec']  || '—').toString(),
      school:        (ev2['school']         || '—').toString(),
      grade:         (ev2['grade']          || '—').toString(),
      className:     (ev2['class_name']    || '—').toString(),
      classSpec:     (ev2['class_spec']    || '—').toString(),
      avgScore:      isNaN(sc2) ? '—' : sc2.toFixed(2),
      semester:      (ev2['semester']       || '—').toString(),
      submittedAt:   ds,
      managerName:   mgrName || '—',
      managerEmail:  mgrEmail2 || '—'
    });
    if (recent.length >= 8) break;
  }

  var deptCatScores = {};
  var deptCatTotal  = {};
  var deptCatCount  = {};
  for (var dci = 0; dci < answers.length; dci++) {
    var dcAns   = answers[dci];
    var dcEId   = (dcAns['evaluation_id'] || '').toString().trim();
    if (!evalIds[dcEId]) continue;
    var dcQId   = (dcAns['question_id'] || '').toString();
    var dcRat   = parseFloat(dcAns['rating']) || 0;
    var dcWt    = parseFloat(dcAns['weight']) || 1;
    var dcCat   = '';
    for (var dci2 = 0; dci2 < questions.length; dci2++) {
      if ((questions[dci2]['question_id'] || '').toString() === dcQId) {
        dcCat = (questions[dci2]['category'] || '—').toString();
        break;
      }
    }
    if (!dcCat) continue;
    var dcDept = '';
    for (var dci3 = 0; dci3 < evaluations.length; dci3++) {
      if ((evaluations[dci3]['evaluation_id'] || '').toString().trim() === dcEId) {
        dcDept = (evaluations[dci3]['class_spec'] || '').toString().trim();
        break;
      }
    }
    if (!dcDept) continue;
    var dk = dcDept + '||' + dcCat;
    if (!deptCatScores[dk]) { deptCatScores[dk] = 0; deptCatTotal[dk] = 0; deptCatCount[dk] = 0; }
    deptCatScores[dk] += dcRat * dcWt;
    deptCatTotal[dk]  += dcWt;
    deptCatCount[dk]++;
  }
  var deptCatMap = {};
  var dkKeys = Object.keys(deptCatScores);
  for (var dci4 = 0; dci4 < dkKeys.length; dci4++) {
    var dk2 = dkKeys[dci4];
    var parts = dk2.split('||');
    var dDept = parts[0];
    var dCat  = parts[1];
    if (!deptCatMap[dDept]) deptCatMap[dDept] = [];
    deptCatMap[dDept].push({
      category: dCat,
      avg:      deptCatTotal[dk2] > 0 ? (deptCatScores[dk2] / deptCatTotal[dk2]).toFixed(2) : '0.00',
      count:    deptCatCount[dk2]
    });
  }
  var departmentCategoryAverages = [];
  var deptNames = Object.keys(deptCatMap).sort();
  for (var dci5 = 0; dci5 < deptNames.length; dci5++) {
    deptCatMap[deptNames[dci5]].sort(function(a, b) { return parseFloat(b.avg) - parseFloat(a.avg); });
    departmentCategoryAverages.push({
      department: deptNames[dci5],
      categories: deptCatMap[deptNames[dci5]]
    });
  }

  var activeQCount = 0;
  for (var qi = 0; qi < questions.length; qi++) {
    if ((questions[qi]['status'] || '').toString().trim().toLowerCase() === 'active') activeQCount++;
  }

  return {
    totalEvals:           totalEvals,
    totalTeachers:        totalTeachers,
    overallAvg:           overallAvg,
    activeQuestions:      activeQCount,
    scoreBuckets:         scoreBuckets,
    semesterBreakdown:    semesterBreakdown,
    schoolAverages:       schoolAverages,
    topPerformers:        topPerformers,
    departmentAverages:   departmentAverages,
    recentEvals:          recent,
    categoryAverages:     categoryAverages,
    managerEvalCounts:    managerEvalCounts,
    branchDeptAverages:   branchDeptAverages,
    departmentCategoryAverages: departmentCategoryAverages,
    availableMonths:      availableMonths,
    selectedMonth:        filterMonth,
    appliedFilters:      { managerEmail: filterManagerEmail, employeeId: filterEmployeeId, month: filterMonth }
  };
}

// ── Get instructor's own evaluations ──────────────────────────────
function getMyEvaluations() {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  if (!callerEmail) return [];

  var empRows = AppUtils.sheetToObjects('Employees');
  var callerEmpId = '';
  for (var ei = 0; ei < empRows.length; ei++) {
    var eEmail = (empRows[ei]['email'] || '').toString().toLowerCase().trim();
    if (eEmail === callerEmail.toLowerCase().trim()) {
      callerEmpId = (empRows[ei]['employee_id'] || '').toString().trim();
      break;
    }
  }
  if (!callerEmpId) return {teacherId:'',evals:[]};

  var managersRows = AppUtils.sheetToObjects('Managers');
  var managerNameMap = {};
  for (var mi = 0; mi < managersRows.length; mi++) {
    var mEmail = (managersRows[mi]['email'] || '').toString().toLowerCase().trim();
    var mName  = (managersRows[mi]['name']  || '').toString();
    if (mEmail) managerNameMap[mEmail] = mName;
  }

  var evalRows = AppUtils.sheetToObjects('Evaluations');
  var result = [];
  for (var j = 0; j < evalRows.length; j++) {
    var e = evalRows[j];
    var tId = (e['teacher_id'] || '').toString().trim();
    if (tId !== callerEmpId) continue;

    var mgrEmail = (e['manager_email'] || '').toString().toLowerCase().trim();
    var mgrName = managerNameMap[mgrEmail] || mgrEmail;
    var dv = e['submitted_at'] || '';
    var ds = '—';
    if (dv) { try { ds = new Date(dv).toLocaleDateString('ar-EG'); } catch (x) { ds = dv; } }
    var sc = parseFloat(e['avg_score']);

    result.push({
      evaluation_id:   (e['evaluation_id']  || '').toString(),
      teacher_name:    (e['teacher_name']   || '—').toString(),
      teacher_spec:    (e['teacher_spec']   || '').toString(),
      school:          (e['school']         || '').toString(),
      grade:           (e['grade']          || '').toString(),
      class_name:      (e['class_name']     || '').toString(),
      class_spec:      (e['class_spec']     || '').toString(),
      semester:        (e['semester']       || '').toString(),
      avg_score:       isNaN(sc) ? 0 : sc,
      notes:           (e['notes']          || '').toString(),
      submitted_at:    ds,
      manager_email:   mgrName,
      department:      (e['teacher_spec']   || '').toString(),
      subject_name:    (e['school']         || '').toString(),
      grade_level:     (e['grade']          || '').toString()
    });
  }
  return {teacherId: callerEmpId, evals: result};
}

// ── Get all managers for filter dropdown ──────────────────────────────────────
function getAllManagers() {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  PermissionGuard.require(callerEmail, 'canViewDashboard');

  var rows = AppUtils.sheetToObjects('Managers');
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if ((r['status'] || '').toString().trim().toLowerCase() !== 'active') continue;
    result.push({
      email: (r['email'] || '').toString(),
      name:  (r['name']  || '').toString()
    });
  }
  return result;
}



// ── Get all evaluations for a specific instructor (manager only) ──────────────
function getEvaluationsByInstructor(teacherId) {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  PermissionGuard.require(callerEmail, 'canViewDashboard');

  var managersRows = AppUtils.sheetToObjects('Managers');
  var managerNameMap = {};
  for (var mi = 0; mi < managersRows.length; mi++) {
    var mEmail = (managersRows[mi]['email'] || '').toString().toLowerCase().trim();
    var mName  = (managersRows[mi]['name']  || '').toString();
    if (mEmail) managerNameMap[mEmail] = mName;
  }

  var evalRows = AppUtils.sheetToObjects('Evaluations');
  var result = [];
  for (var j = 0; j < evalRows.length; j++) {
    var e = evalRows[j];
    var tId = (e['teacher_id'] || '').toString().trim();
    if (teacherId && tId !== teacherId) continue;

    var mgrEmail = (e['manager_email'] || '').toString().toLowerCase().trim();
    var mgrName = managerNameMap[mgrEmail] || mgrEmail;
    var dv = e['submitted_at'] || '';
    var ds = '—';
    if (dv) { try { ds = new Date(dv).toLocaleDateString('ar-EG'); } catch (x) { ds = dv; } }
    var sc = parseFloat(e['avg_score']);

    result.push({
      evaluation_id:   (e['evaluation_id']  || '').toString(),
      manager_email:   mgrName,
      teacher_name:    (e['teacher_name']   || '—').toString(),
      teacher_spec:    (e['teacher_spec']   || '').toString(),
      school:          (e['school']         || '').toString(),
      class_name:      (e['class_name']     || '').toString(),
      grade:           (e['grade']          || '').toString(),
      class_spec:      (e['class_spec']     || '').toString(),
      semester:        (e['semester']       || '').toString(),
      avg_score:       isNaN(sc) ? 0 : sc,
      notes:           (e['notes']          || '').toString(),
      submitted_at:    ds
    });
  }
  result.sort(function(a, b) { return b.submitted_at.localeCompare(a.submitted_at); });
  return result;
}

// ── Get full evaluation details with question-by-question answers ─────────────
function getEvaluationFullDetails(evaluationId) {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  var profile = _buildProfile(callerEmail);
  var isInstructor = (profile.role === 'مدرب' || profile.role === 'معلم' || profile.role === 'Instructor');
  if (!isInstructor) {
    PermissionGuard.require(callerEmail, 'canViewDashboard');
  }

  var evRows = AppUtils.sheetToObjects('Evaluations');
  var evalRow = null;
  for (var vi = 0; vi < evRows.length; vi++) {
    if ((evRows[vi]['evaluation_id'] || '').toString().trim() === evaluationId) {
      evalRow = evRows[vi];
      break;
    }
  }
  if (!evalRow) return null;

  if (isInstructor) {
    var empRows = AppUtils.sheetToObjects('Employees');
    var callerEmpId = '';
    for (var ei = 0; ei < empRows.length; ei++) {
      var eEmail = (empRows[ei]['email'] || '').toString().toLowerCase().trim();
      if (eEmail === callerEmail.toLowerCase().trim()) {
        callerEmpId = (empRows[ei]['employee_id'] || '').toString().trim();
        break;
      }
    }
    var tId = (evalRow['teacher_id'] || '').toString().trim();
    if (tId !== callerEmpId) return null;
  }

  var ansRows = AppUtils.sheetToObjects('EvaluationAnswers');
  var answers = [];
  for (var ai = 0; ai < ansRows.length; ai++) {
    if ((ansRows[ai]['evaluation_id'] || '').toString().trim() === evaluationId) {
      answers.push({
        questionId: (ansRows[ai]['question_id'] || '').toString(),
        rating:     parseInt(ansRows[ai]['rating']) || 0,
        weight:     parseFloat(ansRows[ai]['weight']) || 1
      });
    }
  }

  var qRows = AppUtils.sheetToObjects('Questions');
  var questions = [];
  for (var qi = 0; qi < qRows.length; qi++) {
    questions.push({
      id:       (qRows[qi]['question_id']   || '').toString(),
      category: (qRows[qi]['category']      || '—').toString(),
      text:     (qRows[qi]['question_text'] || '').toString(),
      weight:   parseFloat(qRows[qi]['weight']) || 1
    });
  }

  var mgrRows = AppUtils.sheetToObjects('Managers');
  var mgrName = '';
  var mgrEmail = (evalRow['manager_email'] || '').toString().toLowerCase().trim();
  for (var mi = 0; mi < mgrRows.length; mi++) {
    if ((mgrRows[mi]['email'] || '').toString().toLowerCase().trim() === mgrEmail) {
      mgrName = (mgrRows[mi]['name'] || '').toString();
      break;
    }
  }

  var dv = evalRow['submitted_at'] || '';
  var ds = '—';
  if (dv) { try { ds = new Date(dv).toLocaleDateString('ar-EG'); } catch (x) { ds = dv; } }

  var answerMap = {};
  for (var ai2 = 0; ai2 < answers.length; ai2++) {
    answerMap[answers[ai2].questionId] = answers[ai2];
  }

  var questionsWithAnswers = [];
  for (var qi2 = 0; qi2 < questions.length; qi2++) {
    var q = questions[qi2];
    var ans = answerMap[q.id];
    if (ans) {
      questionsWithAnswers.push({
        id:       q.id,
        category: q.category,
        text:     q.text,
        weight:   q.weight,
        rating:   ans.rating,
        weighted: (ans.rating * ans.weight).toFixed(2)
      });
    }
  }

  return {
    eval: {
      evaluation_id: (evalRow['evaluation_id'] || '').toString(),
      teacher_name:  (evalRow['teacher_name']  || '—').toString(),
      teacher_spec:  (evalRow['teacher_spec']  || '—').toString(),
      school:        (evalRow['school']         || '—').toString(),
      grade:         (evalRow['grade']          || '—').toString(),
      class_name:    (evalRow['class_name']    || '—').toString(),
      class_spec:    (evalRow['class_spec']    || '—').toString(),
      semester:      (evalRow['semester']       || '—').toString(),
      avg_score:     (evalRow['avg_score']     || '0').toString(),
      notes:         (evalRow['notes']         || '').toString(),
      submitted_at:  ds,
      manager_name:  mgrName || mgrEmail
    },
    questions: questionsWithAnswers
  };
}

// ── Get instructor aggregated data (evals + category summary + KPIs) ───────────
function getInstructorAggregatedData(teacherId) {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch (e) {}
  // Allow if has dashboard permission OR if caller is the teacher themselves
  var callerIsTeacher = false;
  if (callerEmail && teacherId) {
    var empRows2 = AppUtils.sheetToObjects('Employees');
    for (var ei3 = 0; ei3 < empRows2.length; ei3++) {
      if ((empRows2[ei3]['email'] || '').toString().toLowerCase().trim() === callerEmail.toLowerCase().trim()) {
        if ((empRows2[ei3]['employee_id'] || '').toString().trim() === teacherId) callerIsTeacher = true;
        break;
      }
    }
  }
  if (!callerIsTeacher) {
    PermissionGuard.require(callerEmail, 'canViewDashboard');
  }

  // Get managers name map
  var managersRows = AppUtils.sheetToObjects('Managers');
  var managerNameMap = {};
  for (var mi = 0; mi < managersRows.length; mi++) {
    var mEmail = (managersRows[mi]['email'] || '').toString().toLowerCase().trim();
    var mName  = (managersRows[mi]['name']  || '').toString();
    if (mEmail) managerNameMap[mEmail] = mName;
  }

  // Get evaluations for this teacher
  var evalRows = AppUtils.sheetToObjects('Evaluations');
  var evalIds = [];
  var evals = [];
  var teacherInfo = null;
  for (var j = 0; j < evalRows.length; j++) {
    var e = evalRows[j];
    var tId = (e['teacher_id'] || '').toString().trim();
    if (teacherId && tId !== teacherId) continue;
    if (!teacherInfo) {
      teacherInfo = {
        name: (e['teacher_name'] || '—').toString(),
        school: (e['school'] || '').toString(),
        spec: (e['teacher_spec'] || '').toString()
      };
    }
    evalIds.push((e['evaluation_id'] || '').toString().trim());

    var mgrEmail = (e['manager_email'] || '').toString().toLowerCase().trim();
    var mgrName = managerNameMap[mgrEmail] || mgrEmail;
    var dv = e['submitted_at'] || '';
    var ds = '—';
    if (dv) { try { ds = new Date(dv).toLocaleDateString('ar-EG'); } catch (x) { ds = dv; } }
    var sc = parseFloat(e['avg_score']);

    evals.push({
      evaluation_id: (e['evaluation_id'] || '').toString(),
      manager_email: mgrName,
      teacher_name:  (e['teacher_name'] || '—').toString(),
      avg_score:     isNaN(sc) ? 0 : sc,
      submitted_at:  ds,
      semester:      (e['semester']   || '').toString(),
      department:    (e['teacher_spec'] || '').toString(),
      subject_name:  (e['school']     || '').toString(),
      class_name:    (e['class_name'] || '').toString(),
      grade_level:   (e['grade']      || '').toString()
    });
  }

  if (!evalIds.length) {
    return { evals: [], categories: [], kpis: { totalEvals: 0, uniqueEvaluators: 0, overallAvg: 0 } };
  }

  // Get all answers for these evaluations
  var ansRows = AppUtils.sheetToObjects('EvaluationAnswers');
  var evalAnswerMap = {};
  for (var ai = 0; ai < ansRows.length; ai++) {
    var eid = (ansRows[ai]['evaluation_id'] || '').toString().trim();
    if (evalIds.indexOf(eid) === -1) continue;
    if (!evalAnswerMap[eid]) evalAnswerMap[eid] = [];
    evalAnswerMap[eid].push({
      questionId: (ansRows[ai]['question_id'] || '').toString(),
      rating:     parseInt(ansRows[ai]['rating']) || 0,
      weight:     parseFloat(ansRows[ai]['weight']) || 1
    });
  }

  // Get all questions
  var qRows = AppUtils.sheetToObjects('Questions');
  var questionMap = {};
  for (var qi = 0; qi < qRows.length; qi++) {
    var qid = (qRows[qi]['question_id'] || '').toString().trim();
    questionMap[qid] = {
      category: (qRows[qi]['category'] || '—').toString(),
      text:     (qRows[qi]['question_text'] || '').toString(),
      weight:   parseFloat(qRows[qi]['weight']) || 1
    };
  }

  // Aggregate by category across all evaluations
  var catAgg = {};
  for (var eid2 in evalAnswerMap) {
    var answers = evalAnswerMap[eid2];
    for (var ai2 = 0; ai2 < answers.length; ai2++) {
      var ans = answers[ai2];
      var qInfo = questionMap[ans.questionId];
      if (!qInfo) continue;
      var cat = qInfo.category;
      if (!catAgg[cat]) catAgg[cat] = { totalScore: 0, count: 0, maxScore: 0 };
      catAgg[cat].totalScore += ans.rating;
      catAgg[cat].count++;
      catAgg[cat].maxScore += 5;
    }
  }

  // Build category summary
  var categories = [];
  for (var catName in catAgg) {
    var d = catAgg[catName];
    categories.push({
      category: catName,
      avg: d.maxScore > 0 ? ((d.totalScore / d.maxScore) * 5) : 0,
      questionCount: d.count
    });
  }
  categories.sort(function(a, b) { return b.avg - a.avg; });

  // Compute KPIs
  var totalEvals = evals.length;
  var uniqueEvalSet = {};
  for (var ei = 0; ei < evals.length; ei++) {
    uniqueEvalSet[evals[ei].manager_email] = true;
  }
  var uniqueEvaluators = Object.keys(uniqueEvalSet).length;
  var totalScore = 0;
  for (var ei2 = 0; ei2 < evals.length; ei2++) {
    totalScore += evals[ei2].avg_score;
  }
  var overallAvg = totalEvals > 0 ? totalScore / totalEvals : 0;

  // Compute instructor rank among all teachers
  var allTeacherAvgs = {};
  var allTeacherCounts = {};
  for (var rj = 0; rj < evalRows.length; rj++) {
    var rtId = (evalRows[rj]['teacher_id'] || '').toString().trim();
    var rSc = parseFloat(evalRows[rj]['avg_score']);
    if (!rtId || isNaN(rSc)) continue;
    if (!allTeacherAvgs[rtId]) { allTeacherAvgs[rtId] = 0; allTeacherCounts[rtId] = 0; }
    allTeacherAvgs[rtId] += rSc;
    allTeacherCounts[rtId]++;
  }
  var teacherRanks = [];
  for (var rtId2 in allTeacherAvgs) {
    teacherRanks.push({ id: rtId2, avg: allTeacherAvgs[rtId2] / allTeacherCounts[rtId2] });
  }
  teacherRanks.sort(function(a, b) { return b.avg - a.avg; });
  var rank = 0;
  var totalTeachers = teacherRanks.length;
  for (var ri = 0; ri < teacherRanks.length; ri++) {
    if (teacherRanks[ri].id === teacherId) { rank = ri + 1; break; }
  }

  var bestCat = categories.length > 0 ? categories[0] : null;
  var worstCat = categories.length > 0 ? categories[categories.length - 1] : null;

  evals.sort(function(a, b) { return b.submitted_at.localeCompare(a.submitted_at); });

  return {
    evals: evals,
    categories: categories,
    teacherInfo: teacherInfo,
    kpis: {
      totalEvals: totalEvals,
      uniqueEvaluators: uniqueEvaluators,
      overallAvg: overallAvg,
      rank: rank,
      totalTeachers: totalTeachers,
      bestCat: bestCat ? { category: bestCat.category, avg: bestCat.avg.toFixed(2) } : null,
      worstCat: worstCat ? { category: worstCat.category, avg: worstCat.avg.toFixed(2) } : null
    }
  };
}