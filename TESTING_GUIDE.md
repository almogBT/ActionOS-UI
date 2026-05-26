# ActionOS Prototype Testing Guide

This guide explains how to manually test the current ActionOS prototype.

## Test Setup

Start the app from:

```text
ActionOS/app
```

Command:

```powershell
npm run start -- --port 4305 --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:4305/
```

Expected result:

- The ActionOS app loads.
- The first screen is the Home view.
- The left sidebar shows Home, Inbox, My Work, Boards, Meetings, **Customers**, and Members.

## 0. Local Persistence And Reset Test

Steps:

1. Open `Boards`.
2. Create a new task.
3. Refresh the browser.
4. Confirm the task is still visible.
5. Open `Meetings`.
6. Add a new meeting action.
7. Refresh the browser.
8. Confirm the meeting action is still visible.
9. Click `Reset demo`.

Expected result:

- Created tasks survive refresh.
- Created meeting notes survive refresh.
- Reset demo restores the original demo data.

## 1. Navigation Test

Steps:

1. Open the app.
2. Click `Home`.
3. Click `Inbox`.
4. Click `My Work`.
5. Click `Boards`.
6. Click `Meetings`.
7. Click `Members`.

Expected result:

- Each sidebar item changes the main screen.
- The active sidebar item is visually highlighted.
- No full page reload occurs.

## 2. Workspace Home Test

Steps:

1. Click `Home`.
2. Review the metric cards.
3. Review the `Overdue and due soon` list.
4. Click an item in the list.
5. Click `Open board`.
6. Return to `Home`.
7. Click `Run meeting`.
8. Review team workload.
9. Review recent activity.
10. Click `Triage inbox`.
11. Return to `Home`.
12. Click a Top 3 task if one is visible.

Expected result:

- Metric cards show counts for open work, overdue, blocked work, and follow-up debt.
- Clicking a work item selects it.
- `Open board` navigates to the Boards screen.
- `Run meeting` navigates to the Meetings screen.
- Meeting memory notes appear in the Home view.
- Team workload shows member open/blocked counts.
- Activity feed updates after edits, comments, task creation, agenda changes, and conversions.
- The workflow strip explains capture, triage, execute, and review.
- Clicking a task opens the task drawer.

## 2A. Global Command Bar Test

Steps:

1. Use the top command bar.
2. Choose `Task`.
3. Enter `Test command bar task`.
4. Click `Capture`.
5. Confirm the app opens or highlights `Inbox`.
6. Choose `Action`.
7. Enter `Follow up from command bar`.
8. Click `Capture`.
9. Open `Meetings`.

Expected result:

- The task capture creates a task in Inbox.
- The action capture creates a meeting action.
- Empty command input cannot be submitted.
- Captured items remain after refresh.

## 2C. Language And RTL Test

Steps:

1. Open the app.
2. Click `עברית` in the topbar language switcher.
3. Navigate through Home, Inbox, Boards, Meetings, My Work, and Members.
4. Refresh the browser.
5. Click `English`.

Expected result:

- Main UI labels switch to Hebrew.
- The page direction switches to RTL.
- The Hebrew choice remains after refresh.
- Clicking English switches the UI back to LTR English.
- Mock task titles and user-entered content remain in their original language.

## 2B. Inbox And Triage Test

Steps:

1. Click `Inbox`.
2. Review the metric cards.
3. Find an Inbox task.
4. Click `Plan`, `Start`, `Wait`, and/or `Done`.
5. Find an unconverted meeting action.
6. Click `Convert`.
7. Click `Convert all meeting actions` if more open actions exist.

Expected result:

- The Inbox shows raw work, meeting actions, blockers, and triage counts.
- Triage buttons change task status.
- Converted meeting actions create tasks.
- Converted tasks open in the task drawer.
- Meeting action debt decreases after conversion.

## 3. My Work Test

Steps:

1. Click `My Work`.
2. Click each tab: `Today`, `Upcoming`, `Watched`, and `Blocked`.
3. Click different task cards.
4. Review the selected item panel on the right or the global task drawer.
5. Edit title, description, owner, board, priority, due date, status, and blocker.
6. Toggle watcher checkboxes.
7. Toggle checklist items.
8. Add a comment.
9. Refresh the browser.

