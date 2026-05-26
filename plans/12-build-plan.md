# Build Plan

This document turns the planning into practical implementation phases.

## Build Principle

Build the smallest useful version of the full idea.

Do not build every advanced Monday-style feature first. Build the core engine that can grow:

- Workspace
- Members
- Boards
- Items
- Meetings
- Action conversion
- My Work

## Phase 1: Product Prototype

Goal:

Create a static or mock-data UI that shows the product shape.

Deliverables:

- ActionOS app shell.
- Workspace home screen.
- My Work screen.
- Board list.
- Board table view.
- Board kanban view.
- Item detail panel.
- Meeting list.
- Meeting detail screen.
- Members screen.

Data:

- Mock data only.

Success criteria:

- We can click through the main experience.
- The meeting-to-task workflow is visible.
- We can judge whether the screen structure feels right.

## Phase 2: Frontend State And Mock Services

Goal:

Make the prototype interactive without a real backend.

Deliverables:

- Mock workspace service.
- Mock board service.
- Mock item service.
- Mock meeting service.
- Mock member service.
- Create/update board items in memory.
- Convert meeting note to item in memory.
- My Work reads from mock items.

Success criteria:

- Actions update the UI.
- Converted meeting actions appear in board and My Work.
- Screens behave like the future app.

## Phase 3: Backend Contract And Persistence

Goal:

Add real persistence behind the established workflow.

Deliverables:

- Database schema draft.
- API endpoints for workspaces.
- API endpoints for members.
- API endpoints for boards.
- API endpoints for items.
- API endpoints for meetings.
- API endpoints for comments and activity.

Success criteria:

- Frontend can use real data for core workflows.
- Workspace isolation works.
- Basic role checks exist.

## Phase 4: Collaboration And Accountability

Goal:

Make multi-user behavior meaningful.

Deliverables:

- Comments.
- Mentions.
- Watchers.
- Activity log.
- Basic notifications.
- Overdue and blocked dashboard sections.
- Follow-up debt view.

Success criteria:

- Users can collaborate around work.
- Managers can see risk and unresolved follow-up.

## Phase 5: Fritz Integration

Goal:

Integrate ActionOS into the existing Fritz ecosystem.

Deliverables:

- Shared authentication adapter.
- Shared user adapter.
- Shared navigation entry.
- Lazy-loaded ActionOS route.
- API integration with Fritz backend conventions.
- Permission mapping.

Success criteria:

- A Fritz user can open ActionOS from the main app.
- ActionOS uses real Fritz identity.
- The standalone boundaries still remain clean.

## Phase 6: Advanced Workflows

Goal:

Expand the platform after the foundation is proven.

Candidates:

- Templates.
- Calendar view.
- Timeline view.
- Gantt view.
- Automation builder.
- External calendar integration.
- File attachments.
- AI meeting summaries.
- AI weekly review.

## Recommended First Implementation Path

Start with a standalone ActionOS frontend prototype using mock data.

Reasons:

- We can validate the UX quickly.
- We avoid coupling too early.
- We can keep the product idea moving while Fritz integration details are investigated.
- The mock services can later become real service interfaces.

## Updated Technical Recommendation

After inspecting the current projects, the first implementation should not be built directly inside `FritzControlClientNew` or `ServichClient`.

Reason:

- `HomePage_Client` is Angular 18 and Nx.
- `FritzControlClientNew` is Angular 16.
- `ServichClient` is Angular 8.
- ActionOS needs to be portable across hosts and companies.

Build ActionOS first as a standalone Angular 18 app under the `ActionOS` folder. Then connect it to `HomePage_Client` as an external module and later deepen integration through adapters and APIs.

## First Technical Tasks

When we move from planning to coding, start with:

1. Inspect existing Fritz frontend architecture.
2. Decide whether prototype lives inside `ActionOS` or `FritzControlClientNew`.
3. Create ActionOS app shell.
4. Define TypeScript models from the planning docs.
5. Add mock data services.
6. Build Workspace Home.
7. Build Board Table.
8. Build Meeting Detail.
9. Implement mock action conversion.
10. Build My Work from mock assigned items.

## V1 Definition Of Done

V1 is done when:

- A workspace can have users.
- Users can create boards.
- Boards can contain configurable work items.
- Items can be assigned, prioritized, dated, and updated.
- Meetings can have agenda, notes, decisions, and actions.
- Meeting actions can become board items.
- Assigned users see their work in My Work.
- Managers can see overdue, blocked, and unresolved meeting follow-up.
