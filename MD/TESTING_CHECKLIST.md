# STA Evaluation System - Testing Checklist

## ✅ Pre-Deployment Checklist

### 1. Apps Script Setup
- [ ] All `.gs` files uploaded to Apps Script project
- [ ] All `.html` files uploaded to Apps Script project
- [ ] `setupSheetHeaders()` function executed successfully
- [ ] No syntax errors in Apps Script editor
- [ ] Script timezone set correctly (File > Project properties)

### 2. Spreadsheet Structure
- [ ] All required sheets exist:
  - [ ] Employees
  - [ ] Managers
  - [ ] Departments
  - [ ] Classes
  - [ ] Subjects
  - [ ] Questions
  - [ ] Evaluations (with correct headers)
  - [ ] EvaluationAnswers (with correct headers)
  - [ ] Roles
  - [ ] Logs
- [ ] Headers match expected format (see SYSTEM_STATUS.md)
- [ ] At least one row in each sheet with `status = Active`

### 3. Initial Data
- [ ] At least one department added
- [ ] At least one class added (linked to department)
- [ ] At least one subject added (linked to class)
- [ ] At least one employee added (linked to department)
- [ ] At least one manager added (your email, ROLE_SUPER_ADMIN)
- [ ] At least 5 questions added (status = Active)
- [ ] Roles sheet has permission mappings

### 4. Web App Deployment
- [ ] Deployed as web app
- [ ] Execute as: Me (your account)
- [ ] Who has access: Anyone
- [ ] Web app URL copied and saved
- [ ] Test URL opens without errors

---

## 🧪 Functional Testing

### Test 1: Authentication & Authorization
**Test Case:** User login and role detection
- [ ] Open web app URL
- [ ] System loads without errors
- [ ] User email displayed in sidebar footer
- [ ] Role displayed correctly (ROLE_SUPER_ADMIN, Manager, or Instructor)
- [ ] Navigation menu shows correct items based on role

**Expected Results:**
- ROLE_SUPER_ADMIN sees: Dashboard, Perform Evaluation, Add Question, Add Instructor, Add Department, Add Class, Add Subject, Add Manager
- Manager sees: Dashboard, Perform Evaluation, Add Instructor
- Instructor sees: Perform Evaluation only

---

### Test 2: Dashboard (ROLE_SUPER_ADMIN or Manager only)
**Test Case:** Dashboard loads and displays data
- [ ] Click "Dashboard" in sidebar
- [ ] Page title shows "Dashboard"
- [ ] 4 KPI cards display with correct values
- [ ] Score distribution chart renders
- [ ] Overall average gauge displays (0-5 scale)
- [ ] Semester breakdown shows data
- [ ] Top 5 performers list displays (if evaluations exist)
- [ ] Department averages list displays
- [ ] Recent evaluations table shows data (if evaluations exist)

**Expected Results:**
- All sections load without errors
- Numbers match actual data in spreadsheet
- Charts render correctly
- No "undefined" or "NaN" values

---

### Test 3: Perform Evaluation
**Test Case:** Submit a complete evaluation

#### Step 1: Select Instructor
- [ ] Click "Perform Evaluation" in sidebar
- [ ] Employee dropdown loads with active instructors
- [ ] Select an instructor from dropdown
- [ ] Profile card displays with correct data:
  - [ ] Name
  - [ ] Email
  - [ ] Department
  - [ ] Branch
  - [ ] Position

#### Step 2: Evaluation Context
- [ ] Department dropdown loads with active departments
- [ ] Select a department
- [ ] Class dropdown filters by selected department
- [ ] Select a class
- [ ] Subject dropdown filters by selected class
- [ ] Select a subject
- [ ] Grade dropdown shows: Grade 1, Grade 2, Grade 3
- [ ] Select a grade
- [ ] Semester dropdown shows: 1st Semester, 2nd Semester
- [ ] Select a semester

#### Step 3: Rate Questions
- [ ] Questions section appears after all context fields filled
- [ ] All active questions display
- [ ] Each question shows:
  - [ ] Category badge
  - [ ] Weight factor
  - [ ] Question text
  - [ ] 5-star rating (1-5)
