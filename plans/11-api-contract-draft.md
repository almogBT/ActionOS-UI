# API Contract Draft

This is an early API contract for frontend/backend alignment.

It is not final. The exact route style should match the Fritz backend conventions once we inspect and integrate with the existing system.

## General Rules

- All ActionOS data is workspace-scoped.
- Most list endpoints should support pagination later.
- Most mutation endpoints should return the updated resource.
- Activity should be recorded for important mutations.
- Soft archive is preferred over hard delete for core work records.

## Common Response Shape

Possible response shape:

```ts
interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface ApiListResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}
```

## Workspaces

```text
GET    /api/actionos/workspaces
POST   /api/actionos/workspaces
GET    /api/actionos/workspaces/:workspaceId
PATCH  /api/actionos/workspaces/:workspaceId
POST   /api/actionos/workspaces/:workspaceId/archive
```

Create workspace request:

```ts
interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}
```

## Members

```text
GET    /api/actionos/workspaces/:workspaceId/members
POST   /api/actionos/workspaces/:workspaceId/invitations
PATCH  /api/actionos/workspaces/:workspaceId/members/:memberId
POST   /api/actionos/workspaces/:workspaceId/members/:memberId/disable
```

Invite request:

```ts
interface InviteMemberRequest {
  email: string;
  roleId: string;
  teamIds?: string[];
}
```

## Teams

```text
GET    /api/actionos/workspaces/:workspaceId/teams
POST   /api/actionos/workspaces/:workspaceId/teams
PATCH  /api/actionos/workspaces/:workspaceId/teams/:teamId
POST   /api/actionos/workspaces/:workspaceId/teams/:teamId/archive
POST   /api/actionos/workspaces/:workspaceId/teams/:teamId/members
DELETE /api/actionos/workspaces/:workspaceId/teams/:teamId/members/:memberId
```

## Boards

```text
GET    /api/actionos/workspaces/:workspaceId/boards
POST   /api/actionos/workspaces/:workspaceId/boards
GET    /api/actionos/workspaces/:workspaceId/boards/:boardId
PATCH  /api/actionos/workspaces/:workspaceId/boards/:boardId
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/archive
```

Create board request:

```ts
interface CreateBoardRequest {
  name: string;
  description?: string;
  type?: 'custom' | 'tasks' | 'projects' | 'meetings' | 'bugs' | 'clients';
  visibility: 'workspace' | 'private' | 'shared';
  templateId?: string;
}
```

## Board Groups

```text
GET    /api/actionos/workspaces/:workspaceId/boards/:boardId/groups
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/groups
PATCH  /api/actionos/workspaces/:workspaceId/boards/:boardId/groups/:groupId
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/groups/reorder
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/groups/:groupId/archive
```

## Board Columns

```text
GET    /api/actionos/workspaces/:workspaceId/boards/:boardId/columns
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/columns
PATCH  /api/actionos/workspaces/:workspaceId/boards/:boardId/columns/:columnId
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/columns/reorder
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/columns/:columnId/archive
```

Create column request:

```ts
interface CreateBoardColumnRequest {
  name: string;
  type: BoardColumnType;
  settings?: unknown;
  required?: boolean;
}
```

## Board Items

```text
GET    /api/actionos/workspaces/:workspaceId/boards/:boardId/items
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/items
GET    /api/actionos/workspaces/:workspaceId/items/:itemId
PATCH  /api/actionos/workspaces/:workspaceId/items/:itemId
POST   /api/actionos/workspaces/:workspaceId/items/:itemId/archive
POST   /api/actionos/workspaces/:workspaceId/items/:itemId/assignees
DELETE /api/actionos/workspaces/:workspaceId/items/:itemId/assignees/:userId
POST   /api/actionos/workspaces/:workspaceId/items/:itemId/watchers
DELETE /api/actionos/workspaces/:workspaceId/items/:itemId/watchers/:userId
```

Create item request:

```ts
interface CreateBoardItemRequest {
  title: string;
  description?: string;
  groupId?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assigneeUserIds?: string[];
  values?: Record<string, unknown>;
  sourceMeetingId?: string;
}
```

Update item request:

