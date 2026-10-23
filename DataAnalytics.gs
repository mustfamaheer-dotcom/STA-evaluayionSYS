// ============================================================
//  DATA ANALYTICS.GS  –  Isolated Historical Data Analytics
//  Reads ONLY from historical source spreadsheet.
//  Does NOT touch Evaluations / EvaluationAnswers / Dashboard.
// ============================================================

const HISTORICAL_SOURCE_ID = '1yQ93wkfTfac7Dum1kRZOPIfVpOtidnfUVGCD-fDuhYE';
const HISTORICAL_SHEET_NAME = 'Sheet1';

// Domain labels (Arabic + code)
const DA_DOMAINS = [
  { code: 'CA', label: 'الإدارة الصفية',   full: 'مجال الادارة الصفية (CA)' },
  { code: 'TP', label: 'التدريس القائم على الجدارات', full: 'مجال التدريس القائم على الجدارات (TP)' },
  { code: 'PS', label: 'العرض والتقديم',   full: 'مجال العرض والتقديم (PS)' },
  { code: 'AE', label: 'التقييم والتقويم', full: 'مجال التقييم والتقويم (AE)' },
  { code: 'ET', label: 'تكنولوجيا التعليم', full: 'مجال تكنولوجيا التعليم (ET)' },
  { code: 'LR', label: 'مصادر التعلم',     full: 'مجال مصادر التعلم (LR)' }
];

/**
 * Main entry - returns full analytics payload.
 * ISOLATED: reads only HISTORICAL_SOURCE_ID, never dashboard sheets.
 */
function getHistoricalAnalytics() {
  var callerEmail = '';
  try { callerEmail = Session.getActiveUser().getEmail(); } catch(e) {}
  // Allow dashboard viewers or any authenticated user
  // PermissionGuard.require(callerEmail, 'canViewDashboard'); // uncomment to restrict

  var rows = _readHistoricalRows();
  if (!rows.length) return { error: 'No historical data found in source sheet', rows: [] };

  // Aggregations
  var kpis = _calcKPIs(rows);
  var domainAvgs = _calcDomainAvgs(rows);
  var deptAvgs = _calcDeptAvgs(rows);
  var schoolAvgs = _calcSchoolAvgs(rows);
  var distribution = _calcDistribution(rows);
  var topBottom = _calcTopBottom(rows);
  var deptDomainMatrix = _calcDeptDomainMatrix(rows);
  var insights = _generateInsights(rows, domainAvgs, deptAvgs, schoolAvgs, distribution);

  return {
    meta: {
      totalRecords: rows.length,
      sourceId: HISTORICAL_SOURCE_ID,
      generatedAt: new Date().toISOString(),
      domains: DA_DOMAINS
    },
    kpis: kpis,
    domainAvgs: domainAvgs,
    deptAvgs: deptAvgs,
    schoolAvgs: schoolAvgs,
    distribution: distribution,
    topPerformers: topBottom.top,
    bottomPerformers: topBottom.bottom,
    deptDomainMatrix: deptDomainMatrix,
    insights: insights,
    rows: rows // full raw for table (88 rows is fine)
  };
}

/**
 * Filtered view - client sends filters, server re-filters without recomputing all.
 * Keeps isolation - just filters the 88 rows.
 */
function getHistoricalAnalyticsFiltered(filters) {
  filters = filters || {};
  var all = getHistoricalAnalytics();
  if (all.error) return all;
  var dept = (filters.department || '').toString().trim();
  var school = (filters.school || '').toString().trim();
  var search = (filters.search || '').toString().trim().toLowerCase();
  var filtered = all.rows.filter(function(r){
    if (dept && r.Department !== dept) return false;
    if (school && r.School !== school) return false;
    if (search && r.Name.toLowerCase().indexOf(search)===-1 && String(r.TID).indexOf(search)===-1) return false;
    return true;
  });
  // Recalc only filtered KPIs quickly on client - server returns filtered rows
  return {
    filteredCount: filtered.length,
    rows: filtered
  };
}

/**
 * Helper - distinct filter values for dropdowns
 */
function getHistoricalFilterOptions() {
  var rows = _readHistoricalRows();
  var depts = {}, schools = {};
  for (var i=0;i<rows.length;i++){
    depts[rows[i].Department]=true;
    schools[rows[i].School]=true;
  }
  return {
    departments: Object.keys(depts).sort(),
    schools: Object.keys(schools).sort()
  };
}

