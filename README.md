# ActionOS

ActionOS is a planned multi-user work management module for the Fritz ecosystem.

The goal is to build something in the spirit of Monday.com, but with a stronger focus on meetings, follow-up accountability, flexible work boards, and team execution.

## Product Sentence

ActionOS v1 is a multi-user workspace platform with flexible boards, task ownership, meeting-driven action tracking, and personal/team dashboards.

## Core Idea

Everything important becomes a trackable work item:

- Tasks
- Meetings
- Decisions
- Action items
- Blockers
- Requests
- Projects
- Follow-ups
- Client work
- Internal processes

ActionOS should help a team answer:

- What are we working on?
- Who owns what?
- What is blocked?
- What was promised in meetings?
- What is overdue?
- What needs attention today?
- What changed since the last meeting?

## Documentation Map

- [plans/01-product-vision.md](plans/01-product-vision.md): product direction and principles.
- [plans/02-mvp-scope.md](plans/02-mvp-scope.md): v1 feature boundaries.
- [plans/03-pages-and-workflows.md](plans/03-pages-and-workflows.md): main screens and user flows.
- [plans/04-data-model.md](plans/04-data-model.md): initial entity model.
- [plans/05-permissions-and-collaboration.md](plans/05-permissions-and-collaboration.md): roles, teams, comments, notifications.
- [plans/06-architecture-and-integration.md](plans/06-architecture-and-integration.md): standalone-first strategy and Fritz integration.
- [plans/07-roadmap-and-backlog.md](plans/07-roadmap-and-backlog.md): phased roadmap and future ideas.
- [plans/08-decisions-log.md](plans/08-decisions-log.md): decisions we have already made.
- [plans/09-user-stories-and-acceptance.md](plans/09-user-stories-and-acceptance.md): user stories and acceptance criteria for v1.
- [plans/10-ux-screen-plan.md](plans/10-ux-screen-plan.md): screen-by-screen UX planning.
- [plans/11-api-contract-draft.md](plans/11-api-contract-draft.md): first API shape for frontend/backend alignment.
- [plans/12-build-plan.md](plans/12-build-plan.md): practical implementation phases.
- [plans/13-portability-and-host-integration.md](plans/13-portability-and-host-integration.md): standalone and host integration model.
- [plans/14-technical-discovery.md](plans/14-technical-discovery.md): findings from inspecting HomePage, FritzControl, and Servitz apps.
- [plans/15-complete-app-execution-plan.md](plans/15-complete-app-execution-plan.md): path from prototype to testable complete MVP.
- [plans/16-api-boundary-plan.md](plans/16-api-boundary-plan.md): current local persistence boundary and backend swap plan.
- [plans/17-meeting-module-monday-implementation.md](plans/17-meeting-module-monday-implementation.md): v3 Customer Meeting Management module — data model, ports, Fritz/Azure source mapping, and the boundary with FritzCustomersApi CRM meetings.

## Implementation Map

- [app](app): standalone Angular 18 ActionOS prototype.

## Prototype Handoff

- [RELEASE_NOTIFICATION.md](RELEASE_NOTIFICATION.md): summary of the current prototype release.
- [TESTING_GUIDE.md](TESTING_GUIDE.md): manual testing checklist for each feature.

## Current Planning Decisions

- Name: ActionOS.
- Scope: multi-user workspace from day one.
- Direction: Monday-style flexible boards, but with deeper meeting and follow-up workflows.
- ActionOS should be a portable product module, not a one-off page inside one app.
- It should run standalone for our own team and integrate into host systems later.
- The first unified host target is the HomePage client/server system, which can connect ActionOS with FritzControl and Servitz.
- Host integration should happen through clear adapters, APIs, and route/module mounting.

## First Build Principle

Do not try to clone every Monday.com feature immediately.

The first version should prove the engine:

- A workspace can have users and roles.
- Users can create boards.
- Boards can hold flexible work items.
- Teams can run meetings.
- Meeting notes can become assigned tasks.
- Users can see their own work and team follow-up status.

## v3 — Customer Meeting Management

The v3 release (May 2026) adds a dedicated customer-centric meeting management module alongside the existing screens. See [plans/17-meeting-module-monday-implementation.md](plans/17-meeting-module-monday-implementation.md) for the full design and Fritz/Azure source mapping. Highlights:

- Customers (existing + prospect) become the anchor for meetings and tasks.
- Customer 360 view shows meeting history and open-task status at a glance.
- Pre-meeting briefing per customer (prior meetings, overdue tasks, waiting-for-customer).
- Employees come from a Fritz directory port — assignable set = active fritz/critilog employees only.
- Notification port logs assignment / status-change / due-soon events; future Logic Apps swap is a one-class change.
- Existing Boards / Inbox / My Work / Meetings / Members screens are preserved untouched.
