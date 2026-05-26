# API Boundary Plan

Date: 2026-05-25

ActionOS now has a first persistence boundary in the frontend.

## Current Boundary

The current local MVP uses:

```text
ActionosWorkspaceService
ActionosPersistencePort
LocalStorageActionosPersistence
```

Files:

```text
app/src/app/core/services/actionos-workspace.service.ts
app/src/app/core/services/actionos-persistence.port.ts
```

The app stores the local MVP state in browser `localStorage`.

Current key:

```text
actionos.local-state.v2
```

## Why This Matters

The UI now talks to a workspace service instead of directly handling persistence.

That means the local storage implementation can later be replaced with:

- HTTP API service.
- HomePage-hosted API adapter.
- Standalone ActionOS API adapter.
- External company integration adapter.

## Next Backend Preparation Step

Before building the backend, split the service into two layers:

```text
ActionosWorkspaceFacade
ActionosRepository
```

The facade should own screen-friendly behavior.

The repository should own data loading/saving.

## Future Repository Interface

Draft:

```ts
interface ActionosRepository {
  loadWorkspaceState(workspaceId: string): Promise<ActionosWorkspaceState>;
  saveTask(input: TaskItem): Promise<TaskItem>;
  createTask(input: CreateTaskInput): Promise<TaskItem>;
  archiveTask(taskId: string): Promise<void>;
  createMeetingNote(input: CreateMeetingNoteInput): Promise<MeetingNote>;
  convertMeetingAction(input: ConvertMeetingActionInput): Promise<TaskItem>;
  addComment(input: CreateCommentInput): Promise<Comment>;
}
```

## Backend Swap Rule

Do not let Angular components call HTTP services directly.

Components should continue talking to an ActionOS facade/service. That keeps the UI stable when local storage becomes a real API.