// ── Internal Readers ──────────────────────────────────────────

function _readHistoricalRows() {
  // 1) Try HistoricalData sheet in TARGET DB first (isolated, no external dependency)
  try {
    var db = AppUtils.getDB();
    var sh2 = db.getSheetByName('HistoricalData');
    if (sh2 && sh2.getLastRow() > 1) {
      var d2 = sh2.getDataRange().getValues();
      var h2 = d2[0].map(function(h){return (h||'').toString().trim();});
      var iTID=d2? h2.indexOf('TID'):-1, iName=h2.indexOf('Name'), iDept=h2.indexOf('Department'), iSchool=h2.indexOf('School'), iCA=h2.indexOf('CA'), iTP=h2.indexOf('TP'), iAE=h2.indexOf('AE'), iPS=h2.indexOf('PS'), iET=h2.indexOf('ET'), iLR=h2.indexOf('LR'), iTotal=h2.indexOf('Total');
      if (iDept===-1) iDept = h2.indexOf('subject');
      if (iDept===-1) iDept = 2;
      if (iSchool===-1) iSchool = 3;
      var rows=[];
      for (var r=1;r<d2.length;r++){
        var tid = d2[r][iTID];
        if (tid===''||tid===null||tid===undefined) continue;
        var row = {
          TID: tid,
          Name: (d2[r][iName]||'').toString().trim(),
          Department: (d2[r][iDept]||'').toString().trim() || '—',
          School: AppUtils.normalizeSchool((d2[r][iSchool]||'').toString()) || '—',
          CA: _toNum(d2[r][iCA]),
          TP: _toNum(d2[r][iTP]),
          AE: _toNum(d2[r][iAE]),
          PS: _toNum(d2[r][iPS]),
          ET: _toNum(d2[r][iET]),
          LR: _toNum(d2[r][iLR]),
          Total: _toNum(d2[r][iTotal])
        };
        if (!row.Total) row.Total = (row.CA+row.TP+row.AE+row.PS+row.ET+row.LR)/6;
        ['CA','TP','AE','PS','ET','LR','Total'].forEach(function(k){ if(row[k]>1) row[k]=row[k]/100; });
        rows.push(row);
      }
      if (rows.length) return rows;
    }
  } catch(e2){}

  // 2) Try external source if configured
  if (HISTORICAL_SOURCE_ID) {
    try {
      var ss = SpreadsheetApp.openById(HISTORICAL_SOURCE_ID);
      var sh = ss.getSheetByName(HISTORICAL_SHEET_NAME);
      if (!sh) sh = ss.getSheets()[0];
      var data = sh.getDataRange().getValues();
      if (data.length < 2) return [];
      var headers = data[0].map(function(h){ return (h||'').toString().trim(); });
      var iTID = headers.indexOf('TID');
      var iName = headers.indexOf('Name');
      var iDept = headers.indexOf('Department');
      var iSchool = headers.indexOf('School');
      var iCA = headers.indexOf('CA');
      var iTP = headers.indexOf('TP');
      var iAE = headers.indexOf('AE');
      var iPS = headers.indexOf('PS');
      var iET = headers.indexOf('ET');
      var iLR = headers.indexOf('LR');
      var iTotal = headers.indexOf('Total');
      if (iDept===-1) iDept = headers.indexOf('subject');
      if (iDept===-1) iDept = 2;
      if (iSchool===-1) iSchool = 3;
      var rows=[];
      for (var r=1;r<data.length;r++){
        var tid = data[r][iTID];
        if (tid===''||tid===null||tid===undefined) continue;
        var row = {
          TID: tid,
          Name: (data[r][iName]||'').toString().trim(),
          Department: (data[r][iDept]||'').toString().trim() || '—',
          School: AppUtils.normalizeSchool((data[r][iSchool]||'').toString()) || '—',
          CA: _toNum(data[r][iCA]),
          TP: _toNum(data[r][iTP]),
          AE: _toNum(data[r][iAE]),
          PS: _toNum(data[r][iPS]),
          ET: _toNum(data[r][iET]),
          LR: _toNum(data[r][iLR]),
          Total: _toNum(data[r][iTotal])
        };
        if (!row.Total) row.Total = (row.CA+row.TP+row.AE+row.PS+row.ET+row.LR)/6;
        ['CA','TP','AE','PS','ET','LR','Total'].forEach(function(k){ if(row[k]>1) row[k]=row[k]/100; });
        rows.push(row);
      }
      return rows;
    } catch(e) {}
  }
  return [];
}

