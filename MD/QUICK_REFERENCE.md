# STA Evaluation System - Quick Reference Guide

## 🚀 Quick Start

### First Time Setup
1. Open Apps Script editor
2. Run `setupSheetHeaders()` function (one time only)
3. Add yourself to Managers sheet with role `ROLE_SUPER_ADMIN`
4. Deploy as web app
5. Access the web app URL

---

## 🔑 Common Tasks

### Add a New Manager
**Sheet:** Managers  
**Columns to fill:**
```
manager_id:  (leave blank - auto-generated)
name:        John Doe
email:       john.doe@gmail.com
role_id:     Manager (or ROLE_SUPER_ADMIN)
status:      Active
created_at:  (leave blank - auto-generated)
```

### Add a New Instructor
**Option 1:** Use the web app (Add Instructor form)  
**Option 2:** Directly in Employees sheet:
```
employee_id:   (leave blank - auto-generated)
name:          Ahmed Mohamed
email:         ahmed@sta.edu.eg
department_id: dept-001 (must exist in Departments)
school_branch: Cairo Branch
position:      Senior Instructor
status:        Active
created_at:    (leave blank - auto-generated)
```

### Add a New Department
**Option 1:** Use the web app (Add Department form)  
**Option 2:** Directly in Departments sheet:
```
department_id:   (leave blank - auto-generated)
department_name: Electrical Engineering
status:          Active
created_at:      (leave blank - auto-generated)
```

### Add a New Class
**Option 1:** Use the web app (Add Class form)  
**Option 2:** Directly in Classes sheet:
```
class_id:      (leave blank - auto-generated)
class_name:    Grade 10-A
department_id: dept-001 (must exist)
status:        Active
created_at:    (leave blank - auto-generated)
```

### Add a New Subject
**Option 1:** Use the web app (Add Subject form)  
**Option 2:** Directly in Subjects sheet:
```
subject_id:   (leave blank - auto-generated)
subject_name: Advanced Calculus
class_id:     cls-001 (must exist)
status:       Active
created_at:   (leave blank - auto-generated)
```

### Add a New Question
**Option 1:** Use the web app (Add Question form)  
**Option 2:** Directly in Questions sheet:
```
question_id:   (leave blank - auto-generated)
category:      Technical Quality
question_text: Does the instructor explain concepts clearly?
weight:        1.0
status:        Active
created_at:    (leave blank - auto-generated)
```

---

## 🎯 Role Permissions

| Role | Dashboard | Evaluate | Add Instructor | Manage System |
|------|-----------|----------|----------------|---------------|
| **ROLE_SUPER_ADMIN** | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ❌ |
| **Instructor** | ❌ | ✅ | ❌ | ❌ |

**Manage System includes:**
- Add/Edit Questions
- Add/Edit Departments
- Add/Edit Classes
- Add/Edit Subjects
- Add/Edit Managers

---

## 📊 Dashboard Metrics Explained

### KPI Cards
- **Total Evaluations:** Count of all evaluation records
- **Instructors Evaluated:** Unique employees with at least one evaluation
- **Overall Average:** Mean score across all evaluations (0-5 scale)
- **Active Questions:** Count of questions with status = "Active"

### Score Distribution
- **Excellent:** 4.5 - 5.0
- **Good:** 3.5 - 4.49
- **Average:** 2.5 - 3.49
- **Poor:** 0 - 2.49

### Overall Average Gauge
- **Strong:** 4.0 - 5.0 (Green)
- **Fair:** 3.0 - 3.99 (Orange)
- **Needs Attention:** 0 - 2.99 (Red)

### Top Performers
- Shows top 5 instructors by average score
- 🥇 Gold medal for #1
- 🥈 Silver medal for #2
- 🥉 Bronze medal for #3

---

## 🔧 Troubleshooting

### Problem: Dropdown shows "No Active Departments"
**Solution:** Check Departments sheet — ensure at least one row has `status = Active`

### Problem: Dropdown shows "No Active Classes"
**Solution:** 
1. Check Classes sheet — ensure at least one row has `status = Active`
2. Verify `department_id` matches an existing department

### Problem: Dropdown shows "No Active Subjects"
**Solution:**
1. Check Subjects sheet — ensure at least one row has `status = Active`
2. Verify `class_id` matches an existing class

