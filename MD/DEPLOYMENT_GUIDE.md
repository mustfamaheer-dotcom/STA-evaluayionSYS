# STA Evaluation System - Deployment Guide

## 📋 Prerequisites

- Google account with access to Google Apps Script
- Google Sheets spreadsheet created
- All project files ready (`.gs` and `.html` files)

---

## 🚀 Step-by-Step Deployment

### Step 1: Prepare the Spreadsheet

1. **Open your Google Sheet:**
   - URL: https://docs.google.com/spreadsheets/d/1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU/edit

2. **Verify all sheets exist:**
   - Employees
   - Managers
   - Departments
   - Classes
   - Subjects
   - Questions
   - Evaluations
   - EvaluationAnswers
   - Roles
   - Logs

3. **Note the Spreadsheet ID:**
   - Copy from URL: `1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU`
   - You'll need this for the Apps Script

---

### Step 2: Create Apps Script Project

1. **Open Apps Script Editor:**
   - In your spreadsheet: Extensions > Apps Script
   - Or go to: https://script.google.com

2. **Create new project:**
   - If opening from spreadsheet, project is auto-created
   - If from script.google.com, click "New Project"

3. **Name your project:**
   - Click "Untitled project" at top
   - Rename to: "STA Evaluation System"

---

### Step 3: Upload Backend Files (.gs)

Upload these files in this order:

#### 1. Utilities.gs
- Click `+` next to Files
- Select "Script"
- Name: `Utilities`
- Paste content from `d:\STAManagerSurvey\Utilities.gs`
- **IMPORTANT:** Update `SPREADSHEET_ID` if different:
  ```javascript
  SPREADSHEET_ID: '1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU',
  ```

#### 2. Auth.gs
- Click `+` next to Files
- Select "Script"
- Name: `Auth`
- Paste content from `d:\STAManagerSurvey\Auth.gs`

#### 3. Permissions.gs
- Click `+` next to Files
- Select "Script"
- Name: `Permissions`
- Paste content from `d:\STAManagerSurvey\Permissions.gs`

#### 4. Employee.gs
- Click `+` next to Files
- Select "Script"
- Name: `Employee`
- Paste content from `d:\STAManagerSurvey\Employee.gs`

#### 5. Evaluation.gs
- Click `+` next to Files
- Select "Script"
- Name: `Evaluation`
- Paste content from `d:\STAManagerSurvey\Evaluation.gs`

#### 6. code.gs
- **Delete the default `Code.gs` file** (click ⋮ > Remove)
- Click `+` next to Files
- Select "Script"
- Name: `code`
- Paste content from `d:\STAManagerSurvey\code.gs`
- **IMPORTANT:** Update `SPREADSHEET_ID` constant at top:
  ```javascript
  const SPREADSHEET_ID = '1X2Vuyxkm0eoYevjXQT52bWiA_tXri16hzXSBkY3FOCU';
  ```

---

### Step 4: Upload Frontend Files (.html)

#### 1. Index.html
- Click `+` next to Files
- Select "HTML"
- Name: `Index`
- Paste content from `d:\STAManagerSurvey\Index.html`

#### 2. Evaluation.html (Optional - not currently used)
- Click `+` next to Files
- Select "HTML"
- Name: `Evaluation`
- Paste content from `d:\STAManagerSurvey\Evaluation.html`

---

### Step 5: Configure Project Settings

1. **Set Project Timezone:**
   - Click ⚙️ (Project Settings) in left sidebar
   - Scroll to "General settings"
   - Set timezone to your location (e.g., "Africa/Cairo")

2. **Enable APIs (if needed):**
   - Usually auto-enabled
   - If errors occur, check Services in left sidebar

---

### Step 6: Run Setup Function

1. **Select setup function:**
   - At top of editor, select function: `setupSheetHeaders`
   - This is in `Evaluation.gs`

2. **Run the function:**
   - Click ▶️ Run button
   - **First time:** Authorization required
     - Click "Review permissions"
     - Choose your Google account
     - Click "Advanced" > "Go to STA Evaluation System (unsafe)"
     - Click "Allow"