// ── ONE-TIME IMPORT: Historical Data reference ──
function importHistoricalFromDrive() {
  return 'Historical data is already linked directly via HISTORICAL_SOURCE_ID.';
}

// Manual fallback: paste a Google Sheet ID directly
function importHistoricalFromSheetId(sheetId) {
  if (!sheetId) return 'Usage: importHistoricalFromSheetId("YOUR_GOOGLE_SHEET_ID")';
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var data = sh.getDataRange().getValues();
  var db = AppUtils.getDB();
  var target = db.getSheetByName('HistoricalData');
  if (!target) target = db.insertSheet('HistoricalData');
  target.clearContents();
  var headers = data[0].map(function(h){return (h||'').toString().trim();}).slice(0,11);
  target.getRange(1,1,1,headers.length).setValues([headers]);
  var hr = target.getRange(1,1,1,headers.length);
  hr.setBackground('#1e293b'); hr.setFontColor('#FFFFFF'); hr.setFontWeight('bold'); hr.setFontSize(10);
  target.setFrozenRows(1);
  var rows = data.slice(1).filter(function(r){ return r[0]!=='' && r[0]!==null && r[0]!==undefined; });
  if (rows.length) target.getRange(2,1,rows.length, headers.length).setValues(rows.map(function(r){return r.slice(0,headers.length);}));
  target.autoResizeColumns(1, headers.length);
  return 'Imported '+rows.length+' rows from sheet '+sheetId;
}

function _toNum(v){
  if(v===''||v===null||v===undefined) return 0;
  var n=parseFloat(v);
  return isNaN(n)?0:n;
}

// ── Aggregations (pure functions, no sheet writes) ──────────

function _calcKPIs(rows){
  var n=rows.length;
  var avgTotal=0, avgCA=0, avgTP=0, avgAE=0, avgPS=0, avgET=0, avgLR=0;
  for(var i=0;i<n;i++){ avgTotal+=rows[i].Total; avgCA+=rows[i].CA; avgTP+=rows[i].TP; avgAE+=rows[i].AE; avgPS+=rows[i].PS; avgET+=rows[i].ET; avgLR+=rows[i].LR; }
  avgTotal/=n; avgCA/=n; avgTP/=n; avgAE/=n; avgPS/=n; avgET/=n; avgLR/=n;
  var excellent=0, good=0, average=0, poor=0;
  for(var i=0;i<n;i++){
    var t=rows[i].Total;
    if(t>=0.85) excellent++; else if(t>=0.70) good++; else if(t>=0.50) average++; else poor++;
  }
  var sorted=[].concat(rows).sort(function(a,b){return b.Total-a.Total;});
  return {
    totalTeachers: n,
    overallAvg: parseFloat(avgTotal.toFixed(4)),
    overallAvg5: parseFloat((avgTotal*5).toFixed(2)),
    overallAvgPct: parseFloat((avgTotal*100).toFixed(1)),
    domainMeans: { CA:avgCA, TP:avgTP, AE:avgAE, PS:avgPS, ET:avgET, LR:avgLR },
    distributionCounts: { excellent:excellent, good:good, average:average, poor:poor },
    bestTeacher: sorted[0] ? { Name:sorted[0].Name, Total:sorted[0].Total, Department:sorted[0].Department, School:sorted[0].School } : null,
    weakestTeacher: sorted[sorted.length-1] ? { Name:sorted[sorted.length-1].Name, Total:sorted[sorted.length-1].Total } : null
  };
}

function _calcDomainAvgs(rows){
  var sums={CA:0,TP:0,AE:0,PS:0,ET:0,LR:0}, n=rows.length;
  for(var i=0;i<n;i++){ sums.CA+=rows[i].CA; sums.TP+=rows[i].TP; sums.AE+=rows[i].AE; sums.PS+=rows[i].PS; sums.ET+=rows[i].ET; sums.LR+=rows[i].LR; }
  var out=[];
  DA_DOMAINS.forEach(function(d){
    var avg=sums[d.code]/n;
    out.push({ code:d.code, label:d.label, full:d.full, avg:parseFloat(avg.toFixed(4)), avg5:parseFloat((avg*5).toFixed(2)), pct:parseFloat((avg*100).toFixed(1)) });
  });
  out.sort(function(a,b){return b.avg-a.avg;});
  return out;
}

