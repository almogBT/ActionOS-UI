# ActionOS

ActionOS is a customer-first work management module for the Fritz ecosystem.

Current workspace structure:

- `ActionOS-UI` - Angular frontend module
- `ActionOS-API` - standalone .NET backend module

## Product Direction

ActionOS focuses on:

- customer-centric meeting management
- board/task execution tracking
- team follow-up accountability
- module portability for unified external-module deployment

## Module Architecture

### 1. Frontend Module

Path:

- `ActionOS/ActionOS-UI/app`

Current UI supports:

- customers and customer 360 workflows
- meeting notes and meeting-task conversion flows
- existing legacy views (home/inbox/my-work/boards/meetings/members)

### 2. Backend Module

Path:

- `ActionOS/ActionOS-API/ActionOS.Api`

Backend provides:

- `/api/actionos/*` routes for clients, boards, tasks, meetings, and org users
- ActionOS-owned DB tables for internal workflow data
- source reads from Azure/reportcentral customer and employee tables
- org-scoped access checks in service layer

## Data Source Rules

- Customers/groups source: `reportcentral.dig.Servitz_Customers_Groups`
- Assignable users source: `reportcentral.emp.EasyDoc_Employees_Dim`
- User filter: active and email containing `@fritz.` or `@critilog.`

## Docs Map

- [plans/17-meeting-module-monday-implementation.md](plans/17-meeting-module-monday-implementation.md)
- [RELEASE_NOTIFICATION.md](RELEASE_NOTIFICATION.md)
- [TESTING_GUIDE.md](TESTING_GUIDE.md)

Related API docs:

- [../ActionOS-API/README.md](../ActionOS-API/README.md)
- [../ActionOS-API/ActionOS.Api/Sql/001_actionos_schema.sql](../ActionOS-API/ActionOS.Api/Sql/001_actionos_schema.sql)

## Run Locally

### UI

```powershell
cd ActionOS/ActionOS-UI/app
npm run start -- --port 4305 --host 127.0.0.1
```

### API

```powershell
cd ActionOS/ActionOS-API/ActionOS.Api
dotnet build
dotnet run
```

## Current Status

- Backend exists as a standalone module service.
- UI is still local-first by default and pending full HTTP repository wiring.
- Host runtime integration and production credentials still require end-to-end validation.