```ts
interface UpdateBoardItemRequest {
  title?: string;
  description?: string;
  groupId?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  values?: Record<string, unknown>;
}
```

## Board Views

```text
GET    /api/actionos/workspaces/:workspaceId/boards/:boardId/views
POST   /api/actionos/workspaces/:workspaceId/boards/:boardId/views
PATCH  /api/actionos/workspaces/:workspaceId/boards/:boardId/views/:viewId
DELETE /api/actionos/workspaces/:workspaceId/boards/:boardId/views/:viewId
```

## Meetings

```text
GET    /api/actionos/workspaces/:workspaceId/meetings
POST   /api/actionos/workspaces/:workspaceId/meetings
GET    /api/actionos/workspaces/:workspaceId/meetings/:meetingId
PATCH  /api/actionos/workspaces/:workspaceId/meetings/:meetingId
POST   /api/actionos/workspaces/:workspaceId/meetings/:meetingId/complete
POST   /api/actionos/workspaces/:workspaceId/meetings/:meetingId/cancel
```

Create meeting request:

```ts
interface CreateMeetingRequest {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  attendeeUserIds?: string[];
  externalAttendees?: {
    displayName: string;
    email?: string;
  }[];
  linkedBoardIds?: string[];
}
```

## Meeting Agenda And Notes

```text
GET    /api/actionos/workspaces/:workspaceId/meetings/:meetingId/agenda
POST   /api/actionos/workspaces/:workspaceId/meetings/:meetingId/agenda
PATCH  /api/actionos/workspaces/:workspaceId/meetings/:meetingId/agenda/:agendaItemId
POST   /api/actionos/workspaces/:workspaceId/meetings/:meetingId/agenda/reorder

GET    /api/actionos/workspaces/:workspaceId/meetings/:meetingId/notes
POST   /api/actionos/workspaces/:workspaceId/meetings/:meetingId/notes
PATCH  /api/actionos/workspaces/:workspaceId/meetings/:meetingId/notes/:noteId
```

Create meeting note request:

```ts
interface CreateMeetingNoteRequest {
  content: string;
  noteType: 'note' | 'decision' | 'action' | 'blocker';
}
```

## Convert Meeting Action

```text
POST /api/actionos/workspaces/:workspaceId/meetings/:meetingId/notes/:noteId/convert-to-item
```

Request:

```ts
interface ConvertMeetingNoteToItemRequest {
  boardId: string;
  groupId?: string;
  title?: string;
  assigneeUserIds?: string[];
  status?: string;
  priority?: string;
  dueDate?: string;
  values?: Record<string, unknown>;
}
```

Response:

```ts
interface ConvertMeetingNoteToItemResponse {
  item: BoardItem;
  note: MeetingNote;
}
```

## Comments

```text
GET    /api/actionos/workspaces/:workspaceId/comments?targetType=boardItem&targetId=:id
POST   /api/actionos/workspaces/:workspaceId/comments
PATCH  /api/actionos/workspaces/:workspaceId/comments/:commentId
DELETE /api/actionos/workspaces/:workspaceId/comments/:commentId
```

Create comment request:

```ts
interface CreateCommentRequest {
  targetType: 'boardItem' | 'meeting' | 'decision';
  targetId: string;
  body: string;
  mentionedUserIds?: string[];
}
```

## Activity

```text
GET /api/actionos/workspaces/:workspaceId/activity
GET /api/actionos/workspaces/:workspaceId/activity?targetType=boardItem&targetId=:id
```

## Notifications

```text
GET  /api/actionos/workspaces/:workspaceId/notifications
POST /api/actionos/workspaces/:workspaceId/notifications/:notificationId/read
POST /api/actionos/workspaces/:workspaceId/notifications/read-all
```

## My Work

```text
GET /api/actionos/workspaces/:workspaceId/my-work
```

Possible query parameters:

```text
status=open
from=2026-05-01
to=2026-05-31
includeWatched=true
includeMeetingActions=true
```

## Dashboard Data

```text
GET /api/actionos/workspaces/:workspaceId/dashboard/home
GET /api/actionos/workspaces/:workspaceId/dashboard/follow-up-debt
GET /api/actionos/workspaces/:workspaceId/dashboard/workload
```