function _calcDeptAvgs(rows){
  var map={};
  for(var i=0;i<rows.length;i++){
    var r=rows[i], k=r.Department;
    if(!map[k]) map[k]={ sum:0, count:0, CA:0,TP:0,AE:0,PS:0,ET:0,LR:0 };
    map[k].sum+=r.Total; map[k].count++; map[k].CA+=r.CA; map[k].TP+=r.TP; map[k].AE+=r.AE; map[k].PS+=r.PS; map[k].ET+=r.ET; map[k].LR+=r.LR;
  }
  var arr=[];
  for(var k in map){
    var m=map[k];
    arr.push({
      department:k, count:m.count, avg:parseFloat((m.sum/m.count).toFixed(4)), avg5:parseFloat(((m.sum/m.count)*5).toFixed(2)), pct:parseFloat(((m.sum/m.count)*100).toFixed(1)),
      domains:{ CA:m.CA/m.count, TP:m.TP/m.count, AE:m.AE/m.count, PS:m.PS/m.count, ET:m.ET/m.count, LR:m.LR/m.count }
    });
  }
  arr.sort(function(a,b){return b.avg-a.avg;});
  return arr;
}

function _calcSchoolAvgs(rows){
  var map={};
  for(var i=0;i<rows.length;i++){
    var r=rows[i], k=r.School;
    if(!map[k]) map[k]={ sum:0, count:0 };
    map[k].sum+=r.Total; map[k].count++;
  }
  var arr=[];
  for(var k in map){
    arr.push({ school:k, count:map[k].count, avg:parseFloat((map[k].sum/map[k].count).toFixed(4)), avg5:parseFloat(((map[k].sum/map[k].count)*5).toFixed(2)), pct:parseFloat(((map[k].sum/map[k].count)*100).toFixed(1)) });
  }
  arr.sort(function(a,b){return b.avg-a.avg;});
  return arr;
}

function _calcDistribution(rows){
  var buckets={ 'ممتاز (≥85%)':0, 'جيد (70-85%)':0, 'مقبول (50-70%)':0, 'ضعيف (<50%)':0 };
  for(var i=0;i<rows.length;i++){
    var t=rows[i].Total;
    if(t>=0.85) buckets['ممتاز (≥85%)']++; else if(t>=0.70) buckets['جيد (70-85%)']++; else if(t>=0.50) buckets['مقبول (50-70%)']++; else buckets['ضعيف (<50%)']++;
  }
  return buckets;
}

function _calcTopBottom(rows){
  var sorted=[].concat(rows).sort(function(a,b){return b.Total-a.Total;});
  return {
    top: sorted.slice(0,10).map(function(r,i){ return { rank:i+1, TID:r.TID, Name:r.Name, Department:r.Department, School:r.School, Total:r.Total, Total5:parseFloat((r.Total*5).toFixed(2)), pct:parseFloat((r.Total*100).toFixed(1)) }; }),
    bottom: sorted.slice(-10).reverse().map(function(r,i){ return { rank:sorted.length-i, TID:r.TID, Name:r.Name, Department:r.Department, School:r.School, Total:r.Total, Total5:parseFloat((r.Total*5).toFixed(2)), pct:parseFloat((r.Total*100).toFixed(1)) }; })
  };
}

function _calcDeptDomainMatrix(rows){
  var depts=_calcDeptAvgs(rows);
  // return matrix for heatmap
  return depts.map(function(d){
    return { department:d.department, count:d.count, avg:d.avg, domains:d.domains };
  });
}

