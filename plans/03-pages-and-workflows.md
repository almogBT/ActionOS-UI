# Pages And Workflows

## Main Routes

The exact route structure can change during implementation, but this is the first planning draft.

```text
/actionos
/actionos/workspaces
/actionos/workspace/:workspaceId/home
/actionos/workspace/:workspaceId/my-work
/actionos/workspace/:workspaceId/boards
/actionos/workspace/:workspaceId/boards/:boardId
/actionos/workspace/:workspaceId/meetings
/actionos/workspace/:workspaceId/meetings/:meetingId
/actionos/workspace/:workspaceId/dashboards
/actionos/workspace/:workspaceId/members
/actionos/workspace/:workspaceId/settings
```

## Page List

### Workspace Selector

Purpose:

- Choose a workspace.
- Create a new workspace.
- See recent workspaces.

### Workspace Home

Purpose:

- Give a team-level overview.
- Surface overdue work.
- Show recent activity.
- Show upcoming meetings.
- Show important board updates.

Expected sections:

- My assigned work.
- Team overdue items.
- Blocked items.
- Upcoming meetings.
- Recently updated items.
- Recently made decisions.

### My Work

Purpose:

- Give each user a personal command center.

Expected sections:

- Today.
- Upcoming.
- Overdue.
- Blocked.
- Waiting on others.
- Mentioned recently.
- Watched items.
- Meeting follow-ups.

### Boards List

Purpose:

- Browse, search, create, and organize boards.

Expected sections:

- Favorite boards.
- Recent boards.
- All boards.
- Templates.
- Archived boards.

### Board Detail

Purpose:

- Work inside a specific board.

Initial views:

- Table.
- Kanban.

Later views:

- Calendar.
- Timeline.
- Dashboard.
- Form.

Expected actions:

- Add item.
- Edit item.
- Assign owner.
- Change status.
- Change priority.
- Set due date.
- Add comment.
- Filter and sort.
- Save view.

### Item Detail Panel

Purpose:

- Edit and discuss a work item without losing the board context.

Expected sections:

- Main fields.
- Description.
- Checklist.
- Comments.
- Activity.
- Related items.
- Source meeting if applicable.

### Meetings List

Purpose:

- See upcoming and past meetings.

Expected sections:

- Upcoming.
- Today.
- Past.
- Recurring series.
- Meetings with unresolved actions.

### Meeting Detail

Purpose:

- Plan, run, and follow up from a meeting.

Expected sections:

- Meeting metadata.
- Attendees.
- Agenda.
- Notes.
- Decisions.
- Action items.
- Linked board items.
- Unresolved previous actions.
- Follow-up summary.

### Dashboards

Purpose:

- Show configurable workspace-level reporting.

Possible widgets:

- Items by status.
- Items by priority.
- Items by owner.
- Overdue by team.
- Blocked work.
- Meeting action completion.
- Decisions this week.

### Members

Purpose:

- Manage workspace people and teams.

Expected actions:

- Invite member.
- Remove member.
- Change role.
- Create team.
- Add member to team.

### Settings

Purpose:

- Configure workspace-level behavior.

Expected sections:

- General.
- Roles and permissions.
- Notifications.
- Templates.
- Integrations later.

## Core Workflows

### Create A Board

1. User opens Boards.
2. User creates a board from blank or template.
3. User chooses initial columns.
4. User adds groups or sections.
5. User adds work items.

### Manage Work

1. User opens a board.
2. User filters or switches view.
3. User updates item status, owner, priority, or due date.
4. System records activity.
5. Assignees and watchers receive notifications.

### Run A Meeting

1. User creates or opens meeting.
2. User adds agenda items.
3. During meeting, user captures notes.
4. User marks important lines as decisions or actions.
5. Action items are converted into board items.
6. Follow-up summary shows new work and unresolved previous work.

### Review My Work

1. User opens My Work.
2. User sees today, overdue, and upcoming sections.
3. User updates status or due dates.
4. User opens linked meetings or board items where needed.

### Track Follow-Up Debt

1. Manager opens workspace home or dashboard.
2. Manager sees unresolved meeting action items.
3. Manager filters by owner, meeting, board, or age.
4. Manager follows up through comments or assignment changes.