Expected result:

- Tabs show different filtered task groups.
- Clicking a task updates the selected item panel and opens the task drawer.
- The selected task is visually highlighted.
- Editing fields updates the task.
- Checklist progress changes when checklist items are checked or unchecked.
- Comments appear under the selected task.
- Changes remain after refresh.
- Tasks created from meetings show a `from meeting` indicator.

## 4. Board Table Test

Steps:

1. Click `Boards`.
2. Review the task creation form.
3. Add a task title.
4. Choose owner, priority, and due date.
5. Click `Add task`.
6. Review the table view.
7. Click several task rows.
8. Check the status, owner, priority, and due date columns.
9. Change status, owner, priority, and due date inline.
10. Apply a template from the template selector.
11. Click the `Kanban`, `Calendar`, and `Workload` view buttons.

Expected result:

- The new task appears in the board.
- The board table displays all mock tasks.
- Clicking a row selects the task.
- Owner avatars are visible.
- Priority badges are color-coded.
- Status badges are color-coded.
- Inline edits update tasks.
- Applying a template creates multiple tasks.
- Board view buttons switch between table, kanban, calendar-style due-date lanes, and workload by member.
- Clicking a task opens the task drawer.

Filter steps:

1. Enter a search term in `Search board`.
2. Change the status filter.

Expected result:

- Table items are filtered by search.
- Table and kanban items are filtered by status.
- Empty state appears when no items match.

## 5. Kanban Board Test

Steps:

1. Click `Boards`.
2. Click the `Kanban` board view.
3. Confirm columns exist for `Inbox`, `Planned`, `In Progress`, `Waiting`, and `Done`.
4. Click a card in a kanban column.

Expected result:

- Tasks are grouped by status.
- Each status column shows its item count.
- Clicking a kanban card selects it.
- Empty columns show `No items`.

Note:

- Drag-and-drop is not implemented in this prototype.

## 6. Meeting Detail Test

Steps:

1. Click `Meetings`.
2. Review the meeting title and time.
3. Add an agenda item.
4. Mark an agenda item complete.
5. Review the structured notes.
6. Use the note type filter.
7. Review the follow-up panel.
8. Click `Publish summary`.
9. Click `Convert all actions` if open actions exist.

Expected result:

- Meeting title is visible.
- Agenda items are visible.
- New agenda item appears.
- Completed agenda item is visually marked.
- A live capture form is visible.
- Notes show different types: decision, action, blocker, and note.
- Note filter changes the notes list.
- The action note has a Convert button if it has not been converted yet.
- Follow-up panel shows total notes, open actions, and attendee avatars.
- Run mode shows agenda, live capture, and closeout guidance.
- Publish summary adds a summary note.
- Convert all actions converts unconverted actions into tasks.

## 7. Add Meeting Output Test

Steps:

1. Click `Meetings`.
2. Find the `Add meeting output` form.
3. Enter content such as `Follow up with Dana about API contract`.
4. Keep Type set to `action`.
5. Choose an owner.
6. Choose a due date.
7. Click `Add note`.

Expected result:

- The new action appears at the top of the notes list.
- The note shows its type.
- Owner and due date are visible.
- The note has a Convert button.
- The Total notes count increases.
- The Open actions count increases.

Additional type test:

1. Change Type to `decision`.
2. Add a decision note.

Expected result:

- The decision appears in the notes list.
- It does not show a Convert button.

## 8. Convert Meeting Action Test

Steps:

1. Click `Meetings`.
2. Find the action note with the Convert button.
3. Click `Convert`.
4. Confirm or edit task title, owner, priority, and due date.
5. Click `Create task`.

Expected result:

- The new task opens in the task drawer.
- A new task appears in My Work and Boards.
- The new task title matches the action note content.
- Owner, priority, and due date match the conversion form.
- The new task has a `from meeting` indicator.
- The new task becomes selected in the detail panel.
- The new task becomes selected in the task drawer.

