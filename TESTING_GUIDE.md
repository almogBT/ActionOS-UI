# ActionOS Testing Guide

> **Full QA guide is maintained at:**  
> `ActionOS/AI/docs/actionos-ui/testing-guide.md`

This file is a quick-start reference. For detailed test cases covering all features, API endpoints, auth, regression checks, and known limitations, see the full guide linked above.

---

## Quick Start

### 1. Start the UI

```powershell
cd ActionOS/ActionOS-UI/app
npm run start -- --port 4305 --host 127.0.0.1
```

Open: `http://127.0.0.1:4305/`

### 2. Start the API

Configure `appsettings.Development.json` with connection strings and JWT settings, then:

```powershell
cd ActionOS/ActionOS-API/ActionOS.Api
dotnet build
dotnet run
```

Swagger: `https://localhost:7052/swagger`  
Health: `https://localhost:7052/health`

### 3. Apply Database Migrations

Run in order against your SQL Server instance:

```
Sql/001_actionos_schema.sql
Sql/002_actionos_task_improvements.sql
Sql/003_actionos_real_backend_cutover.sql
```

---

## Smoke Test Checklist

Run after every deployment to confirm baseline functionality:

- [ ] App loads at `http://127.0.0.1:4305/` with no console errors
- [ ] All sidebar items navigate correctly: Home, Inbox, My Work, Boards, Meetings, Customers
- [ ] `GET /health` returns `Healthy`
- [ ] Swagger UI loads at `/swagger`
- [ ] Create a task → task appears in My Work → Today (if due today)
- [ ] Open a customer → Customer 360 loads
- [ ] Add a meeting note and convert it to a task
- [ ] Task Drawer opens and closes from all entry points
- [ ] Sidebar collapse (`[` key) persists on refresh

---

## Known Pending Integrations

| Feature | Status |
|---------|--------|
| HTTP Repository Layer (full API persistence) | Pending |
| Logic Apps Email Notifications | Pending (`Enabled: false`) |
| SharePoint Attachments | Pending |
| Host Auth Bootstrap | Pending |
