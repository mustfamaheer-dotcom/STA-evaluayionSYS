// ============================================================
//  IMPORT HISTORICAL DATA  –  Import eval-sum.xlsx into system
// ============================================================

/**
 * Import historical evaluation data from eval-sum.xlsx
 * 
 * Steps to use:
 * 1. Upload eval-sum.xlsx to Google Drive
 * 2. Open it with Google Sheets (creates a new spreadsheet)
 * 3. Copy the spreadsheet ID from URL
 * 4. Set SOURCE_SPREADSHEET_ID below
 * 5. Run importHistoricalEvaluations() from Apps Script editor
 */

const SOURCE_SPREADSHEET_ID = 'PUT_YOUR_SOURCE_SPREADSHEET_ID_HERE'; // The Google Sheets ID after uploading eval-sum.xlsx

// Domain code → Question category mapping
const DOMAIN_TO_CATEGORY = {
  'CA': 'الإدارة الصفية',
  'TP': 'التخطيط للدرس',
  'AE': 'التقويم',
  'PS': 'العرض والتقديم',
  'ET': 'تكنولوجيا التعليم',
  'LR': 'مصادر التعلم'
};

function importHistoricalEvaluations() {
  var sourceSs = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  var sourceSheet = sourceSs.getSheetByName('Sheet1');
  if (!sourceSheet) {
    throw new Error('Source sheet "Sheet1" not found');
  }

  var data = sourceSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  
  // Expected columns: TID, Name, subject, CA, TP, AE, PS, ET, LR, Total
  var tidIdx = headers.indexOf('TID');
  var nameIdx = headers.indexOf('Name');
  var subjectIdx = headers.indexOf('subject');
  var caIdx = headers.indexOf('CA');
  var tpIdx = headers.indexOf('TP');
  var aeIdx = headers.indexOf('AE');
  var psIdx = headers.indexOf('PS');
  var etIdx = headers.indexOf('ET');
  var lrIdx = headers.indexOf('LR');

  if (tidIdx === -1 || nameIdx === -1) {
    throw new Error('Required columns TID or Name not found. Headers: ' + headers.join(', '));
  }

  var db = AppUtils.getDB();
  var empSheet = db.getSheetByName('Employees');
  var evalSheet = db.getSheetByName('Evaluations');
  var ansSheet = db.getSheetByName('EvaluationAnswers');
  var qSheet = db.getSheetByName('Questions');

  if (!empSheet || !evalSheet || !ansSheet || !qSheet) {
    throw new Error('Required system sheets not found. Run setupSheetHeaders() first.');
  }

  // Build employee lookup by TID
  var empData = empSheet.getDataRange().getValues();
  var empHeaders = empData[0].map(function(h) { return h.toString().trim(); });
  var empIdIdx = empHeaders.indexOf('employee_id');
  var empNameIdx = empHeaders.indexOf('name');
  var empTidIdx = empHeaders.indexOf('TID') !== -1 ? empHeaders.indexOf('TID') : -1;
  // If no TID column, we'll match by name

  var empByTid = {};
  var empByName = {};
  for (var i = 1; i < empData.length; i++) {
    var row = empData[i];
    if (empTidIdx !== -1 && row[empTidIdx]) {
      empByTid[row[empTidIdx].toString().trim()] = row[empIdIdx].toString().trim();
    }
    if (row[empNameIdx]) {
      empByName[row[empNameIdx].toString().trim()] = row[empIdIdx].toString().trim();
    }
  }

  // Build question lookup by category
  var qData = qSheet.getDataRange().getValues();
  var qHeaders = qData[0].map(function(h) { return h.toString().trim(); });
  var qIdIdx = qHeaders.indexOf('question_id');
  var qCatIdx = qHeaders.indexOf('category');
  var qWeightIdx = qHeaders.indexOf('weight');

  var questionsByCat = {};
  for (var i = 1; i < qData.length; i++) {
    var cat = qData[i][qCatIdx];
    if (cat) {
      var catStr = cat.toString().trim();
      if (!questionsByCat[catStr]) questionsByCat[catStr] = [];
      questionsByCat[catStr].push({
        id: qData[i][qIdIdx].toString().trim(),
        weight: parseFloat(qData[i][qWeightIdx]) || 1.0
      });
    }
  }

  var imported = 0;
  var skipped = 0;
  var errors = [];

  // Process each row (skip header)
  for (var rowIdx = 1; rowIdx < data.length; rowIdx++) {
    var row = data[rowIdx];
    var tid = row[tidIdx] ? row[tidIdx].toString().trim() : '';
    var name = row[nameIdx] ? row[nameIdx].toString().trim() : '';
    var subject = row[subjectIdx] ? row[subjectIdx].toString().trim() : '';

    if (!tid && !name) continue; // Skip empty rows

    // Find or create employee
    var empId = empByTid[tid] || empByName[name];
    var isNewEmp = false;

    if (!empId) {
      // Create new employee
      empId = AppUtils.generateId('emp');
      var newEmpRow = new Array(empHeaders.length).fill('');
      newEmpRow[empIdIdx] = empId;
      newEmpRow[empNameIdx] = name;
      if (empHeaders.indexOf('position') !== -1) newEmpRow[empHeaders.indexOf('position')] = subject || 'Teacher';
      if (empHeaders.indexOf('status') !== -1) newEmpRow[empHeaders.indexOf('status')] = 'Active';
      if (empHeaders.indexOf('created_at') !== -1) newEmpRow[empHeaders.indexOf('created_at')] = new Date();
      if (empTidIdx !== -1) newEmpRow[empTidIdx] = tid;
      empSheet.appendRow(newEmpRow);
      empByTid[tid] = empId;
      empByName[name] = empId;
      isNewEmp = true;
    }

    // Get domain scores
    var domainScores = {
      'CA': parseFloat(row[caIdx]) || 0,
      'TP': parseFloat(row[tpIdx]) || 0,
      'AE': parseFloat(row[aeIdx]) || 0,
      'PS': parseFloat(row[psIdx]) || 0,
      'ET': parseFloat(row[etIdx]) || 0,
      'LR': parseFloat(row[lrIdx]) || 0
    };

    // Check if evaluation already exists for this teacher (avoid duplicates)
    var evalData = evalSheet.getDataRange().getValues();
    var evalHeaders = evalData[0].map(function(h) { return h.toString().trim(); });
    var evalEmpIdx = evalHeaders.indexOf('teacher_id') !== -1 ? evalHeaders.indexOf('teacher_id') : evalHeaders.indexOf('employee_id');
    var evalExists = false;
    for (var ei = 1; ei < evalData.length; ei++) {
      if (evalData[ei][evalEmpIdx] && evalData[ei][evalEmpIdx].toString().trim() === empId) {
        evalExists = true;
        break;
      }
    }

    if (evalExists) {
      skipped++;
      continue;
    }

    // Create evaluation with domain scores as answers
    var evaluationId = AppUtils.generateId('eval');
    var now = new Date();

    // Calculate average score (scale 0-1 to 1-5)
    var scores = Object.values(domainScores);
    var validScores = scores.filter(function(s) { return s > 0; });
    var avgScore = validScores.length > 0 
      ? (validScores.reduce(function(a,b){return a+b;},0) / validScores.length * 5).toFixed(2)
      : '0.00';

    // Append to Evaluations
    var evalRow = new Array(evalHeaders.length).fill('');
    evalRow[evalHeaders.indexOf('evaluation_id')] = evaluationId;
    evalRow[evalHeaders.indexOf('manager_email')] = 'import@historical';
    evalRow[evalEmpIdx] = empId;
    evalRow[evalHeaders.indexOf('teacher_name')] = name;
    evalRow[evalHeaders.indexOf('teacher_spec')] = subject;
    evalRow[evalHeaders.indexOf('school')] = 'Imported';
    evalRow[evalHeaders.indexOf('grade')] = '';
    evalRow[evalHeaders.indexOf('class_name')] = '';
    evalRow[evalHeaders.indexOf('class_spec')] = subject;
    evalRow[evalHeaders.indexOf('semester')] = 'Historical';
    evalRow[evalHeaders.indexOf('avg_score')] = avgScore;
    evalRow[evalHeaders.indexOf('notes')] = 'Imported from historical data';
    evalRow[evalHeaders.indexOf('submitted_at')] = now;
    evalSheet.appendRow(evalRow);

    // Append to EvaluationAnswers for each domain
    var answerRows = [];
    for (var domain in domainScores) {
      var score = domainScores[domain];
      if (score <= 0) continue;

      var category = DOMAIN_TO_CATEGORY[domain];
      var questions = questionsByCat[category];
      if (!questions || questions.length === 0) {
        errors.push('No questions found for category: ' + category + ' (domain: ' + domain + ')');
        continue;
      }

      // Use first question in category, scale 0-1 score to 1-5 rating
      var q = questions[0];
      var rating = Math.round(score * 5); // Convert 0-1 to 1-5
      rating = Math.max(1, Math.min(5, rating));

      answerRows.push([
        AppUtils.generateId('ans'),
        evaluationId,
        q.id,
        rating,
        q.weight,
        (rating * q.weight).toFixed(2)
      ]);
    }

    if (answerRows.length > 0) {
      ansSheet.getRange(
        ansSheet.getLastRow() + 1, 1,
        answerRows.length, answerRows[0].length
      ).setValues(answerRows);
    }

    imported++;
  }

  // Invalidate caches
  AppUtils.invalidate('Employees');
  AppUtils.invalidate('Evaluations');
  AppUtils.invalidate('EvaluationAnswers');

  var msg = 'Import complete. Imported: ' + imported + ', Skipped (existing): ' + skipped;
  if (errors.length) msg += '. Errors: ' + errors.join('; ');
  return msg;
}

/**
 * Helper: Add TID column to Employees sheet if not exists
 */
function addTidColumnToEmployees() {
  var db = AppUtils.getDB();
  var sheet = db.getSheetByName('Employees');
  if (!sheet) return 'Employees sheet not found';

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerStr = headers.map(function(h) { return h.toString().trim(); }).join('|');
  if (headerStr.indexOf('TID') !== -1) return 'TID column already exists';

  var newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue('TID');
  var headerRange = sheet.getRange(1, newCol);
  headerRange.setBackground('#212121');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  return 'TID column added at column ' + newCol;
}