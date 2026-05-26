# Roadmap And Backlog

## Phase 0: Planning

Status: in progress.

Goals:

- Document product vision.
- Define MVP scope.
- Define page map.
- Define data model.
- Define integration strategy.
- Decide first implementation path.

## Phase 1: Prototype UI

Goal:

Create a clickable, realistic UI prototype with mock data.

Candidate features:

- Workspace shell.
- My Work dashboard.
- Board table view.
- Board kanban view.
- Meeting detail page.
- Item detail panel.
- Member list.

Success:

- We can see the shape of ActionOS.
- We can test the workflow from meeting to task.
- We can decide what feels too complex or missing.

## Phase 2: Core Engine

Goal:

Make the foundation functional.

Candidate features:

- Workspace CRUD.
- Member management.
- Board CRUD.
- Board columns.
- Board items.
- Table view.
- Kanban view.
- Filters and sorting.
- Comments.
- Activity log.

Success:

- A team can create boards and manage work.

## Phase 3: Meeting Engine

Goal:

Make meetings a first-class source of work.

Candidate features:

- Meeting list.
- Meeting detail.
- Agenda.
- Notes.
- Decisions.
- Action items.
- Convert action to board item.
- Link board items back to source meeting.
- Previous unresolved actions.

Success:

- A team can run a meeting and leave with trackable work.

## Phase 4: Dashboards And Accountability

Goal:

Surface ownership and risk.

Candidate features:

- My Work.
- Workspace home.
- Overdue items.
- Blocked items.
- Follow-up debt.
- Commitment tracker.
- Team workload.
- Recent decisions.

Success:

- Users and managers can quickly see what needs attention.

## Phase 5: Automations

Goal:

Reduce manual follow-up work.

Candidate features:

- Rule builder.
- Due date reminders.
- Status-change notifications.
- Meeting follow-up rules.
- Recurring task creation.
- Blocked item escalation.

Success:

- Teams can automate common workflow actions.

## Phase 6: Advanced Views

Goal:

Expand beyond table and kanban.

Candidate features:

- Calendar view.
- Timeline view.
- Gantt view.
- Workload view.
- Form view.
- Dashboard builder.

Success:

- Boards can support multiple serious workflows.

## Future Ideas

- AI meeting summaries.
- AI suggested tasks.
- AI weekly review.
- Cross-board formulas.
- Import from Excel/CSV.
- Export reports.
- External calendar sync.
- Email-to-board item.
- Public forms.
- Client portal.
- File attachments.
- Rich document pages.
- Mobile-first task capture.
- Desktop notifications.

## Open Questions

- Should ActionOS share the existing Fritz user model directly or map users through an adapter?
- Should the first prototype live inside `FritzControlClientNew` or in a separate Angular app?
- What backend should own ActionOS persistence?
- Should workspaces map to existing Fritz customers/companies?
- Do we need real-time updates in v1 or later?
- What is the first real team workflow we want to support?

