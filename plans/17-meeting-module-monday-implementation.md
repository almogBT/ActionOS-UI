# 17 — Customer Meeting Management Module (Monday-style)

Status: implemented as v3 local prototype
Date: 2026-05-26

This doc is the canonical reference for the Customer Meeting Management module that was added to ActionOS in response to the Hebrew spec and the Monday board notes from Dana Lerner.

## Why this module exists

The Hebrew brief asked for a Monday-style customer meeting management module covering: customer list with linked meeting summaries and tasks, uniform meeting templates, meeting-driven tasks with handler/priority/status/attachments, pre-meeting briefing per customer, integration with the Fritz employees table, prospect customers, and notifications.

The existing ActionOS prototype was internal-work-centric (boards, inbox, my-work) and lacked a Customer entity. We added the customer-centric module **alongside** (not replacing) the existing screens.

## Source mapping (future Azure / Fritz)

| Concept | Future source | Notes |
| --- | --- | --- |
| Employee | `reportcental.emp.EasyDoc_Employees_Dim` | Filter: `IsActive = 1` AND email matches `@fritz.*` or `@critilog.*` (per Dana Lerner) |
| Customer | `reportcental.[dig].[Servitz_Customers_Groups]` | The customer group IS the customer; `externalGroupId` is the FK |
| Security | All Fritz/Critilog users see all customer groups (QMS-style) | Do NOT design per-user scoping into ports |
| Notifications | Azure Logic Apps, triggered via HomePage_Server | Send to opener + assignee (per Dana Lerner's Monday note) |
| Attachments | SharePoint (reuse FritzCustomersApi pattern) | Same library, same auth, same folder convention |
| Auth / identity | HomePage MSAL → token postMessage into ActionOS iframe | Replaces hardcoded `currentUserId` |

ActionOS never queries the DB or SharePoint directly. All integration runs through HomePage_Server.

## Boundary with FritzCustomersApi

FritzCustomersApi already has `api/meeting/*` endpoints — CRM-style meetings owned by sales with file storage in SharePoint. **ActionOS Customer Meetings are operational, not CRM.** They live separately. ActionOS holds an optional `CustomerMeeting.externalCrmMeetingId` reference but never writes to FritzCustomersApi. The two systems coexist.

## Data model (v3)

All v3 types live in [actionos.models.ts](../app/src/app/core/models/actionos.models.ts).

```
Customer (1) ──── (n) CustomerMeeting (1) ──── (n) MeetingTask
   │                       │                          │
   │                       │                          └─→ Employee (assignedTo, openedBy)
   │                       ├─→ Employee (leader)
   │                       ├─→ Employee[] (internal participants)
   │                       ├─→ CustomerParticipant[]
   │                       └─→ MeetingNote[] (typed: decision|blocker|action|note)
   │
   └─→ Employee (accountOwner)
```

Notes are kept as a **typed array** inside the meeting (not split into free-text decisions/blockers fields). This preserves the existing `MeetingNote.convertedTaskId` link to `MeetingTask` — actions become tasks while keeping the breadcrumb.

`Attachment` is a thin record with `linkedEntityType` + `linkedEntityId`. The mock adapter stores a `mock://` URL; the real one will hit SharePoint.

## Ports / adapters

All under [app/src/app/core/services/](../app/src/app/core/services/):

| File | Purpose |
| --- | --- |
| `customer-repository.port.ts` | CRUD + prospect→existing promotion |
| `meeting-repository.port.ts` | Customer meetings (separate from legacy Meeting) |
| `meeting-task-repository.port.ts` | Meeting-driven tasks, plus `isOpenStatus` / `isOverdue` helpers |
| `employee-directory.port.ts` | Read-only Fritz employees; `hasFritzDomain` regex enforces the email-domain filter |
| `notification.port.ts` | Three typed events (assigned, status-changed, due-soon); local mock logs to `MeetingTask.notifications[]` |
| `attachment-storage.port.ts` | Mock upload to a `mock://` URL; future: SharePoint |

Each file has both the `*Port` interface and a `InMemory*` adapter. The workspace service constructs adapters with closures that point at shared state arrays and a `saveToStorage()` callback — so swapping in an HTTP adapter later is a one-line change in the service constructor.

## Persistence

Single localStorage key, `actionos.local-state.v3`. On first load after upgrade, the service detects the legacy `actionos.local-state.v2` key, removes it, and seeds fresh v3 mock data. This is logged as `[ActionOS] v2 state detected and cleared.` and documented in [../RELEASE_NOTIFICATION.md](../RELEASE_NOTIFICATION.md).

## Screens

| Component | File | Purpose |
| --- | --- | --- |
| `CustomersComponent` | `app/src/app/features/customers/customers.component.ts` | Container; switches between list / detail / meeting-form / prep |
| `CustomerListComponent` | `customer-list.component.ts` | Table + filters (All / Existing / Prospect / At Risk) + add form |
| `Customer360Component` | `customer-360.component.ts` | KPIs (last/next meeting, open/overdue tasks) + tabs (Meetings / Open / Closed / Attachments) + prospect promotion |
| `CustomerMeetingFormComponent` | `customer-meeting-form.component.ts` | Unified meeting summary form + typed-notes capture inline |
| `MeetingTaskCreationComponent` | `meeting-task-creation.component.ts` | Inline task creator triggered from an action note |
| `MeetingPrepComponent` | `meeting-prep.component.ts` | Pre-meeting briefing (R8); printable |

The task drawer ([task-drawer.component.ts](../app/src/app/features/task-drawer/task-drawer.component.ts)) was extended with a `'meeting-task'` mode that renders meeting-task-specific fields (customer, source meeting, treatment notes, notification log) alongside the existing board-task drawer.

## Security & guardrails

- `EmployeeDirectoryPort.list()` and `.isAssignable()` enforce the active-fritz/critilog rule. Mock data includes one inactive and one non-fritz employee specifically to verify the filter.
- `createTaskFromMeeting` and `updateMeetingTask` refuse to assign to a non-assignable employee and log a console warning. The UI also disables the create button until a valid assignee is picked.
- All inline form controls on list-row containers use `(click)="$event.stopPropagation()"` to prevent accidental drawer opens (the bug noted in the original prompt).

## Notifications

The `NotificationPort` mock writes to `MeetingTask.notifications[]` and `console.info`. Three event triggers:

| Event | Trigger | Recipients |
| --- | --- | --- |
| `assigned` | `createTaskFromMeeting`, or `updateMeetingTask` with new assignee | opener + assignee |
| `status-changed` | `updateMeetingTask` with a different `status` | opener |
| `due-soon` | (not wired automatically in v3 — handler exists for future scheduled job) | assignee |

The real implementation will replace `LocalMockNotificationAdapter` with an HTTP call to HomePage_Server, which posts to an Azure Logic App that does the SMTP send.

## i18n

All new screens read from [en.json](../app/public/i18n/en.json) and [he.json](../app/public/i18n/he.json). New top-level keys: `customers`, `customerType`, `customerStatus`, `customer360`, `customerMeeting`, `meetingTask`, `meetingPrep`, `attachments`, `validation`. Hebrew translations are hand-written and respect RTL (driven by [actionos-i18n.service.ts](../app/src/app/core/i18n/actionos-i18n.service.ts), unchanged).

## What's still out of scope (deferred)

- Real Azure / HomePage / SharePoint integration
- MSAL identity (still hardcoded `currentEmployeeId = 'emp-1'`)
- Real attachment upload (mock blob URLs only)
- Drag-and-drop
- Multi-workspace tenancy
- Auto-scheduled `due-soon` notifications
- Bidirectional sync with FritzCustomersApi CRM meetings

## Acceptance criteria status

Per the v3 task ([../../AI/tasks/ActionOS/customer-meeting-module-v3.md](../../AI/tasks/ActionOS/customer-meeting-module-v3.md)), each acceptance criterion in the plan ([../../../.claude/plans/think-as-coding-expert-mighty-gray.md](../../../.claude/plans/think-as-coding-expert-mighty-gray.md)) is implemented; the 17-step verification plan is documented in [../TESTING_GUIDE.md](../TESTING_GUIDE.md). Per CLAUDE.md, the task status flips to `done` only after manual user verification.
