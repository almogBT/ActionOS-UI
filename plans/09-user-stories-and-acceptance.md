# User Stories And Acceptance Criteria

This document defines the first user-facing behaviors ActionOS should support.

## V1 Happy Path

The first complete workflow should be:

1. A user opens ActionOS.
2. The user creates or selects a workspace.
3. The user adds members or uses existing workspace members.
4. The user creates a board.
5. The user adds work items to the board.
6. The user assigns items and due dates.
7. The user creates a meeting.
8. The user writes agenda, notes, decisions, and action items.
9. The user converts action items into board items.
10. Assigned users see those items in My Work.
11. The team tracks completion from dashboards and boards.

## Workspace Stories

### Create Workspace

As a user, I want to create a workspace so that my team has a shared place to manage work.

Acceptance:

- User can enter workspace name.
- User becomes workspace owner.
- Workspace appears in workspace selector.
- Workspace has default roles.

### Invite Member

As an owner or admin, I want to invite members so that my team can collaborate.

Acceptance:

- User can invite by email.
- User can choose a role.
- Invite appears as pending.
- Invited member can later become active.

### Manage Members

As an owner or admin, I want to manage members so that access stays accurate.

Acceptance:

- User can view workspace members.
- User can change role.
- User can disable access.
- Activity is recorded.

## Board Stories

### Create Board

As a workspace member with permission, I want to create a board so that I can model a workflow.

Acceptance:

- User can create a blank board.
- User can create a board from a template later.
- Board has default columns.
- Board appears in board list.

### Add Board Columns

As a board manager, I want to add columns so that the board matches the workflow.

Acceptance:

- User can add supported field types.
- User can rename columns.
- User can reorder columns.
- Existing items can receive values for new columns.

### Add Work Item

As a user, I want to add an item to a board so that work can be tracked.

Acceptance:

- User can enter title.
- User can set status, priority, owner, and due date.
- Item appears in table and kanban views.
- Item creation is recorded in activity.

### Update Work Item

As an assignee, I want to update my item so that the team knows the current state.

Acceptance:

- User can update item fields they have access to edit.
- Status changes appear in activity.
- Watchers and assignees can be notified.
- Item updates appear in My Work where relevant.

## Meeting Stories

### Create Meeting

As a user, I want to create a meeting so that agenda, notes, and follow-up are tracked.

Acceptance:

- User can enter title, date, time, and attendees.
- User can add agenda items.
- Meeting appears in meeting list.
- Meeting can link to boards and items.

### Capture Meeting Notes

As a meeting participant, I want to capture structured notes so that decisions and actions are not lost.

Acceptance:

- User can add notes.
- User can mark note lines as note, decision, action, or blocker.
- Notes keep author and timestamp.
- Decisions appear in the decision list.

### Convert Action To Board Item

As a meeting owner, I want to convert an action item into a board item so that follow-up is assigned and tracked.

Acceptance:

- User can select an action note.
- User can choose destination board.
- User can assign owner, priority, and due date.
- Created board item links back to the meeting.
- Meeting shows the action as converted.
- Assignee sees the item in My Work.

### Review Previous Meeting Actions

As a meeting owner, I want to see unresolved actions from previous meetings so that follow-up stays visible.

Acceptance:

- Meeting detail shows unresolved linked items.
- User can filter by owner and status.
- Completed items are visually separated from open items.

## Dashboard Stories

### View My Work

As a user, I want to see all work assigned to me so that I know what to do next.

Acceptance:

- User sees today, overdue, upcoming, blocked, and watched sections.
- User can update status directly.
- User can open source board or meeting.
- Meeting-created tasks are clearly identified.

### View Workspace Home

As a manager, I want to see team status so that I can spot risk quickly.

Acceptance:

- User sees overdue items.
- User sees blocked items.
- User sees upcoming meetings.
- User sees recent activity.
- User sees unresolved meeting actions.

## Collaboration Stories

### Comment On Item

As a user, I want to comment on work items so that discussion stays attached to the work.

Acceptance:

- User can add comments.
- User can mention users.
- Mentioned users receive notification later.
- Comments appear in item detail.

### Watch Item

As a user, I want to watch an item so that I can follow progress even if I am not assigned.

Acceptance:

- User can watch or unwatch item.
- Watched items can appear in My Work.
- Watchers can receive update notifications.

## V1 Definition Of Done

V1 is done when a small team can:

- Create a workspace.
- Add members.
- Create a board.
- Manage work items.
- Run a meeting.
- Convert meeting actions into assigned board items.
- See assigned work in My Work.
- Review overdue, blocked, and unresolved follow-up work.

