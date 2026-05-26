# Data Model

This is an initial planning model. It is not final database design.

## Guiding Rules

- Everything belongs to a workspace.
- Multi-user ownership must exist from day one.
- Important records should include audit fields.
- Meeting action items should become normal work items, not a separate isolated concept.
- Flexible board fields should be modeled separately from item values.

## Shared Fields

Most persistent records should include:

```ts
id: string;
workspaceId: string;
createdByUserId: string;
updatedByUserId?: string;
createdAt: string;
updatedAt?: string;
archivedAt?: string;
```

## Entities

### Workspace

Represents a shared tenant/team area.

```ts
interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
}
```

### WorkspaceMember

Connects a user to a workspace.

```ts
interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  status: 'active' | 'invited' | 'disabled';
  joinedAt?: string;
}
```

### Team

Groups members inside a workspace.

```ts
interface Team {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
}
```

### Board

Represents a flexible work surface.

```ts
interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: 'custom' | 'tasks' | 'projects' | 'meetings' | 'bugs' | 'clients';
  visibility: 'workspace' | 'private' | 'shared';
  createdByUserId: string;
  createdAt: string;
  archivedAt?: string;
}
```

### BoardGroup

Represents a section inside a board.

```ts
interface BoardGroup {
  id: string;
  workspaceId: string;
  boardId: string;
  name: string;
  color?: string;
  position: number;
}
```

### BoardColumn

Defines a custom field for a board.

```ts
type BoardColumnType =
  | 'text'
  | 'longText'
  | 'status'
  | 'priority'
  | 'person'
  | 'date'
  | 'tags'
  | 'checkbox'
  | 'number'
  | 'link';

interface BoardColumn {
  id: string;
  workspaceId: string;
  boardId: string;
  name: string;
  type: BoardColumnType;
  settingsJson?: string;
  required: boolean;
  position: number;
}
```

### BoardItem

Represents a row/card/work item.

```ts
interface BoardItem {
  id: string;
  workspaceId: string;
  boardId: string;
  groupId?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  sourceMeetingId?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
}
```

### BoardItemValue

Stores values for custom columns.

```ts
interface BoardItemValue {
  id: string;
  workspaceId: string;
  boardId: string;
  itemId: string;
  columnId: string;
  valueJson: string;
}
```

### BoardItemAssignee

Allows multiple assignees.

```ts
interface BoardItemAssignee {
  id: string;
  workspaceId: string;
  itemId: string;
  userId: string;
}
```

### BoardView

Stores a saved board view.

```ts
interface BoardView {
  id: string;
  workspaceId: string;
  boardId: string;
  name: string;
  type: 'table' | 'kanban' | 'calendar' | 'timeline' | 'dashboard';
  configJson: string;
  createdByUserId: string;
}
```

### Meeting

Represents a meeting inside a workspace.

```ts
interface Meeting {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  status: 'planned' | 'inProgress' | 'completed' | 'cancelled';
  createdByUserId: string;
  createdAt: string;
}
```

### MeetingAttendee

```ts
interface MeetingAttendee {
  id: string;
  workspaceId: string;
  meetingId: string;
  userId?: string;
  displayName?: string;
  email?: string;
  attendanceStatus?: 'invited' | 'accepted' | 'declined' | 'attended' | 'missed';
}
```

### AgendaItem

```ts
interface AgendaItem {
  id: string;
  workspaceId: string;
  meetingId: string;
  title: string;
  ownerUserId?: string;
  position: number;
  completed: boolean;
}
```

### MeetingNote

```ts
interface MeetingNote {
  id: string;
  workspaceId: string;
  meetingId: string;
  content: string;
  noteType: 'note' | 'decision' | 'action' | 'blocker';
  linkedItemId?: string;
  createdByUserId: string;
  createdAt: string;
}
```

### Decision

Decisions should be searchable and linked back to meetings.

```ts
interface Decision {
  id: string;
  workspaceId: string;
  meetingId?: string;
  title: string;
  description?: string;
  decidedByUserId?: string;
  decidedAt: string;
  relatedItemId?: string;
}
```

### Comment

```ts
interface Comment {
  id: string;
  workspaceId: string;
  targetType: 'boardItem' | 'meeting' | 'decision';
  targetId: string;
  body: string;
  createdByUserId: string;
  createdAt: string;
}
```

### ActivityLog

```ts
interface ActivityLog {
  id: string;
  workspaceId: string;
  actorUserId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadataJson?: string;
  createdAt: string;
}
```

### Notification

```ts
interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  targetType?: string;
  targetId?: string;
  readAt?: string;
  createdAt: string;
}
```

### AutomationRule

Planned for later, but worth modeling early.

```ts
interface AutomationRule {
  id: string;
  workspaceId: string;
  boardId?: string;
  name: string;
  triggerJson: string;
  conditionJson?: string;
  actionJson: string;
  enabled: boolean;
  createdByUserId: string;
}
```

## Important Modeling Decision

Action items should usually be `BoardItem` records with a `sourceMeetingId`.

This avoids creating two parallel task systems.

