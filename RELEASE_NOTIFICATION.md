# ActionOS Release Notification

**Release date:** 2026-05-31  
**Release version:** v3.2  
**Previous version:** v3.1 (2026-05-26)

---

## v3.2 Highlights

This release delivers targeted improvements to the **Boards** module — clickable rows, HUD tile popups, and full client-task visibility — along with bug fixes to the popup appearance and board-type switching behavior.

---

## What Changed in v3.2

### Boards — Clickable Rows (Client Board)

Meeting rows in the **Client Meetings** panel and task rows in the **Meeting Tasks** panel are now fully clickable:

- Clicking a meeting row opens the **Meeting Drawer** with the correct meeting pre-loaded.
- Clicking a task row opens the **Task Drawer** with the correct task pre-loaded.
- Closing a drawer and clicking a different row loads the new content correctly.

### Boards — HUD Tiles Always One Row

The three HUD stat tiles (Meetings / Total Tasks / Open Tasks or Blocked) now stay in a single row at all supported viewport widths, including ~800 px. Tiles no longer wrap to a second row on narrower windows.

### Boards — Stat Tile Popups

Each HUD tile now opens a popup on click:

| Tile | Client Board | Member Board |
|------|-------------|--------------|
| Meetings | Lists meetings for the selected client; each row opens Meeting Drawer | N/A |
| Total Tasks | Lists all tasks (board + meeting) for client/member; row click opens Task Drawer | ✓ |
| Open Tasks | Filtered to open/in-progress tasks; count matches tile | ✓ |
| Blocked | — | Filtered to Waiting/Waiting For Customer/Waiting For Internal or `blockedBy` set |

Popup behavior:
- Clicking the same tile while the popup is open **closes** the popup (toggle).
- Clicking the **✕** button or the backdrop also closes the popup.
- The active tile shows an accent border + glow while its popup is open.
- Popup backgrounds are now **solid** (non-transparent), matching other panels in the app.

### Boards — Client Board Shows All Tasks

The Client Board now shows **both board tasks and meeting tasks** for the selected client:

- Board tasks: `source = 'board'` + `customerId` matches selected client.
- Meeting tasks: `source = 'meeting'` + meeting belongs to selected client.
- Task row subtitle distinguishes source: board tasks show the board name; meeting tasks show assignee + due date.
- **Total Tasks** tile count = board tasks + meeting tasks.
- Clicking a board task row opens Task Drawer in **board-task mode**.
- Clicking a meeting task row opens Task Drawer in **meeting-task mode**.

### Boards — Bug Fixes

| Issue | Fix |
|-------|-----|
| Popup background was semi-transparent in dark mode | Background now matches panel solid color in both themes |
| Switching client in dropdown left popup open | Popup now auto-closes on client switch |
| Switching board type (Client ↔ Member) left popup open | Popup now auto-closes; HUD resets |

---

## v3.1 Summary (2026-05-26)

ActionOS was restructured into two standalone module folders:

- `ActionOS/ActionOS-UI` — Angular 18 UI module (port 4305)
- `ActionOS/ActionOS-API` — .NET 8 backend module (port 7052)

**ActionOS-API added:**

New API routes:

```
GET  /api/actionos/clients
GET  /api/actionos/clients/{orgGroupId}/boards
POST /api/actionos/clients/{orgGroupId}/boards
GET  /api/actionos/boards/{boardId}/tasks
POST /api/actionos/boards/{boardId}/tasks
PATCH /api/actionos/tasks/{taskId}
GET  /api/actionos/clients/{orgGroupId}/meetings
POST /api/actionos/clients/{orgGroupId}/meetings
PATCH /api/actionos/meetings/{meetingId}
GET  /api/actionos/orgs/{orgGroupId}/users
```

Data sources:

- Customers/groups: `reportcentral.dig.Servitz_Customers_Groups`
- Assignable users: `reportcentral.emp.EasyDoc_Employees_Dim` (employee/direct-manager/indirect-manager role filter)

ActionOS-owned persistence tables: `ActionosBoards`, `ActionosBoardMembers`, `ActionosTasks`, `ActionosMeetings`, `ActionosAuditLog`

Schema script: `ActionOS/ActionOS-API/ActionOS.Api/Sql/001_actionos_schema.sql`

---

## v3 Summary

v3 introduced the **Customer Meeting Management** module:

- Customer-centric meeting screens
- Customer 360 view
- Meeting notes (note / decision / action / blocker types)
- Meeting-to-task conversion workflow
- Local-first persistence in UI

---

## Current Architecture

```
ActionOS/
├── ActionOS-UI/        Angular 18  →  http://127.0.0.1:4305
└── ActionOS-API/       .NET 8      →  https://localhost:7052
```

- ActionOS backend logic lives entirely in `ActionOS-API`.
- No ActionOS-specific runtime logic was added to `HomePage_Server`.
- Auth: Azure B2C JWT Bearer tokens.
- External data: ReportCentral (read-only SQL Server).
- Notifications: Azure Logic Apps (configurable; disabled by default).

---

## Pending Items (Not In This Release)

| Item | Status |
|------|--------|
| UI HTTP repository wiring (full API-backed persistence) | In progress |
| Logic Apps email notification wiring | Pending — `ActionosNotifications:Enabled = false` |
| SharePoint attachment integration | Pending |
| Host auth / token bootstrap end-to-end validation | Pending |

---

## How to Deploy

### API

```powershell
cd ActionOS/ActionOS-API/ActionOS.Api
dotnet publish -c Release -o ./publish
# Deploy publish/ folder to target environment
# Set appsettings environment variables for ConnectionStrings and ActionosJwt
```

### UI

```powershell
cd ActionOS/ActionOS-UI/app
npm run build
# Deploy dist/actionos-app/browser/ as static files
```

### Database

Run migration scripts in order:

```
001_actionos_schema.sql
002_actionos_task_improvements.sql
003_actionos_real_backend_cutover.sql
```

---

*ActionOS v3.2 — Released 2026-05-31*