## 8A. Global Task Drawer Test

Steps:

1. Click a task from Home, Inbox, My Work, Boards, or a board view.
2. Confirm the drawer opens.
3. Edit title, description, board, owner, status, priority, due date, and blocker.
4. Add a checklist item.
5. Toggle checklist items.
6. Add a comment.
7. Click `Start`, `Mark done`, or `Archive`.
8. Close the drawer.
9. Refresh the browser.

Expected result:

- The drawer opens over the current screen.
- Task edits persist.
- Checklist progress updates.
- Comments appear.
- Status/action buttons update the task.
- Closing the drawer returns to the same screen.

Follow-up steps:

1. Click `Meetings` again.
2. Find the same action note.

Expected result:

- The action note now shows `Converted`.
- The Convert button is disabled.
- The follow-up debt count is reduced.

## 9. Members Test

Steps:

1. Click `Members`.
2. Add a member name.
3. Choose role and team.
4. Click `Invite member`.
5. Review the member table.
6. Refresh the browser.

Expected result:

- The new member appears in the table.
- The new member remains after refresh.
- Members are listed.
- Each member has a name, role, team, and availability.
- Availability is shown as a status badge.

## 10. Responsive Layout Test

Steps:

1. Open the app in a desktop browser.
2. Resize the browser width below tablet size.
3. Resize the browser width to mobile size.

Expected result:

- The layout remains usable.
- The sidebar moves above the content on smaller screens.
- Cards and panels stack vertically.
- Text remains readable.
- No important controls overlap.
- The task drawer fits on mobile width.
- Board table rows become stacked cards on smaller screens.

## 11. Build Verification

Run:

```powershell
npm run build
```

Expected result:

- Build completes successfully.
- Output is generated under:

```text
ActionOS/app/dist/actionos-app
```

## 12. v3 — localStorage migration test

Steps:

1. Open browser DevTools → Application → LocalStorage for the app origin.
2. If a key `actionos.local-state.v2` is present, leave it; otherwise add it as `{}` (an empty object).
3. Refresh the browser (hard refresh).
4. Inspect the localStorage keys again.

Expected result:

- The `actionos.local-state.v2` key is gone.
- A new `actionos.local-state.v3` key is present.
- The console shows the one-time message `[ActionOS] v2 state detected and cleared. Seeded fresh v3 mock data.`
- The Customers tab shows the seeded 6 mock customers.

## 13. Customers list test

Steps:

