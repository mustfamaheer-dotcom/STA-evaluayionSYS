# STA Evaluation System - Architecture Documentation

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Index.html (UI)                       │  │
│  │  • Dashboard with charts                                  │  │
│  │  • Evaluation form                                        │  │
│  │  • Management forms                                       │  │
│  │  • Client-side caching (_dropCache)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↕ HTTPS                              │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE APPS SCRIPT                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    code.gs (Entry Point)                  │  │
│  │  • doGet() - Web app handler                             │  │
│  │  • Client-facing aliases                                  │  │
│  │  • Generic table operations                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↕                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Utilities.gs (Caching Layer)                 │  │
│  │  • _ss: Spreadsheet instance cache                       │  │
│  │  • _sheetCache: Sheet data cache                         │  │
│  │  • _tz: Timezone cache                                    │  │
│  │  • sheetToObjects() - Cached reads                       │  │
│  │  • invalidate() - Cache clearing                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↕                                     │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐ │
│  │  Auth.gs    │ Permissions │ Employee.gs │  Evaluation.gs  │ │
│  │             │    .gs      │             │                 │ │
│  │ • Profile   │ • Guard     │ • Active    │ • Submit eval   │ │
│  │   cache     │   require() │   employees │ • Dashboard     │ │
│  │ • Role      │ • Guard     │ • Profile   │   stats         │ │
│  │   resolver  │   check()   │   lookup    │ • Questions     │ │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘ │
│                            ↕                                     │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                      GOOGLE SHEETS                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Employees | Managers | Departments | Classes | Subjects │  │
│  │  Questions | Evaluations | EvaluationAnswers | Roles     │  │
│  │  Logs                                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. User Authentication Flow

```
┌──────────┐
│  User    │
│ Opens    │
│ Web App  │
└────┬─────┘
     │
     ↓
┌────────────────────────────────────────┐
│ code.gs: doGet()                       │
│ • Returns Index.html                   │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Index.html: boot()                     │
│ • Calls getUserRolesAndPermissions()   │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Auth.gs: getUserProfile()              │
│ • Gets Session.getActiveUser().email   │
│ • Checks _profileCache                 │
│ • If not cached:                       │
│   - Reads Managers sheet (cached)      │
│   - Resolves role                      │
│   - Reads Roles sheet (cached)         │
│   - Resolves permissions               │
│   - Caches profile                     │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Index.html: boot(profile)              │
│ • Displays user email & role           │
│ • Builds navigation menu               │
│ • Loads default module                 │
└────────────────────────────────────────┘
```

---

### 2. Evaluation Submission Flow

```
┌──────────────────────────────────────────────────────────────┐
│ USER ACTIONS                                                  │
└──────────────────────────────────────────────────────────────┘
     │
     ↓ 1. Select Instructor
┌────────────────────────────────────────┐
│ Index.html: onEmpChange()              │
│ • Calls getEmployeeProfile(id)         │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Employee.gs: getEmployeeProfile()      │
│ • Reads Employees sheet (cached)       │
│ • Reads Departments sheet (cached)     │
│ • Returns profile with dept name       │
└────┬───────────────────────────────────┘
     │
     ↓ 2. Select Department
┌────────────────────────────────────────┐
│ Index.html: onDeptChange()             │
│ • Checks _dropCache['Classes']         │
│ • If cached: filters client-side       │
│ • If not: calls getRowsFromTable()     │
└────┬───────────────────────────────────┘
     │
     ↓ 3. Select Class
┌────────────────────────────────────────┐
│ Index.html: onClassChange()            │
│ • Checks _dropCache['Subjects']        │
│ • If cached: filters client-side       │
│ • If not: calls getRowsFromTable()     │
└────┬───────────────────────────────────┘
     │
     ↓ 4. Select Grade & Semester
┌────────────────────────────────────────┐
│ Index.html: validateCtx()              │
│ • Checks all context fields filled     │
│ • Renders questions section            │
│ • Uses globalQuestionsCached           │
└────┬───────────────────────────────────┘
     │
     ↓ 5. Rate All Questions
┌────────────────────────────────────────┐
│ Index.html: rateStar()                 │
│ • Updates star visual                  │
│ • Stores rating in data attribute      │
│ • Updates score label                  │
└────┬───────────────────────────────────┘
     │
     ↓ 6. Click Submit
┌────────────────────────────────────────┐
│ Index.html: submitEval()               │
│ • Validates all questions rated        │
│ • Builds payload with ratings          │
│ • Calls saveEvaluationSubmission()     │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ code.gs: saveEvaluationSubmission()    │
│ • Maps payload to submitEvaluation()   │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Evaluation.gs: submitEvaluation()      │
│ • Acquires LockService                 │
│ • Checks permission (cached)           │
│ • Calculates weighted average          │
│ • Writes to Evaluations sheet          │
│ • Batch writes to EvaluationAnswers    │
│ • Invalidates cache                    │
│ • Logs operation                       │
│ • Releases lock                        │
│ • Returns success + eval ID            │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Index.html: Success handler            │
│ • Shows success modal                  │
│ • Redirects to dashboard               │
└────────────────────────────────────────┘
```

