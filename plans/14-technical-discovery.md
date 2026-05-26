# Technical Discovery

Date: 2026-05-25

This document captures findings from inspecting the current Fritz workspace before building ActionOS.

## Projects Inspected

- `HomePage_Client`
- `HomePage_Server`
- `FritzControlClientNew`
- `ServichClient`

## HomePage Client

Path:

```text
HomePage_Client
```

Findings:

- Angular 18.
- Nx project.
- Uses standalone Angular configuration with `app.config.ts` and `app.routes.ts`.
- Uses Angular Material, Bootstrap, ngx-translate, MSAL, Application Insights, SignalR, service worker, and SVG icons.
- Authentication is based on MSAL and server token validation.
- Main routes are protected by `MsalGuard` and a custom `authGuard`.
- The app already has an `external-module` route that loads external apps in an iframe.
- External modules are loaded from `api/externalModule/getExternalModuleList`.
- The iframe integration passes token, language, selected organization, module slug, and environment name through `postMessage`.

Important existing integration point:

```text
/external-module
```

This can be used as the first bridge to open a standalone ActionOS app from HomePage.

## HomePage Server

Path:

```text
HomePage_Server
```

Findings:

- .NET 8 ASP.NET Core server.
- Uses controllers, core services, DAL repositories, and common DTO projects.
- Uses SQL Server through EF Core.
- Uses multiple database contexts for DWH, Fritz DWH, Servitz, DataFritzer, ReportCentral, and others.
- Uses Azure/MSAL authentication and JWT authorization middleware.
- Uses Microsoft Graph for user/group data.
- Has SignalR hubs.
- Has an `ExternalModuleController` with module list and access validation endpoints.
- External module access supports module slug validation and permission checks.

Important existing API area:

```text
api/ExternalModule/getExternalModuleList
api/ExternalModule/validate-access
```

This is useful for ActionOS host integration.

## FritzControlClientNew

Path:

```text
FritzControlClientNew
```

Findings:

- Angular 16.
- Classic `AppModule` and `app-routing.module.ts` structure.
- Uses Angular Material, Firebase hosting, legacy libraries, and several older package patterns.
- Existing route structure is centered around login and `home` child routes.

Recommendation:

Do not build ActionOS directly inside FritzControlClientNew first.

Reason:

- It is on Angular 16 while HomePage is on Angular 18.
- ActionOS needs to be portable and should not inherit FritzControl-specific assumptions.
- FritzControl should connect to ActionOS through HomePage, deep links, external references, and adapters.

## ServichClient

Path:

```text
ServichClient
```

Findings:

- Angular 8.
- Legacy Angular module structure.
- Uses older package versions and routing patterns.
- Main app is protected by an auth service guard.

Recommendation:

Do not build ActionOS directly inside ServichClient.

Reason:

- Angular 8 is too old for the ActionOS foundation.
- Direct integration would create portability and maintenance problems.
- Servitz should connect through HomePage and explicit external references.

## Architecture Recommendation

Build ActionOS as its own standalone product module first.

Recommended first implementation shape:

```text
ActionOS/
  docs...
  app/
  api/
```

Where:

- `app` is a standalone Angular 18 frontend prototype.
- `api` is a future .NET 8 ActionOS API, or a clean ActionOS API area that can be hosted separately.

For the first prototype, `api` can wait.

## Integration Recommendation

Use a staged integration model.

### Stage 1: Standalone Prototype

Build ActionOS with mock data.

Goal:

- Validate the screens.
- Validate the meeting-to-task workflow.
- Avoid backend and host coupling too early.

### Stage 2: HomePage External Module Integration

Register ActionOS as an external module in HomePage.

Goal:

- Launch ActionOS from HomePage.
- Pass user token, language, selected organization, module slug, and environment through existing iframe bridge.
- Validate access through existing HomePage server module validation.

### Stage 3: ActionOS API

Add real persistence.

Preferred approach:

- Keep ActionOS API logically separate.
- Use .NET 8.
- Reuse HomePage authentication concepts through adapters.
- Avoid direct dependency on FritzControl or Servitz internals.

### Stage 4: Deep Integration

Add explicit links between ActionOS and other modules.

Examples:

- ActionOS item links to FritzControl order.
- ActionOS item links to Servitz service call.
- ActionOS meeting links to customer or shipment context.
- HomePage displays ActionOS as a first-class app.

## Start Building Decision

We can start building after this discovery step.

There is no need for more broad planning before the first prototype.

The first build should be:

- Angular 18.
- Standalone ActionOS frontend.
- Mock data.
- No real backend yet.
- No direct FritzControl or Servitz dependency.
- HomePage integration planned through external module registration after the prototype is useful.

## First Build Target

The first working prototype should prove this workflow:

```text
Open ActionOS
See Workspace Home
Open Board
Create or view task
Open Meeting
Create action note
Convert action note to board item
See created item in My Work
```

If this workflow feels good, the product direction is sound.

