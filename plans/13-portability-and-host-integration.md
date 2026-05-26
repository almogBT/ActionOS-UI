# Portability And Host Integration

ActionOS should be designed as a product module that can run by itself and also be integrated into larger systems.

This is a core requirement, not a later nice-to-have.

## Product Shape

ActionOS should have:

- A standalone app shell.
- A reusable feature module.
- A stable API contract.
- Integration adapters.
- Clear ownership of its own data.
- Explicit links to external systems.

This allows ActionOS to serve our own team and later become something that can be mounted into other company systems.

## Supported Modes

### 1. Standalone Mode

Used by us and our teammates directly.

In this mode, ActionOS provides:

- Its own app shell.
- Its own workspace selection.
- Its own ActionOS backend.
- Its own board, meeting, and dashboard experience.
- Its own member and role management if no host is present.

### 2. Unified HomePage Mode

Used inside the unified system based on `HomePage_Client` and `HomePage_Server`.

In this mode, HomePage provides:

- Login and identity.
- Global navigation.
- Company or tenant context.
- App/module launcher.
- Shared user list if available.
- Links to FritzControl, Servitz, and other systems.

ActionOS still owns:

- Boards.
- Items.
- Meetings.
- Dashboards.
- Comments.
- Activity.
- ActionOS-specific permissions and workspace behavior.

### 3. External Company Mode

Used later when ActionOS is integrated into another company's system.

In this mode, the host company can provide:

- Authentication.
- Users.
- Organization structure.
- Notifications.
- Domain-specific records.

ActionOS provides the work management engine and exposes integration points.

## Non-Negotiable Boundary

ActionOS must not depend directly on FritzControl, Servitz, or HomePage internals.

It can integrate with them through:

- API clients.
- Adapter interfaces.
- Deep links.
- External reference records.
- Event hooks later.

This keeps ActionOS reusable.

## Package Layers

Recommended conceptual layers:

```text
ActionOS Domain
ActionOS API Client
ActionOS UI Components
ActionOS Feature Routes
Standalone ActionOS Shell
Host Integration Adapters
```

### ActionOS Domain

Models and business concepts:

- Workspace
- Board
- Item
- Meeting
- Decision
- Comment
- Activity
- Notification

### ActionOS API Client

HTTP client methods for ActionOS backend endpoints.

### ActionOS UI Components

Reusable UI pieces:

- Board table.
- Kanban board.
- Item detail panel.
- Meeting notes.
- Dashboard widgets.

### ActionOS Feature Routes

The main pages:

- Home.
- My Work.
- Boards.
- Meetings.
- Dashboards.
- Members.
- Settings.

### Standalone ActionOS Shell

Provides direct access when ActionOS runs by itself.

### Host Integration Adapters

Adapters that let another system provide identity, navigation, users, notifications, and external links.

## Adapter Interfaces

ActionOS should plan for these adapter categories:

```ts
interface AuthAdapter {
  getCurrentUser(): Promise<ActionOSUser>;
  isAuthenticated(): Promise<boolean>;
}

interface HostContextAdapter {
  getTenantId(): Promise<string | null>;
  getCompanyId(): Promise<string | null>;
  getWorkspaceId(): Promise<string | null>;
}

interface HostNavigationAdapter {
  openModule(target: HostModuleTarget): Promise<void>;
  getModuleLinks(): Promise<HostModuleLink[]>;
}

interface UserDirectoryAdapter {
  searchUsers(query: string): Promise<ActionOSUser[]>;
  getUserById(userId: string): Promise<ActionOSUser | null>;
}

interface ExternalReferenceAdapter {
  searchExternalRecords(input: ExternalRecordSearch): Promise<ExternalRecord[]>;
  openExternalRecord(reference: ExternalReference): Promise<void>;
}

interface NotificationAdapter {
  notifyUser(input: NotificationInput): Promise<void>;
}
```

## External References

ActionOS should be able to link work items to external systems.

Examples:

- FritzControl customer.
- FritzControl order.
- Servitz service call.
- Servitz customer.
- External CRM account.
- External ticket.
- External project.

Draft model:

```ts
interface ExternalReference {
  id: string;
  workspaceId: string;
  targetType: 'boardItem' | 'meeting' | 'decision';
  targetId: string;
  provider: 'fritzControl' | 'servitz' | 'external';
  externalType: string;
  externalId: string;
  displayName: string;
  url?: string;
  metadataJson?: string;
}
```

## Unified HomePage Integration

The first real host integration should be the unified HomePage system.

Planned role:

- HomePage is the main entry point.
- ActionOS appears as an app/module in HomePage.
- HomePage passes identity and context into ActionOS.
- ActionOS can link work to FritzControl and Servitz records.
- ActionOS can be opened directly in standalone mode for our internal team.

## Why This Matters

This lets us build one ActionOS product instead of three separate versions:

- One for our team.
- One for the unified Fritz system.
- One for future company integrations.

The implementation can evolve, but the boundary should exist from day one.
