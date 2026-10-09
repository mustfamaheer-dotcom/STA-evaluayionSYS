// ============================================================
//  REBUILD ALL  –  Nuclear reset + clean import of all teachers
//  Run ONCE: REBUILD_ALL
//  Wipes imported Evaluations/Answers/Employees, re-imports
//  every row from source with per-domain answers (all questions).
// ============================================================

// Safe wipe: keeps 1 unfrozen row (Sheets forbids deleting all non-frozen rows)
function _wipeData(sh){
  var last=sh.getLastRow();
  if(last<2) return;
  var toDelete=last-2;
  if(toDelete>0) sh.deleteRows(3, toDelete);
  sh.getRange(2,1,1,sh.getMaxColumns()).clearContent();
}

function REBUILD_ALL(){
  var DB='1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU';
  var SRC='1yQ93wkfTfac7Dum1kRZOPIfVpOtidnfUVGCD-fDuhYE';
  var db=SpreadsheetApp.openById(DB);

  // ── 1. WIPE all Evaluations + Answers (fresh start)
  var eSh=db.getSheetByName('Evaluations');
  var aSh=db.getSheetByName('EvaluationAnswers');
  _wipeData(eSh);
  _wipeData(aSh);

  // ── 2. Delete imported Employees (rows having TID), keep manual ones
  var pSh=db.getSheetByName('Employees');
  var pData=pSh.getDataRange().getValues();
  var pH=pData[0].map(function(h){return h.toString().trim();});
  var tIdx=pH.indexOf('TID');
  var delCount=0;
  for(var r=pData.length-1;r>=1;r--){
    if(tIdx!==-1 && pData[r][tIdx]!=='' && pData[r][tIdx]!==null){
      // never delete the very last unfrozen row
      if(pSh.getLastRow()>2){ pSh.deleteRow(r+1); }
      else { pSh.getRange(r+1,1,1,pSh.getMaxColumns()).clearContent(); }
      delCount++;
    }
  }

  // ── 3. Verify Questions have the 6 Arabic categories (active)
  var qSh=db.getSheetByName('Questions');
  var qData=qSh.getDataRange().getValues();
  var qH=qData[0].map(function(h){return h.toString().trim();});
  var cats={};
  var qIdC=qH.indexOf('question_id'), qCatC=qH.indexOf('category'), qWC=qH.indexOf('weight'), qStC=qH.indexOf('status');
  for(var i=1;i<qData.length;i++){
    var c=(qData[i][qCatC]||'').toString().trim();
    var st=(qData[i][qStC]||'').toString().trim().toLowerCase();
    if(c && st==='active'){
      if(!cats[c]) cats[c]=[];
      cats[c].push({id:qData[i][qIdC].toString().trim(), w:parseFloat(qData[i][qWC])||1});
    }
  }
  var need=['الإدارة الصفية','التخطيط للدرس','العرض والتقديم','التقويم','تكنولوجيا التعليم','مصادر التعلم'];
  var missing=need.filter(function(c){return !cats[c] || !cats[c].length;});
  if(missing.length){
    return 'ABORT — Questions sheet missing active categories: '+missing.join(' , ')+' → Run step2_seedQuestions() first, then REBUILD_ALL again.';
  }

  // ── 4. Read source & verify headers
  var src=SpreadsheetApp.openById(SRC).getSheets()[0].getDataRange().getValues();
  var sH=src[0].map(function(h){return h.toString().trim();});
  var iT=sH.indexOf('TID'), iN=sH.indexOf('Name'), iD=sH.indexOf('Department'), iS=sH.indexOf('School'), iTot=sH.indexOf('Total');
  var dom={CA:sH.indexOf('CA'),TP:sH.indexOf('TP'),AE:sH.indexOf('AE'),PS:sH.indexOf('PS'),ET:sH.indexOf('ET'),LR:sH.indexOf('LR')};
  if(iT===-1||iN===-1||iD===-1||dom.CA===-1||dom.LR===-1){
    return 'ABORT — Source headers wrong. Found: '+sH.join(' | ')+' → Sheet must have TID, Name, Department, School, CA, TP, AE, PS, ET, LR, Total';
  }
  var dom2cat={CA:'الإدارة الصفية',TP:'التخطيط للدرس',AE:'التقويم',PS:'العرض والتقديم',ET:'تكنولوجيا التعليم',LR:'مصادر التعلم'};

  // ── 5. Build rows in memory
  var now=new Date();
  var empRows=[], proper=[], ansRows=[];
  var eH=eSh.getRange(1,1,1,eSh.getLastColumn()).getValues()[0].map(function(h){return h.toString().trim();});
  var eIdC=eH.indexOf('evaluation_id'), eMgrC=eH.indexOf('manager_email'), eTidC=eH.indexOf('teacher_id'),
      eNmC=eH.indexOf('teacher_name'), eSpecC=eH.indexOf('teacher_spec'), eSchC=eH.indexOf('school'),
      eGradeC=eH.indexOf('grade'), eClsC=eH.indexOf('class_name'), eClsSpC=eH.indexOf('class_spec'),
      eSemC=eH.indexOf('semester'), eAvgC=eH.indexOf('avg_score'), eNotesC=eH.indexOf('notes'), eSubC=eH.indexOf('submitted_at');

  var empIdC=pH.indexOf('employee_id'), empNameC=pH.indexOf('name'), empPosC=pH.indexOf('position'),
      empBrC=pH.indexOf('school_branch'), empStatusC=pH.indexOf('status'), empCreatedC=pH.indexOf('created_at');

  for(var r2=1;r2<src.length;r2++){
    var tid=src[r2][iT];
    if(tid===''||tid===null||tid===undefined) continue;
    var nm=(src[r2][iN]||'').toString().trim();
    var dp=(src[r2][iD]||'').toString().trim()||'—';
    var schl=AppUtils.normalizeSchool((iS!==-1?(src[r2][iS]||'').toString().trim():''))||'—';

    var sc={}, sum=0;
    ['CA','TP','AE','PS','ET','LR'].forEach(function(k){ sc[k]=parseFloat(src[r2][dom[k]])||0; sum+=sc[k]; });
    var tot = iTot!==-1 && parseFloat(src[r2][iTot]) ? parseFloat(src[r2][iTot]) : sum/6;
    if(tot>1) tot=tot/100;

    // Employee row
    var empId='emp-'+Math.random().toString(36).substring(2,7);
    var er=new Array(pH.length).fill('');
    er[empIdC]=empId; er[empNameC]=nm; er[empPosC]=dp; er[empBrC]=schl;
    er[empStatusC]='Active'; er[empCreatedC]=now;
    if(tIdx!==-1) er[tIdx]=String(tid);
    empRows.push(er);

    // Evaluation row
    var eid='eval-'+Math.random().toString(36).substring(2,7);
    var row=new Array(eH.length).fill('');
    row[eIdC]=eid; row[eMgrC]=''; row[eTidC]=empId; row[eNmC]=nm;
    row[eSpecC]=dp; row[eSchC]=schl; row[eGradeC]=''; row[eClsC]='';
    row[eClsSpC]=dp; row[eSemC]='';
    row[eAvgC]=parseFloat((tot*5).toFixed(2));
    row[eNotesC]=''; row[eSubC]=now;
    proper.push(row);

    // Answers: rate EVERY active question in each domain's category
    ['CA','TP','AE','PS','ET','LR'].forEach(function(d){
      var pct=sc[d]; if(pct<=0) return;
      var rating=Math.max(1,Math.min(5,parseFloat((pct*5).toFixed(2))));
      cats[dom2cat[d]].forEach(function(q){
        ansRows.push([
          'ans-'+Math.random().toString(36).substring(2,7),
          eid, q.id, rating, q.w,
          parseFloat((rating*q.w).toFixed(2))
        ]);
      });
    });
  }

  if(!proper.length) return 'ABORT — Source has no data rows.';

  // ── 6. Write in bulk
  eSh.getRange(2,1,proper.length,eH.length).setValues(proper);
  pSh.getRange(pSh.getLastRow()+1,1,empRows.length,pH.length).setValues(empRows);
  aSh.getRange(2,1,ansRows.length,ansRows[0].length).setValues(ansRows);

  return 'DONE ✓ Teachers:'+empRows.length+' | Evals:'+proper.length+' | Answers:'+ansRows.length+' | Expected avg ~'+(proper.reduce(function(s,r2){return s+r2[eAvgC];},0)/proper.length).toFixed(2)+'/5 — Refresh Web App.';
}

// ── Optional helper: check current DB state without changing anything
function CHECK_STATE(){
  var db=SpreadsheetApp.openById('1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU');
  function n(s){var sh=db.getSheetByName(s);return sh?sh.getLastRow()-1:0;}
  return 'Employees:'+n('Employees')+' | Evals:'+n('Evaluations')+' | Answers:'+n('EvaluationAnswers')+' | Questions:'+n('Questions');
}