1. Click `Customers`.
2. Confirm 6 mock customers render (Strauss Group, Tnuva, Osem-Nestle, Sano Bruno's, two prospects).
3. Click filter chips: All, Existing, Prospect, At Risk.
4. Type `tnuva` in the search box.
5. Click `Existing` ↔ `Prospect` toggle to switch the add form.
6. Type a name and click Save.

Expected result:

- Filter chips narrow the list correctly (At Risk → Tnuva only).
- Search narrows by name and by primary-contact email.
- Saving a prospect adds it to the list with status = Prospect, externalGroupId = null.
- Saving an existing customer with a chosen Servitz group ID stores it with status = Active.

## 14. Customer 360 test

Steps:

1. From the customer list, click any row (e.g. Strauss Group).
2. Review the four KPI cards (last meeting, next meeting, open tasks, overdue tasks).
3. Switch through the tabs (Meetings / Open Tasks / Closed Tasks / Attachments).
4. Click `Back to customers`.

Expected result:

- KPI counts match the seeded data (Strauss: 1 overdue, 3 open).
- The Meetings tab shows meetings in date order newest first.
- The Open Tasks tab shows only open statuses.
- The Closed Tasks tab shows only Done / Cancelled.
- The Attachments tab shows the mock notice and no attachments.

## 15. Prospect → Existing promotion test

Steps:

1. Open a prospect customer (e.g. `Telma Foods (prospect)`).
2. In the customer details panel, locate the `Promote to existing` row.
3. Pick a Servitz group from the dropdown.
4. Click `Promote to existing`.

Expected result:

- The customer's type changes to Existing.
- The status changes to Active.
- The externalGroupId field becomes the selected Servitz group ID.
- Any linked meetings/tasks remain attached (no rewrite).
- Refresh persists the change.

## 16. Customer meeting summary test (desktop + mobile)

Steps:

1. From a customer's 360 view, click `New customer meeting`.
2. Fill subject, date, leader (must be in the assignable list), goal, summary.
3. Toggle 2 internal participants.
4. Click `+ Add participant` and fill a customer participant row.
5. Click `Create meeting`.
6. Resize the browser to 375px width.

Expected result:

- The form lays out in two columns on desktop and a single column under 720px.
- The leader, internal participants, and account-owner dropdowns show ONLY active fritz/critilog employees (5 entries). Inactive ('Tamar Ben-Ami') and non-fritz ('External Consultant') are absent.
- After Create, the meeting status is `Draft Summary` if a summary was entered, otherwise `Planned`.
- The meeting form switches into edit mode showing the typed-notes section.

## 17. Typed notes + create task from action test

Steps:

1. In the edit-mode meeting form, set type = `action`, enter content, and click Add to summary.
2. On the newly added action note, click `Create task`.
3. The inline task creation panel opens. Confirm the assignee dropdown shows only fritz/critilog active employees.
4. Pick assignee, set due date and priority. Click Create task.

Expected result:

- The task is created; the meeting status transitions to `Tasks Created`.
- The action note shows the `✓ Linked to task` badge.
- The notification log on the new task contains an `assigned` entry.
- Browser console shows `[ActionOS notification mock] assigned <task-id> [...]`.
- Refresh persists the task, the note linkage, and the meeting status.

## 18. Meeting task drawer test

Steps:

1. From the customer 360 Open Tasks tab or from the Meeting Preparation view, click a meeting task.
2. The task drawer opens in meeting-task mode (header reads `Meeting task`).
3. Change the status to `Done`.

Expected result:

- The drawer shows customer + source meeting links + treatment notes + notification log (not the board-task drawer).
- Available statuses match the `MeetingTaskStatus` set (New, Sent To Owner, In Progress, Waiting For Customer, Waiting For Internal, Done, Cancelled).
- Changing status appends a `status-changed` entry to the notification log.
- Attempting to reassign to an inactive/non-fritz employee is impossible (only assignable employees appear).

## 19. Meeting Preparation test

Steps:

1. From the customer 360 view, click `Prepare next meeting`.
2. Review prior meetings, open tasks, overdue tasks, waiting-for-customer, completed-since-last-meeting.
3. Click any task — the meeting-task drawer opens.
4. Click `Print briefing`.

Expected result:

- For Strauss Group: overdue count matches (mtask-3 is overdue), waiting-for-customer count matches (mtask-4), open tasks list includes mtask-1, completed-since-last-meeting list is non-empty.
- The print preview hides the top action buttons (only the briefing content prints).

## 20. Inline-form-opens-drawer bug check

Steps:

1. Open the Customers list.
2. Inside a customer row, click the prospect-promotion select dropdown (when present) or the `Prepare meeting` button.

Expected result:

- The drawer does NOT open.
- The dropdown opens normally (or the prepare-meeting action fires) without triggering row-level navigation.

## 21. Hebrew / RTL on v3 screens

Steps:

1. Click `עברית` in the top language switcher.
2. Navigate through Customers → list → 360 → meeting form → meeting prep.
3. Open the meeting-task drawer.

Expected result:

- All labels switch to Hebrew.
- Layout flips to RTL.
- No raw English labels remain on any v3 screen.
- The notification-event labels (`משימה הוקצתה`, `סטטוס שונה`) appear correctly in the drawer log.

## Current Non-Testable Items

These are planned but not implemented yet:

- Real login.
- Real workspace switching.
- Real backend persistence.
- Real API calls.
- Real permissions.
- **Real email notifications via Logic Apps** (v3 logs only).
- Real HomePage external module registration.
- **Real SharePoint attachment upload** (v3 uses mock blob URLs).
- Configurable board columns.
- Kanban drag-and-drop.
- **Bidirectional sync with FritzCustomersApi CRM meetings**.
