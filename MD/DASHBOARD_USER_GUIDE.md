# Dashboard User Guide - New Features

## 🎯 Overview

The dashboard now includes powerful filtering and export capabilities to help you analyze evaluation data more effectively.

---

## 🔐 Who Can Access the Dashboard?

### ✅ Allowed Roles
- **Super Admins** (ROLE_SUPER_ADMIN)
- **Managers**

### ❌ Restricted Roles
- **Instructors** — Cannot access dashboard

**Why?** The dashboard contains sensitive performance data and analytics that should only be viewed by management personnel.

---

## 📊 Dashboard Features

### 1. Filter by Instructor

**Use Case:** View performance data for a specific instructor

**Steps:**
1. Open Dashboard
2. Click "Filter by Instructor" dropdown
3. Select an instructor name (e.g., "Ahmed Mohamed")
4. Dashboard automatically reloads
5. All stats now show data for that instructor only

**What Updates:**
- Total Evaluations → Count for selected instructor
- Overall Average → Average score for selected instructor
- Score Distribution → Distribution for selected instructor
- Top Performers → May change based on filter
- Department Averages → Recalculated
- Recent Evaluations → Shows only selected instructor

**Example:**
```
Before Filter:
- Total Evaluations: 150
- Overall Average: 4.2

After Filtering by "Ahmed Mohamed":
- Total Evaluations: 12
- Overall Average: 4.5
```

---

### 2. Filter by Manager

**Use Case:** View evaluations submitted by a specific manager

**Steps:**
1. Open Dashboard
2. Click "Filter by Manager" dropdown
3. Select a manager name (e.g., "John Doe")
4. Dashboard automatically reloads
5. All stats now show evaluations submitted by that manager

**What Updates:**
- Total Evaluations → Count submitted by selected manager
- Overall Average → Average of evaluations by that manager
- All other stats recalculate based on filtered data

**Example:**
```
Before Filter:
- Total Evaluations: 150
- Submitted by all managers

After Filtering by "John Doe":
- Total Evaluations: 45
- Submitted by John Doe only
```

---

### 3. Combine Filters

**Use Case:** View specific instructor's evaluations submitted by specific manager

**Steps:**
1. Select instructor from "Filter by Instructor"
2. Select manager from "Filter by Manager"
3. Dashboard shows intersection of both filters

**Example:**
```
Filter: Instructor = "Ahmed Mohamed" AND Manager = "John Doe"
Result: Shows only Ahmed Mohamed's evaluations that were submitted by John Doe
```

**Real-World Scenario:**
- Manager John Doe wants to review his own evaluations of Ahmed Mohamed
- Filters: Instructor = Ahmed, Manager = John
- Result: Shows only the evaluations John submitted for Ahmed

---

### 4. Clear Filters

**Use Case:** Return to viewing all data

**Steps:**
1. Click "Clear Filters" button
2. Both dropdowns reset to "All"
3. Dashboard reloads with complete dataset

---

### 5. Export to PDF

**Use Case:** Generate a printable report or save dashboard as PDF

**Steps:**
1. **(Optional)** Apply filters to focus on specific data
2. Click "Export PDF" button (top right of filter section)
3. Wait for "Generating PDF..." message
4. Print dialog opens automatically
5. Choose destination:
   - **Save as PDF** → Select location and save
   - **Print** → Send to physical printer
   - **Cancel** → Close dialog
6. Click "Save" or "Print"

**PDF Contents:**
- **Header Section:**
  - STA Instructor Evaluation System title
  - "Dashboard Performance Report" subtitle
  - Generation date and time
  - Applied filters (if any)
- **Dashboard Content:**
  - 4 KPI cards (Total Evaluations, Instructors Evaluated, Overall Average, Active Questions)
  - Score Distribution table
  - Overall Average (as text)
  - Semester Breakdown table
  - Top 5 Performers table
  - Department Averages table
  - Recent Evaluations table (full 11 columns)

**PDF Features:**
- Professional formatting
- Print-friendly layout
- Preserved color coding for badges
- Page break optimization
- Clean typography

**Example PDF Header:**
```
═══════════════════════════════════════════════════════
        STA Instructor Evaluation System
        Dashboard Performance Report
        
        Generated: 17/05/2026, 14:30:25
        Filtered by Instructor: Ahmed Mohamed
        Filtered by Manager: John Doe
═══════════════════════════════════════════════════════
```

---

## 🎯 Common Use Cases

### Use Case 1: Review Individual Instructor Performance
**Goal:** Analyze a specific instructor's evaluation history

**Steps:**
1. Open Dashboard
2. Filter by Instructor → Select instructor
3. Review:
   - Overall average score
   - Number of evaluations received
   - Score distribution
   - Recent evaluations
4. Export to PDF for records

**Benefit:** Focused view of one instructor's performance over time

---

### Use Case 2: Audit Manager's Evaluations
**Goal:** Review all evaluations submitted by a specific manager

**Steps:**
1. Open Dashboard
2. Filter by Manager → Select manager
3. Review:
   - Number of evaluations submitted
   - Average scores given
   - Instructors evaluated
4. Export to PDF for audit trail

**Benefit:** Ensure managers are conducting evaluations consistently

---

### Use Case 3: Performance Review Meeting
**Goal:** Prepare report for instructor performance review

**Steps:**
1. Open Dashboard
2. Filter by Instructor → Select instructor being reviewed
3. Review all performance metrics
4. Export to PDF
5. Share PDF with HR or management team

**Benefit:** Professional report ready for performance discussions

---

### Use Case 4: Department Analysis
**Goal:** Compare performance across departments

**Steps:**
1. Open Dashboard (no filters)
2. Review "Department Averages" section
3. Note top and bottom performing departments
4. Export to PDF for management meeting