3. **Verify success:**
   - Check Execution log (bottom of editor)
   - Should see: "Headers set successfully."
   - Check your spreadsheet:
     - Evaluations sheet has headers with dark background
     - EvaluationAnswers sheet has headers with dark background

---

### Step 7: Add Initial Data

#### 1. Add Roles and Permissions
**Roles sheet:**
```
role                | permission
ROLE_SUPER_ADMIN    | canViewDashboard
ROLE_SUPER_ADMIN    | canEvaluate
ROLE_SUPER_ADMIN    | canAddInstructor
ROLE_SUPER_ADMIN    | canManageSystem
Manager             | canViewDashboard
Manager             | canEvaluate
Manager             | canAddInstructor
Instructor          | canEvaluate
```

#### 2. Add Your Admin Account
**Managers sheet:**
```
manager_id: (leave blank)
name: Your Name
email: your.email@gmail.com
role_id: ROLE_SUPER_ADMIN
status: Active
created_at: (leave blank or enter today's date)
```

#### 3. Add Sample Department
**Departments sheet:**
```
department_id: (leave blank)
department_name: Engineering
status: Active
created_at: (leave blank)
```

#### 4. Add Sample Class
**Classes sheet:**
```
class_id: (leave blank)
class_name: Grade 10-A
department_id: (copy from Departments sheet)
status: Active
created_at: (leave blank)
```

#### 5. Add Sample Subject
**Subjects sheet:**
```
subject_id: (leave blank)
subject_name: Mathematics
class_id: (copy from Classes sheet)
status: Active
created_at: (leave blank)
```

#### 6. Add Sample Employee
**Employees sheet:**
```
employee_id: (leave blank)
name: Ahmed Mohamed
email: ahmed@example.com
department_id: (copy from Departments sheet)
school_branch: Cairo Branch
position: Senior Instructor
status: Active
created_at: (leave blank)
```

#### 7. Add Sample Questions
**Questions sheet:**
```
question_id: (leave blank)
category: Technical Quality
question_text: Does the instructor explain concepts clearly?
weight: 1.0
status: Active
created_at: (leave blank)

question_id: (leave blank)
category: Professionalism
question_text: Does the instructor arrive on time?
weight: 1.0
status: Active
created_at: (leave blank)

question_id: (leave blank)
category: Performance
question_text: Does the instructor engage students effectively?
weight: 1.5
status: Active
created_at: (leave blank)

question_id: (leave blank)
category: Classroom Management
question_text: Does the instructor maintain discipline?
weight: 1.0
status: Active
created_at: (leave blank)

question_id: (leave blank)
category: Technical Quality
question_text: Does the instructor use teaching aids effectively?
weight: 1.0
status: Active
created_at: (leave blank)
```

---

### Step 8: Deploy as Web App

1. **Click Deploy button:**
   - Top right: Click "Deploy" > "New deployment"

2. **Configure deployment:**
   - Click ⚙️ (gear icon) next to "Select type"
   - Choose "Web app"

3. **Set deployment settings:**
   - **Description:** "STA Evaluation System v1.0"
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
     - ⚠️ This allows anyone with the link to access
     - Authentication is handled by the Managers sheet