- [ ] Click stars to rate each question
- [ ] Star rating updates visually
- [ ] "Not rated" changes to "X / 5"
- [ ] Question card border changes color when rated

#### Step 4: Submit
- [ ] Add notes in text area (optional)
- [ ] Click "Submit Evaluation"
- [ ] Button shows "Submitting..." during save
- [ ] Success modal appears with evaluation ID and average score
- [ ] Redirects to dashboard after clicking OK
- [ ] New evaluation appears in "Recent Evaluations" table
- [ ] Dashboard stats update (total evaluations +1)

**Expected Results:**
- Evaluation saved to Evaluations sheet
- Answers saved to EvaluationAnswers sheet
- Average score calculated correctly
- Manager email captured automatically
- Timestamp recorded

---

### Test 4: Add Question (ROLE_SUPER_ADMIN only)
**Test Case:** Add a new evaluation question
- [ ] Click "Add Question" in sidebar
- [ ] Form displays with fields:
  - [ ] Category dropdown (4 options)
  - [ ] Question text (textarea)
  - [ ] Weight factor (number, default 1.0)
- [ ] Fill in all fields
- [ ] Click "Save Question"
- [ ] Success modal appears
- [ ] Form resets
- [ ] New question appears in Questions sheet
- [ ] New question appears in evaluation form

**Expected Results:**
- Question saved with auto-generated ID
- Status set to "Active"
- Created_at timestamp recorded

---

### Test 5: Add Instructor (ROLE_SUPER_ADMIN or Manager)
**Test Case:** Register a new instructor
- [ ] Click "Add Instructor" in sidebar
- [ ] Form displays with fields:
  - [ ] Full Name
  - [ ] Email Address
  - [ ] Department (dropdown)
  - [ ] School Branch
  - [ ] Position Title
- [ ] Department dropdown loads active departments
- [ ] Fill in all fields
- [ ] Click "Register Instructor"
- [ ] Success modal appears
- [ ] Form resets
- [ ] New instructor appears in Employees sheet
- [ ] New instructor appears in evaluation form dropdown

**Expected Results:**
- Employee saved with auto-generated ID
- Status set to "Active"
- Department linked correctly

---

### Test 6: Add Department (ROLE_SUPER_ADMIN only)
**Test Case:** Create a new department
- [ ] Click "Add Department" in sidebar
- [ ] Form displays with field: Department Name
- [ ] Enter department name
- [ ] Click "Save Department"
- [ ] Success modal appears
- [ ] Form resets
- [ ] New department appears in Departments sheet
- [ ] New department appears in all department dropdowns
- [ ] Dropdown cache invalidated (new dept shows immediately)

**Expected Results:**
- Department saved with auto-generated ID
- Status set to "Active"
- Available in Add Instructor, Add Class forms

---

### Test 7: Add Class (ROLE_SUPER_ADMIN only)
**Test Case:** Create a new class
- [ ] Click "Add Class" in sidebar
- [ ] Form displays with fields:
  - [ ] Class Name
  - [ ] Department (dropdown)
- [ ] Department dropdown loads active departments
- [ ] Enter class name
- [ ] Select department
- [ ] Click "Save Class"
- [ ] Success modal appears
- [ ] Form resets
- [ ] New class appears in Classes sheet
- [ ] New class appears in evaluation form (filtered by department)
- [ ] Dropdown cache invalidated

**Expected Results:**
- Class saved with auto-generated ID
- Department_id linked correctly
- Status set to "Active"

---

### Test 8: Add Subject (ROLE_SUPER_ADMIN only)
**Test Case:** Create a new subject
- [ ] Click "Add Subject" in sidebar
- [ ] Form displays with fields:
  - [ ] Subject Name
  - [ ] Class (dropdown)
- [ ] Class dropdown loads active classes
- [ ] Enter subject name
- [ ] Select class
- [ ] Click "Save Subject"
- [ ] Success modal appears
- [ ] Form resets
- [ ] New subject appears in Subjects sheet
- [ ] New subject appears in evaluation form (filtered by class)