### Problem: User sees "Access Denied"
**Solution:**
1. Check Managers sheet — ensure user's email exists with `status = Active`
2. Verify `role_id` is set correctly
3. Check Roles sheet — ensure role has required permissions

### Problem: Dashboard shows no data
**Solution:**
1. Ensure at least one evaluation has been submitted
2. Check Evaluations sheet — verify data exists
3. Verify user has `canViewDashboard` permission

### Problem: Evaluation submission fails
**Solution:**
1. Run `setupSheetHeaders()` function in Apps Script editor
2. Verify Evaluations and EvaluationAnswers sheets exist
3. Check browser console for JavaScript errors

---

## 📝 Data Validation Rules

### Employee Email
- Must be unique
- Must be valid email format

### Manager Email
- Must be unique
- Must be valid email format
- Must match Google account email for login

### Department ID
- Auto-generated format: `dept-xxxxx`
- Must be unique

### Class ID
- Auto-generated format: `cls-xxxxx`
- Must be unique
- Must reference valid `department_id`

### Subject ID
- Auto-generated format: `sub-xxxxx`
- Must be unique
- Must reference valid `class_id`

### Question Weight
- Must be numeric
- Recommended range: 0.5 - 2.0
- Default: 1.0

### Evaluation Rating
- Must be 1, 2, 3, 4, or 5
- 1 = Poor, 5 = Excellent

### Grade Level
- Must be 1, 2, or 3

### Semester
- Must be "1st Semester" or "2nd Semester"

---

## 🎨 Customization

### Change Brand Colors
Edit `Index.html` CSS variables:
```css
:root {
  --sta-red:      #D32F2F;  /* Primary brand color */
  --sta-red-dark: #B71C1C;  /* Hover state */
  --sta-charcoal: #212121;  /* Dark text/sidebar */
  --sta-gray:     #757575;  /* Secondary text */
}
```

### Add New Question Category
Edit `Index.html` in the Add Question form:
```html
<select id="q-cat" class="form-input" required>
  <option value="Technical Quality">Technical Quality</option>
  <option value="Professionalism">Professionalism</option>
  <option value="Performance">Performance</option>
  <option value="Classroom Management">Classroom Management</option>
  <option value="Your New Category">Your New Category</option>
</select>
```

### Change Evaluation Scale
Currently: 1-5 scale  
To change: Edit `renderEvalForm()` in `Index.html`:
```javascript
// Find this line:
${[1,2,3,4,5].map(v => ...

// Change to (example: 1-10 scale):
${[1,2,3,4,5,6,7,8,9,10].map(v => ...
```

---

## 📞 Support Checklist

Before asking for help, check:
- [ ] Logs sheet for error messages
- [ ] Browser console (F12) for JavaScript errors
- [ ] Apps Script logs (View > Logs)
- [ ] All required sheets exist
- [ ] Headers match expected format
- [ ] User has correct permissions
- [ ] Data references are valid (dept_id, class_id, etc.)

---

## 🔐 Security Best Practices

1. **Never share the spreadsheet publicly** — Keep it private
2. **Use Google account emails** — Only authorized users in Managers sheet
3. **Review Logs regularly** — Monitor for suspicious activity
4. **Backup data monthly** — File > Make a copy
5. **Test changes in a copy first** — Don't edit production directly
6. **Limit ROLE_SUPER_ADMIN** — Only give to trusted admins

---

## 📈 Performance Tips

1. **Don't delete cache functions** — They make the system fast
2. **Keep Active status clean** — Inactive records are filtered automatically
3. **Archive old evaluations** — Move to separate sheet if >10,000 rows
4. **Limit concurrent users** — Google Apps Script has quotas
5. **Use batch operations** — Add multiple records at once when possible

---

## 🎓 Training Guide

### For Managers (Evaluators)
1. Log in with your Google account
2. Click "Perform Evaluation"
3. Select instructor from dropdown
4. Choose department, class, subject
5. Select grade level (1, 2, or 3)
6. Select semester
7. Rate each question (1-5 stars)
8. Add notes
9. Click "Submit Evaluation"

### For Admins
1. Add departments first
2. Add classes (linked to departments)
3. Add subjects (linked to classes)
4. Add instructors (linked to departments)
5. Add evaluation questions
6. Add managers (users who can evaluate)
7. Monitor dashboard for insights

---

*Last Updated: May 17, 2026*