function _generateInsights(rows, domainAvgs, deptAvgs, schoolAvgs, dist){
  var insights=[];
  // Weakest domain
  var weakest = domainAvgs[domainAvgs.length-1];
  var strongest = domainAvgs[0];
  insights.push({ type:'warning', title:'أضعف مجال: '+weakest.label+' ('+weakest.code+')', text:'بمتوسط '+weakest.pct+'% (عدد المعلمين '+rows.length+') — الأدنى بين المجالات الستة، ويحتاج إلى تدريب موجّه. الأقوى هو '+strongest.label+' بنسبة '+strongest.pct+'%.' });
  // Dept gap
  if(deptAvgs.length){
    var best=deptAvgs[0], worst=deptAvgs[deptAvgs.length-1];
    var gap = ((best.avg - worst.avg)*100).toFixed(1);
    insights.push({ type:'info', title:'أكبر فجوة بين الأقسام: '+gap+' نقطة مئوية', text: best.department+' ('+best.pct+'% — عدد '+best.count+') مقابل '+worst.department+' ('+worst.pct+'% — عدد '+worst.count+') — يُنصح بإعطاء أولوية الدعم والتدريب لقسم '+worst.department+'.' });
  }
  // School gap
  if(schoolAvgs.length){
    var bs=schoolAvgs[0], ws=schoolAvgs[schoolAvgs.length-1];
    insights.push({ type:'info', title:'مدى أداء المدارس', text: 'تتصدر مدرسة '+bs.school+' بمتوسط '+bs.pct+'% (عدد '+bs.count+') بينما تأتي '+ws.school+' في المؤخرة بمتوسط '+ws.pct+'% (عدد '+ws.count+').' });
  }
  // Distribution
  var total=rows.length;
  var excPct = ((dist['ممتاز (≥85%)']/total)*100).toFixed(1);
  var poorPct = ((dist['ضعيف (<50%)']/total)*100).toFixed(1);
  insights.push({ type: poorPct>5?'danger':'success', title:'توزيع المستويات: '+excPct+'% في المستوى الممتاز', text: dist['ممتاز (≥85%)']+' ممتاز، '+dist['جيد (70-85%)']+' جيد، '+dist['مقبول (50-70%)']+' مقبول، '+dist['ضعيف (<50%)']+' ضعيف. ' + (parseFloat(poorPct)>5?'يلزم تدخل عاجل لمعالجة المستوى الضعيف.':'التوزيع صحي بشكل عام.') });
  // Sadat anomaly
  var sadat = schoolAvgs.filter(function(s){return s.school==='Sadat';})[0];
  if(sadat && sadat.pct < 70) insights.push({ type:'warning', title:'تنبيه: مدرسة Sadat', text:'تضم 20 معلماً لكن متوسطها هو الأدنى ('+sadat.pct+'%) — وتحتوي على 4 من أصل 5 معلمين الأقل أداءً. يُنصح بجلسات تدريب مركزة ودعم مصادر التعلم (أضعف مجال على مستوى الأكاديمية).' });
  return insights;
}

// ── Optional: Snapshot HistoricalData into target DB (one-time, isolated) ─────
function snapshotHistoricalToTargetDB(){
  var rows=_readHistoricalRows();
  if(!rows.length) return 'No source data';
  var db=AppUtils.getDB();
  var sh=db.getSheetByName('HistoricalData');
  if(!sh) sh=db.insertSheet('HistoricalData');
  sh.clearContents();
  var headers=['TID','Name','Department','School','CA','TP','AE','PS','ET','LR','Total','Total_5','Pct'];
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  var hr=sh.getRange(1,1,1,headers.length);
  hr.setBackground('#1e293b'); hr.setFontColor('#FFFFFF'); hr.setFontWeight('bold'); hr.setFontSize(10);
  sh.setFrozenRows(1);
  var data=rows.map(function(r){ return [r.TID,r.Name,r.Department,r.School,r.CA,r.TP,r.AE,r.PS,r.ET,r.LR,r.Total, parseFloat((r.Total*5).toFixed(2)), parseFloat((r.Total*100).toFixed(1)) ]; });
  if(data.length) sh.getRange(2,1,data.length,data[0].length).setValues(data);
  // Auto-fit
  sh.autoResizeColumns(1, headers.length);
  return 'Snapshot done: '+rows.length+' rows to HistoricalData (isolated, dashboard untouched)';
}

// ── Page loader (called from Index.html router) — handles DataAnalytics / DataAnalyticss typo ──
function getDataAnalyticsPage(){
  try {
    return HtmlService.createHtmlOutputFromFile('DataAnalytics').getContent();
  } catch(e) {
    // Fallback for duplicate file DataAnalyticss.html (extra s)
    return HtmlService.createHtmlOutputFromFile('DataAnalyticss').getContent();
  }
}