**Expected Results:**
- Subject saved with auto-generated ID
- Class_id linked correctly
- Status set to "Active"

---

### Test 9: Add Manager (ROLE_SUPER_ADMIN only)
**Test Case:** Create a new manager account
- [ ] Click "Add Manager" in sidebar
- [ ] Form displays with fields:
  - [ ] Full Name
  - [ ] Google Email
  - [ ] Role (dropdown: Instructor, Manager, ADMIN)
- [ ] Fill in all fields
- [ ] Click "Authorize Access"
- [ ] Success modal appears
- [ ] Form resets
- [ ] New manager appears in Managers sheet
- [ ] New user can log in with their Google account
- [ ] New user sees correct permissions based on role

**Expected Results:**
- Manager saved with auto-generated ID
- Status set to "Active"
- Role_id set correctly
- User can access system with their email

---

## 🚀 Performance Testing

### Test 10: Cache Performance
**Test Case:** Verify caching is working

#### Backend Cache
- [ ] Open Apps Script logs (View > Logs)
- [ ] Submit an evaluation
- [ ] Check logs for multiple `SpreadsheetApp.openById()` calls
- [ ] Should see only ONE call per execution

#### Frontend Cache
- [ ] Open browser console (F12)
- [ ] Navigate to "Add Class" form
- [ ] Department dropdown loads (server call)
- [ ] Navigate to "Add Instructor" form
- [ ] Department dropdown loads instantly (no server call)
- [ ] Check Network tab: no duplicate requests

**Expected Results:**
- Backend: Single spreadsheet instance per execution
- Frontend: Dropdowns load instantly after first fetch
- No redundant server calls

---

### Test 11: Dashboard Performance
**Test Case:** Dashboard loads quickly with large dataset

**Setup:** Add 50+ evaluations to test performance

- [ ] Navigate to Dashboard
- [ ] Page loads in < 5 seconds
- [ ] All charts render smoothly
- [ ] No browser lag or freezing
- [ ] Recent evaluations table shows last 8 only

**Expected Results:**
- Single-pass calculation handles large datasets
- No multiple iterations over same data
- Client-side rendering is smooth

---

## 🔒 Security Testing

### Test 12: Permission Enforcement
**Test Case:** Users cannot access unauthorized features

#### Test as Instructor Role
- [ ] Log in as user with role "Instructor"
- [ ] Dashboard menu item: NOT visible
- [ ] Add Question menu item: NOT visible
- [ ] Add Instructor menu item: NOT visible
- [ ] Management section: NOT visible
- [ ] Perform Evaluation: VISIBLE
- [ ] Try to access dashboard directly: Access Denied error

#### Test as Manager Role
- [ ] Log in as user with role "Manager"
- [ ] Dashboard menu item: VISIBLE
- [ ] Perform Evaluation: VISIBLE
- [ ] Add Instructor: VISIBLE
- [ ] Add Question: NOT visible
- [ ] Add Department/Class/Subject/Manager: NOT visible

**Expected Results:**
- Users only see features they have permission for
- Direct access attempts are blocked server-side
- Error messages are clear

---

### Test 13: Data Validation
**Test Case:** Invalid data is rejected

- [ ] Try to submit evaluation without rating all questions: Error modal
- [ ] Try to add class without selecting department: Error modal
- [ ] Try to add subject without selecting class: Error modal
- [ ] Try to add instructor with invalid email: Validation error
- [ ] Try to submit evaluation without selecting employee: Form validation

**Expected Results:**
- Client-side validation prevents submission
- Server-side validation catches edge cases
- Clear error messages guide user

---

## 📊 Data Integrity Testing

### Test 14: Evaluation Calculation
**Test Case:** Average score calculated correctly

**Setup:** Create evaluation with known ratings
- Question 1: Rating 5, Weight 1.0 → Weighted Score: 5.0
- Question 2: Rating 3, Weight 1.5 → Weighted Score: 4.5
- Question 3: Rating 4, Weight 1.0 → Weighted Score: 4.0

**Expected Average:** (5.0 + 4.5 + 4.0) / (1.0 + 1.5 + 1.0) = 13.5 / 3.5 = 3.86

