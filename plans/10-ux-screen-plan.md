# UX Screen Plan

This document describes the first screen set for ActionOS.

The UI should feel like a serious work tool: dense, clear, fast, and easy to scan.

## Global App Shell

Persistent areas:

- Left navigation.
- Top workspace switcher.
- Search.
- Create button.
- Notifications entry.
- Current user menu.

Primary navigation:

- Home
- My Work
- Boards
- Meetings
- Dashboards
- Members
- Settings

## Workspace Selector

Purpose:

- Let the user choose or create a workspace.

Content:

- Workspace list.
- Recent workspaces.
- Create workspace action.

Empty state:

- Prompt to create first workspace.

## Workspace Home

Purpose:

- Show the team what needs attention.

Layout:

- Header with workspace name and quick actions.
- Summary strip with counts.
- Main area with work health sections.
- Activity column.

Primary sections:

- Overdue items.
- Blocked items.
- Upcoming meetings.
- Unresolved meeting actions.
- Recent activity.
- Recent decisions.

Key interactions:

- Open item detail.
- Open meeting detail.
- Filter by owner.
- Filter by board.

## My Work

Purpose:

- Give one user a daily command center.

Layout:

- Header with user-focused summary.
- Tabs or segmented control for Today, Upcoming, Overdue, Watched.
- Work list grouped by date or status.
- Side panel for selected item.

Primary sections:

- Today.
- Overdue.
- Upcoming.
- Blocked.
- Waiting on others.
- Meeting follow-ups.
- Watched.

Key interactions:

- Change status.
- Change due date.
- Open source board.
- Open source meeting.
- Add quick task.

## Boards List

Purpose:

- Let users find and create boards.

Layout:

- Header with create board action.
- Search and filters.
- Favorite boards.
- Recent boards.
- All boards.
- Template entry points.

Board card/list information:

- Board name.
- Type.
- Owner.
- Last updated.
- Open item count.
- Overdue count.

## Board Detail

Purpose:

- Main working surface for board items.

Layout:

- Board header.
- View tabs.
- Toolbar.
- Main view area.
- Optional item detail side panel.

Header:

- Board name.
- Favorite.
- Members.
- Share/permissions.
- View settings.

Toolbar:

- Add item.
- Filter.
- Sort.
- Group.
- Search.
- Columns.

Views for v1:

- Table view.
- Kanban view.

Table view:

- Rows are items.
- Columns are board fields.
- Inline editing for common fields.
- Sticky title column if practical.

Kanban view:

- Columns grouped by status.
- Cards show title, assignees, priority, due date, source meeting indicator.
- Drag between statuses later.

## Item Detail Panel

Purpose:

- Allow focused editing without leaving the board.

Content:

- Title.
- Description.
- Main fields.
- Assignees.
- Watchers.
- Checklist.
- Related items.
- Source meeting.
- Comments.
- Activity.

Key interactions:

- Edit fields.
- Add comment.
- Mention user.
- Watch/unwatch.
- Open source meeting.

## Meetings List

Purpose:

- Show upcoming, current, and previous meetings.

Layout:

- Header with create meeting action.
- Tabs for Upcoming, Today, Past, Unresolved.
- Meeting list.
- Filters by attendee, owner, date, and board.

Meeting list item:

- Title.
- Time.
- Attendees.
- Open action count.
- Decision count.
- Linked board.

## Meeting Detail

Purpose:

- Plan, run, and follow up from a meeting.

Layout:

- Meeting header.
- Left/main content area for agenda and notes.
- Right follow-up panel.

Header:

- Title.
- Date and time.
- Attendees.
- Status.
- Linked boards.

Main content:

- Agenda.
- Notes.
- Decisions.
- Blockers.

Follow-up panel:

- New action items.
- Converted board items.
- Previous unresolved actions.
- Follow-up summary.

Key interactions:

- Add agenda item.
- Add note.
- Mark note as decision/action/blocker.
- Convert action to board item.
- Assign owner and due date.
- Complete meeting.

## Dashboards

Purpose:

- Give managers and teams an overview.

V1 dashboard widgets:

- Items by status.
- Items by priority.
- Items by owner.
- Overdue by board.
- Blocked by board.
- Meeting actions by completion.
- Recent decisions.

## Members

Purpose:

- Manage workspace access.

Layout:

- Member table.
- Invite action.
- Role filter.
- Team filter.

Table fields:

- Name.
- Email.
- Role.
- Teams.
- Status.
- Last active later.

## Settings

Purpose:

- Configure workspace basics.

V1 sections:

- General.
- Roles.
- Board defaults.
- Notification defaults.
- Templates later.

