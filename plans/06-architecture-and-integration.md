# Architecture And Integration

## Strategy

Build ActionOS as a portable product module.

It should be able to run in three modes:

1. Standalone app for our own team.
2. Integrated module inside the unified Fritz/HomePage system.
3. Embeddable module for other company systems later.

The first unified host target is the HomePage client/server system. Through that unified layer, ActionOS should be able to connect with FritzControl, Servitz, and other existing projects.

## Recommended Approach

Start with a separate ActionOS area under the Fritz workspace.

Implementation options later:

1. Separate Angular app during exploration.
2. Angular feature module or library that can be mounted by a host app.
3. Lazy-loaded route mounted under `HomePage_Client`.
4. Standalone deployment for direct ActionOS use.
5. Micro-frontend/module federation only if isolation becomes necessary.

Initial recommendation:

Use a standalone-first app shell with a clean module boundary. Later, mount the same ActionOS feature area inside the unified HomePage system.

## Possible Future Routes

```text
/actionos
```

Inside a workspace or tenant context:

```text
/workspace/:workspaceId/actionos
```

Inside the unified homepage system:

```text
/apps/actionos
```

## Adapter Pattern

To keep ActionOS independent, use integration adapters.

```ts
interface AuthAdapter {
  getCurrentUser(): Promise<ActionOSUser>;
  isAuthenticated(): Promise<boolean>;
}

interface UserAdapter {
  getUsers(workspaceId: string): Promise<ActionOSUser[]>;
  getUserById(userId: string): Promise<ActionOSUser | null>;
}

interface WorkspaceAdapter {
  getWorkspaces(): Promise<Workspace[]>;
  getCurrentWorkspace(): Promise<Workspace | null>;
}

interface NotificationAdapter {
  notifyUser(input: NotificationInput): Promise<void>;
}

interface HostNavigationAdapter {
  openExternalModule(target: HostModuleTarget): Promise<void>;
  getAvailableModules(workspaceId: string): Promise<HostModuleLink[]>;
}

interface ExternalLinkAdapter {
  createLink(input: ExternalLinkInput): Promise<ExternalLink>;
  getLinks(targetType: string, targetId: string): Promise<ExternalLink[]>;
}
```

In standalone mode, adapters can use local ActionOS services.

Inside the unified HomePage system, adapters can call shared authentication, users, navigation, notification, and backend services.

For other companies, adapters can be implemented against their own identity, users, notifications, and domain APIs.

## Frontend Architecture Draft

Possible Angular structure:

```text
actionos/
  core/
    adapters/
    models/
    services/
    guards/
  features/
    workspace/
    boards/
    items/
    meetings/
    dashboards/
    members/
    settings/
  shared/
    components/
    pipes/
    directives/
```

## Backend Architecture Draft

ActionOS likely needs its own backend API surface eventually.

Possible API groups:

```text
/api/actionos/workspaces
/api/actionos/members
/api/actionos/boards
/api/actionos/items
/api/actionos/meetings
/api/actionos/comments
/api/actionos/activity
/api/actionos/notifications
/api/actionos/templates
/api/actionos/automations
```

## Integration Concerns

Important things to check before implementation:

- Existing HomePage authentication model.
- Existing HomePage user and role model.
- Existing HomePage API style.
- Existing HomePage module/navigation model.
- Existing Angular version and upgrade path.
- Existing layout/navigation pattern.
- Existing permission conventions.
- Existing notification mechanisms.
- Existing FritzControl integration points.
- Existing Servitz integration points.
- Database technology and migration strategy.

## Data Ownership

ActionOS should avoid mixing its core records directly into unrelated host-system tables unless there is a clear domain relationship.

Prefer:

- ActionOS owns its own workspace, board, item, meeting, and dashboard tables.
- Host systems provide identity, global navigation, and shared services.
- Cross-links are stored as references, not hidden coupling.

## Host Integration Model

The unified HomePage system should act as the first host.

Host responsibilities:

- Authentication.
- Global app navigation.
- User identity.
- Company or tenant context.
- Shared notifications if available.
- Links to FritzControl, Servitz, and other modules.

ActionOS responsibilities:

- Workspaces.
- Boards.
- Items.
- Meetings.
- Dashboards.
- Comments.
- Activity.
- ActionOS-specific permissions.

Connection between ActionOS and other systems should use explicit links and adapters.

Examples:

- ActionOS task links to a FritzControl record.
- ActionOS board item links to a Servitz customer or job.
- ActionOS meeting links to an external project or ticket.
- HomePage displays ActionOS as one available app/module.

## Integration Milestones

### Phase 1: Standalone Planning

- Product docs.
- Data model.
- UX flows.
- Technical architecture.

### Phase 2: Prototype

- Static/mock UI.
- Workspace shell.
- Board table.
- Kanban.
- Meeting detail page.
- My Work page.

### Phase 3: Standalone Functional App

- Local API or mock backend.
- CRUD for boards and items.
- Meeting action conversion.
- Basic roles.

### Phase 4: Unified HomePage Integration

- Shared auth.
- Shared users.
- Shared layout.
- API integration.
- Real persistence.
- Navigation entry.
- Cross-links to FritzControl and Servitz.

### Phase 5: Production Hardening

- Permissions.
- Audit trail.
- Notifications.
- Performance.
- Tests.
- Error handling.
