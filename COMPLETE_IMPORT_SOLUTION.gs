// ============================================================
//  COMPLETE HISTORICAL DATA IMPORT - FIXED VERSION
//  Percentages (0-1) → 1-5 scale correctly, no "Historical Import"
// ============================================================

var SOURCE_SPREADSHEET_ID = '1PjYrQXH1QEMfeMXfVYmmIgZNLi5RBSCM21hRx_9ijEM';
var TARGET_SPREADSHEET_ID = '1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU';

var DOMAIN_MAP = {
  'CA': 'الإدارة الصفية',
  'TP': 'التخطيط للدرس',
  'AE': 'التقويم',
  'PS': 'العرض والتقديم',
  'ET': 'تكنولوجيا التعليم',
  'LR': 'مصادر التعلم'
};

// ───── FIX EXISTING BAD DATA IN PLACE ─────
function fixExistingHistoricalData() {
  var ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  var evalSheet = ss.getSheetByName('Evaluations');
  var ansSheet = ss.getSheetByName('EvaluationAnswers');
  var qSheet = ss.getSheetByName('Questions');

  // Build question lookup
  var qData = qSheet.getDataRange().getValues();
  var qHeaders = qData[0].map(function(h){return h.toString().trim();});
  var qIdIdx = qHeaders.indexOf('question_id');
  var qCatIdx = qHeaders.indexOf('category');
  var qWeightIdx = qHeaders.indexOf('weight');
  var qMap = {};
  for (var i=1;i<qData.length;i++){
    var cat = (qData[i][qCatIdx]||'').toString().trim();
    if (cat && !qMap[cat]) qMap[cat] = {id:qData[i][qIdIdx].toString().trim(), weight:parseFloat(qData[i][qWeightIdx])||1};
  }

  // Read source to get true percentages
  var src = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID).getSheetByName('Sheet1').getDataRange().getValues();
  var sh = src[0].map(function(h){return h.toString().trim();});
  var iTID=sh.indexOf('TID'), iName=sh.indexOf('Name'), iCA=sh.indexOf('CA'), iTP=sh.indexOf('TP'), iAE=sh.indexOf('AE'), iPS=sh.indexOf('PS'), iET=sh.indexOf('ET'), iLR=sh.indexOf('LR'), iTotal=sh.indexOf('Total');
  var srcByName = {};
  for (var r=1;r<src.length;r++){
    var nm=(src[r][iName]||'').toString().trim();
    if(nm) srcByName[nm]={CA:parseFloat(src[r][iCA])||0, TP:parseFloat(src[r][iTP])||0, AE:parseFloat(src[r][iAE])||0, PS:parseFloat(src[r][iPS])||0, ET:parseFloat(src[r][iET])||0, LR:parseFloat(src[r][iLR])||0, Total:parseFloat(src[r][iTotal])||0};
  }

  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h){return h.toString().trim();});
  var evalIdIdx=evalHeaders.indexOf('evaluation_id'), schoolIdx=evalHeaders.indexOf('school'), classSpecIdx=evalHeaders.indexOf('class_spec'), semesterIdx=evalHeaders.indexOf('semester'), avgIdx=evalHeaders.indexOf('avg_score'), nameIdx=evalHeaders.indexOf('teacher_name'), notesIdx=evalHeaders.indexOf('notes');

  var ansData = ansSheet.getDataRange().getValues();
  var ansHeaders = ansData[0].map(function(h){return h.toString().trim();});
  var ansEvalIdx=ansHeaders.indexOf('evaluation_id'), ansQIdx=ansHeaders.indexOf('question_id'), ansRatingIdx=ansHeaders.indexOf('rating'), ansWeightIdx=ansHeaders.indexOf('weight'), ansWeightedIdx=ansHeaders.indexOf('weighted_score');

  var fixed = 0;
  // Build map evalId -> row index for answers update
  var evalIdToScores = {};

  for (var i=1;i<evalData.length;i++){
    var eid = (evalData[i][evalIdIdx]||'').toString().trim();
    var tName = (evalData[i][nameIdx]||'').toString().trim();
    var srcScores = srcByName[tName];
    if (!srcScores) continue;

    // Check if needs fixing (Historical Import or 0.00)
    var school = (evalData[i][schoolIdx]||'').toString();
    var avgVal = evalData[i][avgIdx];
    var avgNum = parseFloat(avgVal)||0;
    var needsFix = (school.indexOf('Historical')!==-1) || avgNum===0;

    if (!needsFix) continue;

    // Calculate proper avg_score: use Total*5 if available, else weighted avg of 6 domains
    var properAvg = srcScores.Total ? (srcScores.Total*5).toFixed(2) : (((srcScores.CA+srcScores.TP+srcScores.AE+srcScores.PS+srcScores.ET+srcScores.LR)/6)*5).toFixed(2);

    // Fix Evaluations row in sheet
    evalSheet.getRange(i+1, schoolIdx+1).setValue(''); // remove Historical Import -> empty = "غير محدد" won't show as filter
    evalSheet.getRange(i+1, semesterIdx+1).setValue(''); // clear semester Historical
    evalSheet.getRange(i+1, avgIdx+1).setValue(parseFloat(properAvg));
    // class_spec already subject, keep it

    evalIdToScores[eid] = srcScores;
    fixed++;
  }

  // Fix EvaluationAnswers: update rating/weight/weighted_score to match percentages
  for (var i=1;i<ansData.length;i++){
    var eid = (ansData[i][ansEvalIdx]||'').toString().trim();
    var srcScores = evalIdToScores[eid];
    if (!srcScores) continue;
    var qId = (ansData[i][ansQIdx]||'').toString().trim();
    // Find category for this qId
    var cat = null;
    for (var c in qMap){ if(qMap[c].id===qId){ cat=c; break; } }
    if (!cat) continue;
    // Map cat back to domain
    var domain = null;
    for (var d in DOMAIN_MAP){ if(DOMAIN_MAP[d]===cat){ domain=d; break; } }
    if (!domain) continue;
    var score01 = srcScores[domain]||0;
    var newRating = parseFloat((score01*5).toFixed(2)); // precise 1-5
    if(newRating<1) newRating=1; if(newRating>5) newRating=5;
    var weight = qMap[cat].weight;
    var newWeighted = (newRating*weight).toFixed(2);
    ansSheet.getRange(i+1, ansRatingIdx+1).setValue(newRating);
    ansSheet.getRange(i+1, ansWeightIdx+1).setValue(weight);
    ansSheet.getRange(i+1, ansWeightedIdx+1).setValue(parseFloat(newWeighted));
  }

  // Also clean any remaining "Historical Import" strings anywhere in Evaluations
  var allEvals = evalSheet.getDataRange().getValues();
  for (var r=1;r<allEvals.length;r++){
    for (var c=0;c<allEvals[0].length;c++){
      var v = allEvals[r][c];
      if (typeof v==='string' && v.indexOf('Historical Import')!==-1){
        evalSheet.getRange(r+1,c+1).setValue(v.replace(/Historical Import/g,'').trim());
      }
      if (typeof v==='string' && v==='Historical'){
        evalSheet.getRange(r+1,c+1).setValue('');
      }
    }
  }

  AppUtils.invalidate('Evaluations');
  AppUtils.invalidate('EvaluationAnswers');

  return 'Fixed '+fixed+' evaluations. School/semester cleaned, avg_score recalculated from percentages (Total*5), answers updated to precise 1-5 ratings.';
}

