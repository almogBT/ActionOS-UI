# Permissions And Collaboration

## Permission Principle

ActionOS is multi-user from day one.

Even if the first UI is simple, the model should support workspace membership, roles, ownership, board permissions, activity history, and notifications.

## Initial Roles

### Owner

Full control of the workspace.

Can:

- Manage workspace settings.
- Manage members.
- Manage roles.
- Create, update, archive, and delete boards.
- Access all workspace content.
- Transfer ownership later.

### Admin

Operational administrator.

Can:

- Manage members.
- Manage boards.
- Manage templates.
- View workspace dashboards.
- Configure workspace-level settings.

### Manager

Team or process owner.

Can:

- Create boards.
- Manage boards they own.
- Create meetings.
- Manage team dashboards.
- Assign work.
- Update workflow configuration where allowed.

### Member

Regular workspace user.

Can:

- View permitted boards.
- Create and update permitted items.
- Comment.
- Be assigned work.
- Create meetings if allowed.

### Viewer

Read-only user.

Can:

- View permitted boards and meetings.
- View dashboards.
- Cannot create or update work.

### Guest

Limited external or partial-access user.

Can:

- Access explicitly shared boards, meetings, or items.
- Comment if allowed.
- Cannot browse the whole workspace.

## Permission Layers

Plan for these layers:

- Workspace-level permissions.
- Board-level permissions.
- Item-level ownership.
- Meeting-level access.
- Dashboard visibility.

V1 can start mainly with workspace roles and basic board visibility.

## Board Visibility

Initial board visibility options:

- `workspace`: visible to all workspace members.
- `private`: visible only to selected members.
- `shared`: visible to selected internal members and guests.

## Collaboration Features

### Comments

Users should be able to comment on:

- Board items.
- Meetings.
- Decisions.

### Mentions

Mentions should notify users.

Examples:

- `@user`
- `@team`

### Watchers

Users can follow work they are not assigned to.

Watchers receive updates for:

- Status changes.
- Comments.
- Due date changes.
- Assignment changes.

### Activity History

Activity should record:

- Item created.
- Status changed.
- Priority changed.
- Assignee changed.
- Due date changed.
- Comment added.
- Meeting action converted to board item.
- Decision recorded.

### Notifications

V1 notification types:

- Assigned to item.
- Mentioned in comment.
- Due date approaching.
- Status changed on watched item.
- Meeting action assigned.

## Follow-Up Accountability

ActionOS should make follow-up visible.

Useful accountability views:

- Open actions by owner.
- Actions created from meetings.
- Overdue meeting actions.
- Meetings with unresolved previous actions.
- Decisions without linked follow-up.
- Blocked items by team.