- [ ] Submit evaluation with above ratings
- [ ] Check Evaluations sheet: avg_score = 3.86
- [ ] Check EvaluationAnswers sheet: 3 rows with correct weighted_score
- [ ] Dashboard shows correct average

**Expected Results:**
- Weighted average calculated correctly
- Individual weighted scores stored
- Dashboard reflects accurate data

---

### Test 15: Relational Integrity
**Test Case:** Foreign key relationships maintained

- [ ] Add department "Engineering"
- [ ] Add class "Grade 10" linked to "Engineering"
- [ ] Add subject "Physics" linked to "Grade 10"
- [ ] Perform evaluation selecting:
  - Department: Engineering
  - Class: Grade 10
  - Subject: Physics
- [ ] Check Evaluations sheet:
  - [ ] class_name = "Grade 10" (display name, not ID)
  - [ ] subject_name = "Physics" (display name, not ID)
- [ ] Dashboard shows correct department/class/subject names

**Expected Results:**
- Display names stored (not IDs)
- Relationships maintained
- No broken references

---

## 🌐 Browser Compatibility Testing

### Test 16: Cross-Browser Testing
**Test Case:** System works in multiple browsers

- [ ] **Chrome:** All features work
- [ ] **Firefox:** All features work
- [ ] **Safari:** All features work
- [ ] **Edge:** All features work
- [ ] **Mobile Chrome:** Responsive layout, all features work
- [ ] **Mobile Safari:** Responsive layout, all features work

**Expected Results:**
- Consistent behavior across browsers
- No CSS/JavaScript errors
- Mobile-friendly interface

---

## 📝 Logging & Audit Testing

### Test 17: Audit Trail
**Test Case:** All operations are logged

- [ ] Submit evaluation → Check Logs sheet: SUBMIT_EVAL entry
- [ ] Add department → Check Logs sheet: ADD_ROW entry
- [ ] Add instructor → Check Logs sheet: ADD_ROW entry
- [ ] Each log entry has:
  - [ ] log_id (auto-generated)
  - [ ] timestamp
  - [ ] user_email
  - [ ] action
  - [ ] module
  - [ ] details
  - [ ] status (SUCCESS or ERROR)

**Expected Results:**
- All operations logged
- User email captured
- Timestamps accurate
- Log failures don't crash system

---

## 🔄 Edge Case Testing

### Test 18: Empty Data Scenarios
**Test Case:** System handles missing data gracefully

- [ ] Dashboard with 0 evaluations: Shows "No data" messages
- [ ] Evaluation form with 0 employees: Shows warning message
- [ ] Evaluation form with 0 questions: Shows warning message
- [ ] Add Class with 0 departments: Dropdown shows "None found"
- [ ] Add Subject with 0 classes: Dropdown shows "None found"

**Expected Results:**
- No JavaScript errors
- Clear messages guide user
- System remains functional

---

### Test 19: Concurrent Users
**Test Case:** Multiple users can work simultaneously

- [ ] User A submits evaluation
- [ ] User B submits evaluation at same time
- [ ] Both evaluations saved successfully
- [ ] No data corruption
- [ ] Both users see updated dashboard

**Expected Results:**
- LockService prevents race conditions
- Both operations complete successfully
- Data integrity maintained

---

## ✅ Final Verification

### Pre-Launch Checklist
- [ ] All tests passed
- [ ] No console errors
- [ ] No Apps Script errors
- [ ] Sample data added for demo
- [ ] User accounts created
- [ ] Documentation reviewed
- [ ] Backup of spreadsheet created
- [ ] Web app URL shared with users
- [ ] Training materials prepared

---

## 🐛 Bug Report Template

If you find an issue, document it using this template:

```
**Bug Title:** [Short description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**


**Actual Result:**


**Browser/Device:**


**Screenshots:**


**Console Errors:**


**Additional Notes:**

```

---

## 📞 Support Contacts

- **Technical Issues:** Check Apps Script logs and browser console
- **Data Issues:** Review Logs sheet for error entries
- **Permission Issues:** Verify Managers and Roles sheets

---

*Last Updated: May 17, 2026*