// ───── CLEANUP then REIMPORT (use if fix not enough) ─────
function cleanupAndReimport(){
  var res=[];
  res.push(step3_cleanupBadImports());
  res.push(step3_importHistoricalData_FIXED());
  res.push(fixExistingHistoricalData()); // ensure no Historical string remains
  var v = step4_verifyImport();
  res.push('Verify: Evals='+v.evaluations+' Answers='+v.answers+' Avg='+v.dashboard.overallAvg);
  res.push('Categories: '+v.dashboard.categories.join(' | '));
  return res.join('\n');
}

function step3_cleanupBadImports() {
  var targetSs = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  var evalSheet = targetSs.getSheetByName('Evaluations');
  var ansSheet = targetSs.getSheetByName('EvaluationAnswers');
  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h){return h.toString().trim();});
  var evalIdIdx=evalHeaders.indexOf('evaluation_id'), schoolIdx=evalHeaders.indexOf('school'), avgIdx=evalHeaders.indexOf('avg_score'), notesIdx=evalHeaders.indexOf('notes');
  var ansData = ansSheet.getDataRange().getValues();
  var ansHeaders = ansData[0].map(function(h){return h.toString().trim();});
  var ansEvalIdx=ansHeaders.indexOf('evaluation_id');
  var evalIdsToDelete=[];
  for(var i=1;i<evalData.length;i++){
    var school=(evalData[i][schoolIdx]||'').toString();
    var avg=(evalData[i][avgIdx]||'').toString();
    var notes=(evalData[i][notesIdx]||'').toString();
    if(school.indexOf('Historical')!==-1 || parseFloat(avg)===0 || notes.indexOf('historical')!==-1){
      evalIdsToDelete.push((evalData[i][evalIdIdx]||'').toString().trim());
    }
  }
  if(evalIdsToDelete.length===0) return 'Cleanup: nothing to delete';
  var keepAns=[ansHeaders];
  for(var i=1;i<ansData.length;i++){
    var eid=(ansData[i][ansEvalIdx]||'').toString().trim();
    if(evalIdsToDelete.indexOf(eid)===-1) keepAns.push(ansData[i]);
  }
  ansSheet.clearContents();
  ansSheet.getRange(1,1,keepAns.length,keepAns[0].length).setValues(keepAns);
  var keepEval=[evalHeaders];
  for(var i=1;i<evalData.length;i++){
    var eid=(evalData[i][evalIdIdx]||'').toString().trim();
    if(evalIdsToDelete.indexOf(eid)===-1) keepEval.push(evalData[i]);
  }
  evalSheet.clearContents();
  evalSheet.getRange(1,1,keepEval.length,keepEval[0].length).setValues(keepEval);
  AppUtils.invalidate('Evaluations'); AppUtils.invalidate('EvaluationAnswers');
  return 'Cleanup: deleted '+evalIdsToDelete.length+' bad evals';
}