---

### 3. Dashboard Load Flow

```
┌──────────────────────────────────────────────────────────────┐
│ USER CLICKS "DASHBOARD"                                       │
└──────────────────────────────────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Index.html: loadModule('dashboard')    │
│ • Checks permission                    │
│ • Renders skeleton UI                  │
│ • Calls getDashboardStats()            │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Evaluation.gs: getDashboardStats()     │
│ • Checks permission (cached)           │
│ • Reads 4 sheets (all cached):         │
│   - Evaluations                        │
│   - Employees                          │
│   - Questions                          │
│   - Departments                        │
│ • Single pass over evaluations:        │
│   - Calculates totals                  │
│   - Builds score buckets               │
│   - Aggregates by employee             │
│   - Aggregates by department           │
│   - Counts by semester                 │
│ • Sorts top 5 employees                │
│ • Sorts department averages            │
│ • Extracts recent 8 evaluations        │
│ • Returns complete stats object        │
└────┬───────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────┐
│ Index.html: renderDashboard(stats)     │
│ • Renders 4 KPI cards                  │
│ • Renders score distribution chart     │
│ • Renders SVG gauge                    │
│ • Renders semester breakdown           │
│ • Renders top performers table         │
│ • Renders department averages          │
│ • Renders recent evaluations table     │
└────────────────────────────────────────┘
```

---

## 🔄 Caching Strategy

### Backend Cache (Per Execution)