4. **Deploy:**
   - Click "Deploy"
   - **Copy the Web App URL** (you'll need this!)
   - Example: `https://script.google.com/macros/s/AKfycbx.../exec`

5. **Test the URL:**
   - Open in new browser tab
   - Should see the STA login screen
   - If you see authorization screen, click "Authorize"

---

### Step 9: Test the System

1. **Log in with your admin account:**
   - Open the web app URL
   - System should recognize your email from Managers sheet
   - You should see all menu items (Dashboard, Perform Evaluation, Management section)

2. **Test Dashboard:**
   - Click "Dashboard"
   - Should load without errors (may show 0 evaluations)

3. **Test Evaluation Form:**
   - Click "Perform Evaluation"
   - Select the sample employee
   - Fill in all fields
   - Rate all questions
   - Submit evaluation
   - Should redirect to dashboard
   - Dashboard should show 1 evaluation

4. **Test Management Forms:**
   - Try adding a new department
   - Try adding a new class
   - Try adding a new subject
   - Try adding a new question
   - Try adding a new instructor

---

### Step 10: Share with Users

1. **Add user accounts:**
   - Go to Managers sheet
   - Add rows for each user:
     ```
     name: User Name
     email: user@gmail.com
     role_id: Manager (or Instructor)
     status: Active
     ```

2. **Share the web app URL:**
   - Send URL to users via email
   - Include brief instructions
   - Users must log in with their Google account

3. **Train users:**
   - Show how to perform evaluations
   - Explain the dashboard (for managers)
   - Demonstrate management forms (for admins)

---

## 🔧 Post-Deployment Configuration

### Update Deployment (After Code Changes)

1. **Make changes in Apps Script editor**
2. **Save all files** (Ctrl+S or Cmd+S)
3. **Deploy:**
   - Click "Deploy" > "Manage deployments"
   - Click ✏️ (edit) on active deployment
   - Change version to "New version"
   - Add description of changes
   - Click "Deploy"
4. **Test changes:**
   - Open web app URL
   - May need to hard refresh (Ctrl+Shift+R)

### Monitor System Health

1. **Check Logs sheet regularly:**
   - Look for ERROR status entries
   - Review user activity

2. **Check Apps Script logs:**
   - In editor: View > Logs
   - Look for runtime errors

3. **Monitor quotas:**
   - Apps Script has daily quotas
   - View > Executions to see usage

---

## 🐛 Troubleshooting Deployment Issues

### Issue: "Authorization required" error
**Solution:**
- Run `setupSheetHeaders()` function manually
- Click "Review permissions" and authorize
- Try deploying again

### Issue: "Spreadsheet not found" error
**Solution:**
- Verify `SPREADSHEET_ID` in `Utilities.gs` and `code.gs`
- Ensure you have edit access to the spreadsheet
- Check spreadsheet hasn't been deleted

### Issue: Web app shows blank page
**Solution:**
- Check browser console (F12) for JavaScript errors
- Verify all `.html` files uploaded correctly
- Check `Index.html` has no syntax errors

### Issue: "Access denied" for all users
**Solution:**
- Verify Managers sheet has user emails
- Check `status` column is "Active"
- Verify Roles sheet has permission mappings

### Issue: Dropdowns show "Loading..." forever
**Solution:**
- Check sheet names match exactly (case-sensitive)
- Verify sheets have data with `status = Active`
- Check browser console for errors

### Issue: Evaluation submission fails
**Solution:**
- Run `setupSheetHeaders()` function
- Verify Evaluations and EvaluationAnswers sheets exist
- Check column headers match expected format

---

## 📊 Performance Optimization (Already Implemented)

The system includes these optimizations:
- ✅ In-execution sheet cache
- ✅ Profile cache for auth
- ✅ Client-side dropdown cache
- ✅ Batch writes for evaluations
- ✅ Single-pass dashboard calculations

**No additional optimization needed!**

---

## 🔒 Security Checklist

- [ ] Spreadsheet is private (not public)
- [ ] Only authorized users in Managers sheet
- [ ] Web app deployed with "Execute as: Me"
- [ ] Regular backups created (File > Make a copy)
- [ ] Logs reviewed monthly for suspicious activity
- [ ] ROLE_SUPER_ADMIN limited to trusted admins only

---

## 📞 Support Resources

- **System Status:** See `SYSTEM_STATUS.md`
- **Quick Reference:** See `QUICK_REFERENCE.md`
- **Testing Checklist:** See `TESTING_CHECKLIST.md`
- **Apps Script Docs:** https://developers.google.com/apps-script
- **Google Sheets API:** https://developers.google.com/sheets/api

---

## 🎉 Deployment Complete!

Your STA Evaluation System is now live and ready to use.

**Next Steps:**
1. ✅ Test all features with your admin account
2. ✅ Add user accounts to Managers sheet
3. ✅ Share web app URL with users
4. ✅ Provide training to managers and instructors
5. ✅ Monitor Logs sheet for issues
6. ✅ Create monthly backups of spreadsheet

---

*Deployed: May 17, 2026*
*Version: 1.0*
*Status: Production Ready*