function step3_importHistoricalData_FIXED(){
  var sourceSs = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  var sourceSheet = sourceSs.getSheetByName('Sheet1');
  if(!sourceSheet) throw new Error('Source Sheet1 not found');
  var data = sourceSheet.getDataRange().getValues();
  var headers = data[0].map(function(h){return h.toString().trim();});
  var colIdx={}; ['TID','Name','subject','CA','TP','AE','PS','ET','LR','Total'].forEach(function(n){colIdx[n]=headers.indexOf(n);});
  var targetSs = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  var empSheet=targetSs.getSheetByName('Employees'), evalSheet=targetSs.getSheetByName('Evaluations'), ansSheet=targetSs.getSheetByName('EvaluationAnswers'), qSheet=targetSs.getSheetByName('Questions');
  var empData=empSheet.getDataRange().getValues();
  var empHeaders=empData[0].map(function(h){return h.toString().trim();});
  var empIdIdx=empHeaders.indexOf('employee_id'), empNameIdx=empHeaders.indexOf('name'), empTidIdx=empHeaders.indexOf('TID');
  var empByTid={}, empByName={};
  for(var i=1;i<empData.length;i++){
    if(empTidIdx!==-1 && empData[i][empTidIdx]) empByTid[empData[i][empTidIdx].toString().trim()]=empData[i][empIdIdx].toString().trim();
    if(empData[i][empNameIdx]) empByName[empData[i][empNameIdx].toString().trim()]=empData[i][empIdIdx].toString().trim();
  }
  var qData=qSheet.getDataRange().getValues();
  var qHeaders=qData[0].map(function(h){return h.toString().trim();});
  var qIdIdx=qHeaders.indexOf('question_id'), qCatIdx=qHeaders.indexOf('category'), qWeightIdx=qHeaders.indexOf('weight');
  var questionsByCat={};
  for(var i=1;i<qData.length;i++){
    var cat=(qData[i][qCatIdx]||'').toString().trim();
    if(cat){
      if(!questionsByCat[cat]) questionsByCat[cat]=[];
      questionsByCat[cat].push({id:qData[i][qIdIdx].toString().trim(), weight:parseFloat(qData[i][qWeightIdx])||1});
    }
  }
  var imported=0, skipped=0, now=new Date();
  for(var rowIdx=1;rowIdx<data.length;rowIdx++){
    var row=data[rowIdx];
    var tid=(row[colIdx.TID]||'').toString().trim(), name=(row[colIdx.Name]||'').toString().trim(), subject=(row[colIdx.subject]||'').toString().trim();
    if(!tid && !name) continue;
    var domainScores={CA:parseFloat(row[colIdx.CA])||0, TP:parseFloat(row[colIdx.TP])||0, AE:parseFloat(row[colIdx.AE])||0, PS:parseFloat(row[colIdx.PS])||0, ET:parseFloat(row[colIdx.ET])||0, LR:parseFloat(row[colIdx.LR])||0};
    var totalPct=parseFloat(row[colIdx.Total])||0;
    var empId=empByTid[tid]||empByName[name];
    if(!empId){
      empId='emp-'+Math.random().toString(36).substring(2,7);
      var newRow=new Array(empHeaders.length).fill('');
      newRow[empIdIdx]=empId; newRow[empNameIdx]=name;
      var pIdx=empHeaders.indexOf('position'); if(pIdx!==-1) newRow[pIdx]=subject||'Teacher';
      var sIdx=empHeaders.indexOf('status'); if(sIdx!==-1) newRow[sIdx]='Active';
      var cIdx=empHeaders.indexOf('created_at'); if(cIdx!==-1) newRow[cIdx]=now;
      if(empTidIdx!==-1) newRow[empTidIdx]=tid;
      empSheet.appendRow(newRow);
      empByTid[tid]=empId; empByName[name]=empId;
    }
    var evalDataChk=evalSheet.getDataRange().getValues();
    var evalHeadersChk=evalDataChk[0].map(function(h){return h.toString().trim();});
    var evalEmpIdx=evalHeadersChk.indexOf('teacher_id');
    var exists=false;
    for(var ei=1;ei<evalDataChk.length;ei++){ if((evalDataChk[ei][evalEmpIdx]||'').toString().trim()===empId){ exists=true; break; } }
    if(exists){ skipped++; continue; }
    var evaluationId='eval-'+Math.random().toString(36).substring(2,7);
    var answerRows=[], totalWS=0, totalW=0;
    for(var domain in domainScores){
      var score01=domainScores[domain]; if(score01<=0) continue;
      var cat=DOMAIN_MAP[domain], qs=questionsByCat[cat];
      if(!qs||!qs.length) continue;
      var q=qs[0];
      var rating=parseFloat((score01*5).toFixed(2)); // 0-1 -> 1-5 precise
      if(rating<1) rating=1; if(rating>5) rating=5;
      var ws=rating*q.weight;
      totalWS+=ws; totalW+=q.weight;
      answerRows.push(['ans-'+Math.random().toString(36).substring(2,7), evaluationId, q.id, rating, q.weight, parseFloat(ws.toFixed(2))]);
    }
    // Use Total*5 as avg_score (more accurate, preserves original percentage). Fallback to weighted avg.
    var avgScore = totalPct ? (totalPct*5).toFixed(2) : (totalW>0?(totalWS/totalW).toFixed(2):'0.00');
    var evalHeaders2=evalSheet.getRange(1,1,1,evalSheet.getLastColumn()).getValues()[0].map(function(h){return h.toString().trim();});
    var evalRow=new Array(evalHeaders2.length).fill('');
    evalRow[evalHeaders2.indexOf('evaluation_id')]=evaluationId;
    evalRow[evalHeaders2.indexOf('manager_email')]=''; // leave empty so dashboard shows evaluator as anonymous, no Historical filter
    evalRow[evalHeaders2.indexOf('teacher_id')]=empId;
    evalRow[evalHeaders2.indexOf('teacher_name')]=name;
    evalRow[evalHeaders2.indexOf('teacher_spec')]=subject;
    evalRow[evalHeaders2.indexOf('school')]=''; // EMPTY - removes Historical Import from filters/charts
    evalRow[evalHeaders2.indexOf('grade')]='';
    evalRow[evalHeaders2.indexOf('class_name')]='';
    evalRow[evalHeaders2.indexOf('class_spec')]=subject;
    evalRow[evalHeaders2.indexOf('semester')]=''; // empty
    evalRow[evalHeaders2.indexOf('avg_score')]=parseFloat(avgScore);
    evalRow[evalHeaders2.indexOf('notes')]='';
    evalRow[evalHeaders2.indexOf('submitted_at')]=now;
    evalSheet.appendRow(evalRow);
    if(answerRows.length) ansSheet.getRange(ansSheet.getLastRow()+1,1,answerRows.length,answerRows[0].length).setValues(answerRows);
    imported++;
  }
  return 'Reimport done: imported '+imported+', skipped '+skipped;
}

function step4_verifyImport(){
  var ss=SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  return {
    evaluations: ss.getSheetByName('Evaluations').getLastRow()-1,
    answers: ss.getSheetByName('EvaluationAnswers').getLastRow()-1,
    dashboard: (function(){ var s=getDashboardStats({}); return {overallAvg:s.overallAvg, total:s.totalEvals, categories:s.categoryAverages}; })()
  };
}