```
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTION STARTS                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Utilities.gs: AppUtils                                       │
│                                                              │
│  _ss: null                    ← Spreadsheet instance cache  │
│  _sheetCache: {}              ← Sheet data cache            │
│  _tz: null                    ← Timezone cache              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ First Call: AppUtils.getDB()                                 │
│  • _ss is null                                              │
│  • Calls SpreadsheetApp.openById()  ← EXPENSIVE             │
│  • Stores in _ss                                            │
│  • Returns _ss                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Subsequent Calls: AppUtils.getDB()                           │
│  • _ss is not null                                          │
│  • Returns _ss immediately         ← FREE                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ First Call: AppUtils.sheetToObjects('Employees')             │
│  • Calls _getRawData('Employees')                           │
│  • _sheetCache['Employees'] is undefined                    │
│  • Calls sheet.getDataRange().getValues()  ← EXPENSIVE      │
│  • Stores in _sheetCache['Employees']                       │
│  • Converts to objects                                      │
│  • Returns array                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Subsequent Calls: AppUtils.sheetToObjects('Employees')       │
│  • Calls _getRawData('Employees')                           │
│  • _sheetCache['Employees'] exists                          │
│  • Returns cached data immediately     ← FREE               │
│  • Converts to objects (fast)                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ After Write: AppUtils.invalidate('Employees')                │
│  • Deletes _sheetCache['Employees']                         │
│  • Next read will fetch fresh data                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTION ENDS                            │
│  • All caches cleared automatically                         │
│  • Next execution starts fresh                              │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Cache (Per Session)

```
┌─────────────────────────────────────────────────────────────┐
│                    PAGE LOADS                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Index.html: Global Variables                                 │
│                                                              │
│  _dropCache: {}           ← Dropdown data cache             │
│  globalEmployeesCached: [] ← Employees cache                │
│  globalQuestionsCached: [] ← Questions cache                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ First Call: loadDeptSelect('eval-dept')                      │
│  • Calls _loadSelect('eval-dept', 'Departments', ...)       │
│  • _dropCache['Departments'] is undefined                   │
│  • Shows "Loading..." in dropdown                           │
│  • Calls getRowsFromTable('Departments')  ← SERVER CALL     │
│  • Stores result in _dropCache['Departments']               │
│  • Fills dropdown                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Second Call: loadDeptSelect('ins-dept')                      │
│  • Calls _loadSelect('ins-dept', 'Departments', ...)        │
│  • _dropCache['Departments'] exists                         │
│  • Fills dropdown immediately          ← NO SERVER CALL     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ After Write: invalidateDropCache('Departments')              │
│  • Deletes _dropCache['Departments']                        │
│  • Next load will fetch fresh data                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Filtered Dropdowns: onDeptChange(deptId)                     │
│  • Checks _dropCache['Classes']                             │
│  • If exists: filters client-side      ← NO SERVER CALL     │
│  • If not: fetches and caches                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    PAGE REFRESH                              │
│  • All caches cleared                                       │
│  • Next session starts fresh                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Architecture

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│ User opens web app URL                                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Google OAuth                                                  │
│ • User must be logged into Google account                    │
│ • Session.getActiveUser() returns email                      │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Auth.gs: getUserProfile()                                     │
│ • Looks up email in Managers sheet                           │
│ • If found + Active: returns role                            │
│ • If not found: returns 'Instructor' (default)               │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Auth.gs: _resolvePermissions(role)                            │
│ • Looks up role in Roles sheet                               │
│ • Returns array of permissions                               │
│ • Fallback to hardcoded permissions if sheet empty           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Profile cached for execution                                  │
│ { email, role, permissions: [...] }                          │
└──────────────────────────────────────────────────────────────┘
```

### Authorization Flow

```
┌──────────────────────────────────────────────────────────────┐
│ User attempts action (e.g., submit evaluation)                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Server-side function called                                   │
│ (e.g., submitEvaluation)                                      │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ PermissionGuard.require(email, 'canEvaluate')                 │
│ • Gets profile from cache (or builds it)                     │
│ • Checks if 'canEvaluate' in permissions array               │
│ • If yes: continues                                          │
│ • If no: throws "Access denied" error                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Action proceeds                                               │
└──────────────────────────────────────────────────────────────┘
```

### Client-Side UI Control

```
┌──────────────────────────────────────────────────────────────┐
│ Index.html: boot(profile)                                     │
│ • Receives profile with permissions array                    │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Build navigation menu                                         │
│                                                              │
│ if (permissions.includes('canViewDashboard'))                │
│   → Show Dashboard menu item                                 │
│                                                              │
│ if (permissions.includes('canEvaluate'))                     │
│   → Show Perform Evaluation menu item                        │
│                                                              │
│ if (permissions.includes('canManageSystem'))                 │
│   → Show Management section                                  │
│   → Show Add Question, Add Dept, etc.                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ User only sees authorized features                            │
│ • Cannot access hidden features via URL manipulation         │
│ • Server-side checks enforce security                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│   Departments   │
│─────────────────│
│ department_id PK│◄──┐
│ department_name │   │
│ status          │   │
│ created_at      │   │
└─────────────────┘   │
                      │
                      │ FK
┌─────────────────┐   │
│    Classes      │   │
│─────────────────│   │
│ class_id PK     │◄──┼──┐
│ class_name      │   │  │
│ department_id FK├───┘  │
│ status          │      │
│ created_at      │      │
└─────────────────┘      │
                         │ FK
┌─────────────────┐      │
│    Subjects     │      │
│─────────────────│      │
│ subject_id PK   │      │
│ subject_name    │      │
│ class_id FK     ├──────┘
│ status          │
│ created_at      │
└─────────────────┘

┌─────────────────┐
│   Employees     │
│─────────────────│
│ employee_id PK  │◄──┐
│ name            │   │
│ email           │   │
│ department_id FK├───┼──┐
│ school_branch   │   │  │
│ position        │   │  │
│ status          │   │  │
│ created_at      │   │  │
└─────────────────┘   │  │
                      │  │
                      │  │ FK (display name stored)
┌─────────────────┐   │  │
│  Evaluations    │   │  │
│─────────────────│   │  │
│ evaluation_id PK│   │  │
│ manager_email   │   │  │
│ employee_id FK  ├───┘  │
│ subject_name    │      │
│ class_name      │      │
│ grade_level     │      │
│ semester        │      │
│ avg_score       │      │
│ notes           │      │
│ submitted_at    │      │
└────────┬────────┘      │
         │               │
         │ FK            │
         ↓               │