**Benefit:** Identify departments needing support or recognition

---

### Use Case 5: Manager Performance Comparison
**Goal:** Compare evaluation patterns across managers

**Steps:**
1. Filter by Manager A → Note average scores
2. Export to PDF → Save as "Manager_A_Report.pdf"
3. Clear filters
4. Filter by Manager B → Note average scores
5. Export to PDF → Save as "Manager_B_Report.pdf"
6. Compare the two reports

**Benefit:** Identify if managers have different evaluation standards

---

## 📋 Filter Combinations Reference

| Instructor Filter | Manager Filter | Result |
|-------------------|----------------|--------|
| All | All | Complete dataset (all evaluations) |
| Specific | All | All evaluations for that instructor |
| All | Specific | All evaluations by that manager |
| Specific | Specific | Evaluations for that instructor by that manager |

---

## 🎨 Visual Guide

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Filters                              [📄 Export PDF]     │
├─────────────────────────────────────────────────────────────┤
│ [Filter by Instructor ▼] [Filter by Manager ▼] [Clear]     │
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ Total    │ Instructors│ Overall │ Active  │
│ Evals    │ Evaluated │ Average │ Questions│
│   150    │    25     │  4.2    │   20    │
└──────────┴──────────┴──────────┴──────────┘

┌─────────────────────┬──────────┬──────────┐
│ Score Distribution  │ Overall  │ Semester │
│                     │ Average  │ Breakdown│
│ Excellent: 45%      │   4.2    │ 1st: 80  │
│ Good:      35%      │  ━━━━━   │ 2nd: 70  │
│ Average:   15%      │          │          │
│ Poor:       5%      │          │          │
└─────────────────────┴──────────┴──────────┘

┌─────────────────────────────┬─────────────────┐
│ Top 5 Performers            │ Dept Averages   │
│ 🥇 Ahmed Mohamed    4.8     │ Engineering 4.5 │
│ 🥈 Sara Ali         4.7     │ Programming 4.3 │
│ 🥉 Mohamed Hassan   4.6     │ Go Life     4.1 │
│    Fatima Ahmed     4.5     │                 │
│    Ali Mohamed      4.4     │                 │
└─────────────────────────────┴─────────────────┘

┌─────────────────────────────────────────────────┐
│ Recent Evaluations                              │
│ Employee | Dept | Branch | Score | Semester ... │
│ Ahmed    | Eng  | Cairo  | 4.5   | 1st      ... │
│ Sara     | Prog | Alex   | 4.7   | 1st      ... │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

---

## ⚠️ Important Notes

### Access Control
- **Instructors cannot access the dashboard** — This is by design for data privacy
- If an instructor tries to access, they see: "Access Denied: Dashboard is only accessible to Managers and Super Admins"

### Filter Behavior
- Filters are **cumulative** — Both filters apply simultaneously
- Filters affect **all dashboard sections** — KPIs, charts, tables
- Filters are **temporary** — Clearing filters or refreshing page resets to all data
- Filters do **not persist** — Each dashboard visit starts with no filters

### PDF Export
- **Browser popup blocker** — Ensure popups are allowed for the web app
- **Print dialog** — PDF generation uses browser's native print function
- **File size** — Large datasets may take a few seconds to generate
- **Charts** — Some visual charts may appear as text in PDF (limitation of print function)

### Performance
- **Large datasets** — Filtering is fast even with 1000+ evaluations
- **Real-time updates** — Dashboard reloads immediately when filter changes
- **No caching** — Filters always fetch fresh data from server

---

## 🔧 Troubleshooting

### Problem: Filter dropdown shows "Loading..." forever
**Solution:**
1. Check internet connection
2. Refresh page (Ctrl+R or Cmd+R)
3. Check browser console for errors (F12)
4. Contact system administrator

### Problem: PDF export button does nothing
**Solution:**
1. Check browser popup blocker settings
2. Allow popups for the web app domain
3. Try different browser (Chrome, Firefox, Edge)

### Problem: PDF is blank or incomplete
**Solution:**
1. Wait a few seconds after clicking Export PDF
2. Ensure dashboard has loaded completely before exporting
3. Try exporting with fewer filters (smaller dataset)

### Problem: Filters don't seem to work
**Solution:**
1. Check if selected filter has any matching data
2. Try clearing filters and reapplying
3. Refresh page and try again

### Problem: "Access Denied" message appears
**Solution:**
1. Verify your role in Managers sheet
2. Ensure your role is "Manager" or "ROLE_SUPER_ADMIN"
3. Contact system administrator to update your role

---

## 📞 Need Help?

- **Technical Issues:** Check browser console (F12) for errors
- **Access Issues:** Contact your system administrator
- **Feature Requests:** Submit feedback to management
- **Training:** Request a demo session from IT department

---

## 🎓 Best Practices

### For Managers
1. **Regular Reviews:** Check dashboard weekly to monitor team performance
2. **Filter Usage:** Use instructor filter when preparing for 1-on-1 meetings
3. **PDF Reports:** Export monthly reports for record-keeping
4. **Trend Analysis:** Compare current vs. previous semester data

### For Super Admins
1. **Audit Trail:** Use manager filter to review evaluation patterns
2. **Quality Control:** Check for outliers in scoring
3. **Department Analysis:** Monitor department averages for consistency
4. **Training Needs:** Identify departments needing support

### For Everyone
1. **Clear Filters:** Always clear filters when done to avoid confusion
2. **Export Regularly:** Save PDF reports for historical reference
3. **Verify Data:** Double-check filters before making decisions
4. **Report Issues:** Notify IT of any bugs or unexpected behavior

---

*Last Updated: May 17, 2026*
*Version: 1.1*
