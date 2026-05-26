# ActionOS Prototype Release Notification

Release date: 2026-05-26 (v3 — Customer Meeting Management module)

## v3 — Customer Meeting Management

This release adds the Customer Meeting Management module described in [plans/17-meeting-module-monday-implementation.md](plans/17-meeting-module-monday-implementation.md). The module runs **alongside** the existing screens — nothing was removed.

### What is new

- **Customers** top-level section with list, filter chips (All / Existing / Prospect / At Risk), and inline add form.
- **Customer 360** view: KPI cards (last meeting, next meeting, open tasks, overdue tasks) and tabbed history (Meetings / Open Tasks / Closed Tasks / Attachments).
- **Customer Meeting** form with unified template: subject, date, leader, internal participants, customer participants, goal, summary, typed notes (decision / blocker / action / note), next-meeting date. Mobile-friendly single-column layout at narrow widths.
- **Meeting tasks** with customer + source-meeting links, opened-by + assigned-to employees from the Fritz directory, due date, priority, status, treatment notes, and a notification log.
- **Inline task creation** from action notes — preserves the source-meeting link.
- **Meeting Preparation** view per customer: prior meetings, open tasks, overdue tasks, completed-since-last-meeting, waiting-for-customer. Printable.
- **Prospect → Existing promotion**: link a prospect to a Servitz customer group ID; meetings and tasks follow.
- **Notification log**: every assignment and status change writes an entry to `MeetingTask.notifications[]` (the real Logic Apps wiring comes later).
- **Hebrew / RTL** on every new screen.

### Action required: localStorage will be cleared on first load

This release bumps the persistence key from `actionos.local-state.v2` to `actionos.local-state.v3`. **The legacy key is wiped automatically on first boot** and fresh v3 mock data is seeded. Any prototype task / member / meeting state you created previously will not survive the upgrade. This is documented in the migration step in [actionos-workspace.service.ts](app/src/app/core/services/actionos-workspace.service.ts) (`migrateAndLoad`). A console line `[ActionOS] v2 state detected and cleared.` is logged when this happens.

### v3 known limitations

- Notifications are local mocks only — no real email is sent. The future Logic Apps integration replaces `LocalMockNotificationAdapter` with an HTTP adapter that talks to HomePage_Server.
- Attachments use mock blob URLs (`mock://<id>`). The real SharePoint upload pattern (reused from FritzCustomersApi) ships with the HomePage integration.
- The current user is still a hardcoded employee (`emp-1`). MSAL identity from HomePage arrives in a later release.
- FritzCustomersApi CRM meetings and ActionOS customer meetings are intentionally separate concepts. The `externalCrmMeetingId` field exists but is not populated.

---

## Previous releases

## v1 — initial prototype

Release date: 2026-05-25

The first ActionOS standalone prototype is now available.

This release introduces the initial Angular 18 mock-data experience for ActionOS, focused on proving the core product workflow:

```text
Meeting action -> board item -> assigned work -> My Work
```

The prototype is not connected to a backend yet. Data is still mock/local-first, but it now persists in the browser through the ActionOS persistence port.

## How To Open

Run from:

```text
ActionOS/app
```

Start command:

```powershell
npm run start -- --port 4305 --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:4305/
```

## Included Features

### 0. Local-First Persistence

The prototype now saves local testing changes in the browser.

Included behavior:

- Tasks persist after refresh.
- Meeting notes persist after refresh.
- Converted action state persists after refresh.
- Members persist after refresh.
- Checklist changes persist after refresh.
- Reset demo data button restores the original prototype state.
- Persistence now sits behind a small `ActionosPersistencePort` boundary.

### 1. Workspace Home

The Home view gives a workspace-level command center with:

- Open work count.
- Follow-up debt count.
- Blocked work count.
- Workspace member count.
- Work needing attention.
- Meeting memory preview.

### 2. My Work

The My Work view shows assigned work for the current mock user.

Included behavior:

- Real tabs for Today, Upcoming, Watched, and Blocked.
- Meeting-created work indicator.
- Selected task detail panel.
- Edit task title, description, board, owner, watcher list, priority, due date, status, and blocker.
- Status editing.
- Checklist progress.
- Checklist checkbox updates.
- Task comments.
- Archive task.

### 3. Board Table

The Boards view includes a table-style board surface.

Included behavior:

- Create new tasks.
- Search board items.
- Filter by status.
- Inline status editing.
- Inline owner editing.
- Inline priority editing.
- Inline due date editing.
- Archive from table.
- Apply starter board templates.
- Task rows.
- Status column.
- Owner avatars.
- Priority column.
- Due date column.
- Row selection.

### 4. Kanban Board

The Boards view also includes a kanban-style layout.

Included behavior:

- Columns by status.
- Task cards inside status columns.
- Per-column item counts.
- Card selection.

### 5. Meeting Detail

The Meetings view includes the first meeting workflow screen.

Included behavior:

- Meeting header.
- Agenda list.
- Add agenda items.
- Mark agenda items complete.
- Live meeting output capture form.
- Structured notes.
- Note types: note, decision, action, blocker.
- Owner and due date fields for captured output.
- Filter notes by type.
- Attendees.
- Follow-up panel.

### 6. Convert Meeting Action To Task

The first key ActionOS workflow is implemented in mock form.

Included behavior:

- Action notes show a Convert button.
- Clicking Convert opens a confirmation form.
- User can confirm title, owner, priority, and due date.
- Confirming creates a new board item.
- The new item is linked to the source meeting.
- The app switches to My Work.
- The created task appears in the assigned work list.
- The meeting action is marked as converted.

### 7. Add Meeting Output

Users can now add meeting output directly from the Meetings screen.

Included behavior:

- Add action, decision, blocker, or note.
- Enter content.
- Choose owner.
- Choose due date.
- New output appears immediately in the notes list.
- Newly added action notes can be converted into board items.

### 8. Members And Roles

The Members view introduces the workspace member model.

Included behavior:

- Add/invite mock workspace members.
- Member list.
- Role display.
- Team display.
- Availability display.

### 9. Dashboard And Activity

The Home view now includes richer operational dashboard slices.

Included behavior:

- Overdue work.
- Due-soon work.
- Team workload.
- Blocked counts.
- Recent activity feed.

### 10. Global Command Bar

The topbar now works as a fast capture surface.

Included behavior:

- Capture a task directly into Inbox.
- Capture a meeting action, decision, blocker, or note.
- Captured meeting outputs appear in Meetings.
- Captured tasks appear in Inbox for triage.

### 11. Inbox And Triage

ActionOS now has an Inbox screen for raw work.

Included behavior:

- See tasks that need triage.
- See unconverted meeting actions.
- Promote tasks to Planned, In Progress, Waiting, or Done.
- Convert meeting actions directly from Inbox.
- Review blockers that need attention.

### 12. Global Task Drawer

Tasks can now be opened from anywhere into a right-side cockpit.

Included behavior:

- Edit title, description, board, status, priority, owner, due date, and blocker.
- Update checklist items.
- Add new checklist items.
- Manage watchers.
- Add comments.
- Start, complete, or archive a task from the drawer.

### 13. Expanded Board Views

Boards now support multiple lenses over the same task data.

Included behavior:

- Table view.
- Kanban view.
- Calendar-style due-date lanes.
- Workload view by member.

### 14. Meeting Run Mode

Meetings now behave more like a live operating room.

Included behavior:

- Run-mode summary strip.
- Publish meeting summary note.
- Convert all open actions.
- Follow-up lane for unconverted action debt.

### 15. Workflow Control Tower

Home now explains and supports the full operating rhythm.

Included behavior:

- Capture -> triage -> execute -> review workflow strip.
- My Day top-three lane.
- Inbox and meeting-debt summary.

### 16. English And Hebrew Translations

ActionOS now includes runtime translation support.

Included behavior:

- English translation file.
- Hebrew translation file.
- Language switcher in the topbar.
- Hebrew switches the document to RTL.
- Translation service and pipe are dependency-free.

## Technical Notes

- Framework: Angular 18.
- Data source: mock frontend data.
- Backend: not implemented yet.
- Auth: not implemented yet.
- Host integration: not implemented yet.
- Planned host: unified HomePage system.

## Known Limitations

- No shared/server persistence yet.
- Persistence is local to the current browser only.
- No real users or authentication.
- No real permissions.
- No backend API.
- No HomePage external module registration yet.
- Board columns are not configurable yet.
- Kanban drag-and-drop is not implemented yet.
- Drag-and-drop is not implemented yet.
- Some mock/user-entered task and meeting content remains in the language it was created in.

## Release Goal

The purpose of this release is to validate the first product shape and workflow before backend work begins.

The most important thing to review is whether the meeting-to-task flow feels useful and clear.
