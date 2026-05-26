# Decisions Log

This file tracks product and architecture decisions from day one.

## 2026-05-25

### Decision: Name The Module ActionOS

We chose `ActionOS` as the working name.

Reason:

- It communicates that the module is more than task management.
- It fits the idea of a work operating system.
- It leaves room for boards, meetings, dashboards, automation, and future integrations.

### Decision: Multi-User Workspace From Day One

ActionOS should not start as a personal-only productivity tool.

Reason:

- Reworking a personal app into a multi-user system later would be painful.
- Permissions, ownership, assignment, and activity history affect the data model.
- The long-term goal is closer to Monday.com than to a simple task list.

### Decision: Flexible Boards Are The Foundation

ActionOS should be built around boards, items, custom fields, and views.

Reason:

- This supports many workflows.
- It gives us Monday-style flexibility.
- Tasks, projects, bugs, clients, requests, and meeting follow-ups can share one engine.

### Decision: Meeting Follow-Up Is A Differentiator

Meetings should be deeply connected to work items.

Reason:

- Many tools store meeting notes separately from execution.
- ActionOS should make meeting promises visible and accountable.
- This gives the product a stronger identity than a generic board clone.

### Decision: Action Items Should Become Board Items

Meeting action items should usually be stored as `BoardItem` records with `sourceMeetingId`.

Reason:

- Avoids two separate task systems.
- Keeps assignments, due dates, status, comments, and dashboards consistent.
- Makes meeting actions visible across normal work views.

### Decision: Standalone First, Integrated Later

ActionOS should be planned as an independent module/app first, then integrated into the full Fritz project.

Reason:

- Faster product iteration.
- Cleaner boundaries.
- Easier to test ideas before coupling them to existing systems.
- Integration can happen later through adapters and lazy-loaded routes.

### Decision: ActionOS Must Be Portable Across Hosts

ActionOS should be a reusable product module, not a one-off page inside FritzControl or any single app.

Reason:

- We want to use it standalone for our own team.
- We want to integrate it into the unified HomePage client/server system.
- Through HomePage, it should connect with FritzControl, Servitz, and other existing projects.
- Later, it should be possible to integrate ActionOS into other company systems.
- This requires clean adapters, explicit external references, and strong data ownership boundaries from day one.

### Decision: HomePage Is The First Unified Host Target

The unified HomePage system should be the first planned host integration target.

Reason:

- HomePage can act as the central entry point.
- HomePage can provide shared identity, navigation, and app/module access.
- ActionOS can remain portable while still participating in the broader Fritz ecosystem.
- FritzControl and Servitz integrations can happen through explicit links and adapters instead of direct coupling.

### Decision: Do Not Build ActionOS Directly Inside FritzControlClientNew Or ServichClient First

ActionOS should not start as code inside `FritzControlClientNew` or `ServichClient`.

Reason:

- `FritzControlClientNew` is Angular 16.
- `ServichClient` is Angular 8.
- `HomePage_Client` is Angular 18 and is the better unified host.
- ActionOS needs a portable foundation that can run standalone and integrate into other companies later.
- Directly embedding in older app code would make ActionOS harder to reuse.

### Decision: Start With A Standalone Angular 18 Prototype

The first build should be a standalone Angular 18 ActionOS frontend with mock data.

Reason:

- It matches the modern HomePage frontend generation.
- It lets us validate UX and workflow quickly.
- It keeps backend, FritzControl, and Servitz coupling out of the first prototype.
- It can later be registered as a HomePage external module.