┌─────────────────┐      │
│EvaluationAnswers│      │
│─────────────────│      │
│ answer_id PK    │      │
│ evaluation_id FK│      │
│ question_id FK  ├──┐   │
│ rating          │  │   │
│ weight          │  │   │
│ weighted_score  │  │   │
└─────────────────┘  │   │
                     │   │
                     │   │
┌─────────────────┐  │   │
│   Questions     │  │   │
│─────────────────│  │   │
│ question_id PK  │◄─┘   │
│ category        │      │
│ question_text   │      │
│ weight          │      │
│ status          │      │
│ created_at      │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│    Managers     │      │
│─────────────────│      │
│ manager_id PK   │      │
│ name            │      │
│ email           │      │
│ role_id FK      ├──┐   │
│ status          │  │   │
│ created_at      │  │   │
└─────────────────┘  │   │
                     │   │
                     │ FK│
┌─────────────────┐  │   │
│     Roles       │  │   │
│─────────────────│  │   │
│ role            │◄─┘   │
│ permission      │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│      Logs       │      │
│─────────────────│      │
│ log_id PK       │      │
│ timestamp       │      │
│ user_email      │      │
│ action          │      │
│ module          │      │
│ details         │      │
│ status          │      │
└─────────────────┘      │
```

---

## 🚀 Performance Optimization Summary

### Before Optimization

```
Request: Submit Evaluation
├─ SpreadsheetApp.openById()  ← 1st call (Evaluation.gs)
├─ SpreadsheetApp.openById()  ← 2nd call (Auth.gs)
├─ SpreadsheetApp.openById()  ← 3rd call (Permissions.gs)
├─ Read Managers sheet
├─ Read Roles sheet
├─ SpreadsheetApp.openById()  ← 4th call (Evaluation.gs)
├─ Read Evaluations headers
├─ Validate headers
├─ Write evaluation row
├─ appendRow() for answer 1
├─ appendRow() for answer 2
├─ appendRow() for answer 3
├─ appendRow() for answer 4
├─ appendRow() for answer 5
└─ Write log

Total: ~15 operations, 4 spreadsheet opens
Time: ~3-4 seconds
```

### After Optimization

```
Request: Submit Evaluation
├─ SpreadsheetApp.openById()  ← ONLY call (cached)
├─ Read Managers sheet (cached)
├─ Read Roles sheet (cached)
├─ Write evaluation row
├─ setValues() for all 5 answers (batch)
├─ Invalidate cache
└─ Write log (async, never blocks)

Total: ~7 operations, 1 spreadsheet open
Time: ~1-1.5 seconds
Improvement: 60-70% faster
```

---

## 📈 Scalability Considerations

### Current Limits

| Resource | Limit | Current Usage | Headroom |
|----------|-------|---------------|----------|
| Execution time | 6 min | ~2 sec | 99% |
| Spreadsheet reads | Unlimited | ~10/request | Excellent |
| Spreadsheet writes | Unlimited | ~3/request | Excellent |
| Concurrent users | ~20 | Variable | Good |
| Sheet rows | 10M | <1000 | Excellent |

### Scaling Strategies

**For 100+ concurrent users:**
- Consider Google Cloud SQL for data storage
- Implement queue system for writes
- Add read replicas

**For 100K+ evaluations:**
- Archive old evaluations to separate sheet
- Implement pagination on dashboard
- Add date range filters

**For 1000+ questions:**
- Implement question categories
- Add question search/filter
- Paginate question list

---

## 🎯 Key Design Decisions

### 1. Why Apps Script?
- ✅ Native Google Sheets integration
- ✅ No server infrastructure needed
- ✅ Built-in authentication
- ✅ Free hosting
- ✅ Easy deployment

### 2. Why Client-Side Caching?
- ✅ Reduces server calls
- ✅ Instant dropdown loads
- ✅ Better user experience
- ✅ Lower quota usage

### 3. Why Display Names in Evaluations?
- ✅ Simpler queries (no joins)
- ✅ Historical accuracy (if dept renamed)
- ✅ Faster dashboard calculations
- ❌ Slight data redundancy (acceptable tradeoff)

### 4. Why Weighted Averages?
- ✅ Flexible question importance
- ✅ More accurate scoring
- ✅ Customizable per question
- ✅ Industry standard

### 5. Why Role-Based Access?
- ✅ Security by design
- ✅ Flexible permissions
- ✅ Easy to extend
- ✅ Audit-friendly

---

*Last Updated: May 17, 2026*
