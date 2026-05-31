import { Attachment, BoardTemplate, Customer, CustomerMeeting, Employee, Meeting, Member, NavItem, Task, TaskStatus } from '../models/actionos.models';

export const ACTIONOS_NAV_ITEMS: NavItem[] = [
  { id: 'home',     label: 'Home',     shortcut: 'H', section: 'main' },
  { id: 'meetings', label: 'Meetings', shortcut: 'N', section: 'main' },
  { id: 'my-work',  label: 'My Work',  shortcut: 'M', section: 'work' },
  { id: 'boards',   label: 'Boards',   shortcut: 'B', section: 'work' },
  // 'customers' is intentionally omitted: the customer list now lives on Home.
  // The 'customers' view still exists to host the Customer 360 detail flow,
  // reached by clicking a customer row on Home (see AppComponent).
  // 'members' is intentionally omitted: team member info is available on Home.
];

export const ACTIONOS_TASK_STATUSES: TaskStatus[] = ['Inbox', 'Planned', 'In Progress', 'Waiting', 'Done'];

export const ACTIONOS_MEMBERS: Member[] = [
  { id: 'u1', name: 'BT Almoga', role: 'Owner', team: 'Operations', availability: 'Focused' },
  { id: 'u2', name: 'Dana Levy', role: 'Manager', team: 'Customer Success', availability: 'Available' },
  { id: 'u3', name: 'Rami Cohen', role: 'Member', team: 'Logistics', availability: 'In meeting' },
  { id: 'u4', name: 'Noa Shafir', role: 'Admin', team: 'Finance', availability: 'Available' }
];

export const ACTIONOS_TASKS: Partial<Task>[] = [
  {
    id: 'task-1',
    title: 'Map HomePage external module handshake',
    description: 'Document token, language, org, module slug, and environment payloads for host integration.',
    source: 'board',
    board: 'Platform Integration',
    status: 'In Progress',
    priority: 'High',
    dueDate: '2026-05-27',
    assigneeIds: ['u1', 'u4'],
    watcherIds: ['u2'],
    createdByUserId: 'u2',
    createdAt: '2026-05-25T08:15:00.000Z',
    updatedAt: '2026-05-25T09:30:00.000Z',
    checklist: [
      { label: 'Token message contract', done: true },
      { label: 'Selected org payload', done: true },
      { label: 'Module validation edge cases', done: false }
    ]
  },
  {
    id: 'task-2',
    title: 'Design meeting action conversion flow',
    description: 'Make the conversion from meeting action to assigned task feel obvious and recoverable.',
    source: 'board',
    board: 'Fritz Meetings',
    status: 'Planned',
    priority: 'Critical',
    dueDate: '2026-05-26',
    assigneeIds: ['u1'],
    watcherIds: ['u2', 'u4'],
    sourceMeetingId: 'meet-1',
    createdByUserId: 'u1',
    createdAt: '2026-05-25T08:45:00.000Z',
    updatedAt: '2026-05-25T08:45:00.000Z',
    checklist: [
      { label: 'Capture action note', done: true },
      { label: 'Choose board and owner', done: false },
      { label: 'Show item in My Work', done: false }
    ]
  },
  {
    id: 'task-3',
    title: 'Define default board columns for MVP',
    description: 'Lock the first set of columns before moving toward API contracts.',
    source: 'board',
    board: 'Fritz Meetings',
    status: 'Waiting',
    priority: 'Medium',
    dueDate: '2026-05-29',
    assigneeIds: ['u2'],
    watcherIds: ['u1'],
    blockedBy: 'Needs final field list',
    createdByUserId: 'u1',
    createdAt: '2026-05-25T09:05:00.000Z',
    updatedAt: '2026-05-25T09:05:00.000Z',
    checklist: [
      { label: 'Status values', done: true },
      { label: 'Priority values', done: true },
      { label: 'Custom column settings', done: false }
    ]
  },
  {
    id: 'task-4',
    title: 'Create first customer onboarding board template',
    description: 'Draft a reusable workflow that proves ActionOS can support non-task-list workflows.',
    source: 'board',
    board: 'Templates',
    status: 'Inbox',
    priority: 'Medium',
    dueDate: '2026-06-02',
    assigneeIds: ['u3'],
    watcherIds: ['u1'],
    createdByUserId: 'u3',
    createdAt: '2026-05-25T09:20:00.000Z',
    updatedAt: '2026-05-25T09:20:00.000Z',
    checklist: [
      { label: 'Stages', done: false },
      { label: 'Required fields', done: false },
      { label: 'Example items', done: false }
    ]
  },
  {
    id: 'task-5',
    title: 'Review local MVP with team',
    description: 'Use the local prototype and record what needs to change before backend work.',
    source: 'board',
    board: 'Fritz Meetings',
    status: 'Inbox',
    priority: 'High',
    dueDate: '2026-05-25',
    assigneeIds: ['u1'],
    watcherIds: ['u2'],
    createdByUserId: 'u1',
    createdAt: '2026-05-25T10:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    checklist: [
      { label: 'Test task creation', done: false },
      { label: 'Test meeting conversion', done: false },
      { label: 'Write feedback', done: false }
    ]
  }
];

// Build the legacy meeting anchored to "today" so the calendar always shows
// something live. The "time" string is preserved for back-compat display.
const legacyMeetingStart = (() => {
  const d = new Date();
  d.setHours(14, 30, 0, 0);
  return d.toISOString();
})();

export const ACTIONOS_MEETING: Meeting = {
  id: 'meet-1',
  title: 'Fritz Meetings planning sync',
  time: 'Today, 14:30',
  startsAt: legacyMeetingStart,
  durationMinutes: 60,
  attendeeIds: ['u1', 'u2', 'u4'],
  linkedBoard: 'Fritz Meetings',
  agenda: [
    { id: 'agenda-1', title: 'Lock standalone-first architecture', completed: true },
    { id: 'agenda-2', title: 'Review meeting-to-task flow', completed: false },
    { id: 'agenda-3', title: 'Pick first prototype screens', completed: false }
  ],
  notes: [
    {
      id: 'note-1',
      type: 'decision',
      content: 'ActionOS starts as a standalone Angular 18 app and later plugs into HomePage as a host module.'
    },
    {
      id: 'note-2',
      type: 'action',
      content: 'Create a visible prototype for the meeting action conversion workflow.',
      ownerId: 'u1',
      dueDate: '2026-05-26'
    },
    {
      id: 'note-3',
      type: 'blocker',
      content: 'Real API work waits until the mock workflow feels right.'
    },
    {
      id: 'note-4',
      type: 'note',
      content: 'HomePage already has an iframe bridge that passes token, language, org, module slug, and environment.'
    }
  ]
};

export const ACTIONOS_BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'template-project',
    name: 'Project launch',
    description: 'Kickoff, delivery, risk, and launch follow-up.',
    board: 'Project Launch',
    tasks: [
      { title: 'Confirm launch owner', description: 'Name the person accountable for launch coordination.', board: 'Project Launch', priority: 'High', dueDate: '2026-06-03' },
      { title: 'Prepare project risk list', description: 'Capture top risks and mitigation owners.', board: 'Project Launch', priority: 'Medium', dueDate: '2026-06-04' },
      { title: 'Run launch review meeting', description: 'Review go/no-go status with stakeholders.', board: 'Project Launch', priority: 'High', dueDate: '2026-06-06' }
    ]
  },
  {
    id: 'template-meeting',
    name: 'Meeting follow-up',
    description: 'Standard board for recurring meeting actions.',
    board: 'Meeting Follow-up',
    tasks: [
      { title: 'Collect unresolved actions', description: 'Bring open actions from the previous meeting.', board: 'Meeting Follow-up', priority: 'High', dueDate: '2026-05-30' },
      { title: 'Publish decisions summary', description: 'Share decisions and owners after the meeting.', board: 'Meeting Follow-up', priority: 'Medium', dueDate: '2026-05-31' }
    ]
  },
  {
    id: 'template-customer',
    name: 'Customer onboarding',
    description: 'A lightweight onboarding checklist for new customers.',
    board: 'Customer Onboarding',
    tasks: [
      { title: 'Create customer workspace', description: 'Set up initial workspace and access.', board: 'Customer Onboarding', priority: 'High', dueDate: '2026-06-03' },
      { title: 'Schedule onboarding meeting', description: 'Book first customer onboarding sync.', board: 'Customer Onboarding', priority: 'Medium', dueDate: '2026-06-05' },
      { title: 'Confirm success criteria', description: 'Capture goals and handoff expectations.', board: 'Customer Onboarding', priority: 'High', dueDate: '2026-06-07' }
    ]
  },
  {
    id: 'template-bug',
    name: 'Bug tracker',
    description: 'Triage, reproduce, fix, and verify defects.',
    board: 'Bug Tracker',
    tasks: [
      { title: 'Triage incoming bug', description: 'Confirm priority and owner.', board: 'Bug Tracker', priority: 'High', dueDate: '2026-05-31' },
      { title: 'Reproduce issue', description: 'Record steps and expected behavior.', board: 'Bug Tracker', priority: 'Medium', dueDate: '2026-06-01' },
      { title: 'Verify fix', description: 'Retest after implementation.', board: 'Bug Tracker', priority: 'Medium', dueDate: '2026-06-04' }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────
// v3: Customer Meeting Management seed data
//
// Employees mirror the shape of reportcental.emp.EasyDoc_Employees_Dim.
// Coverage requirement (per testing plan §9): assignable picker must show only
// active fritz/critilog employees, so the seed includes:
//   - active fritz.co.il (assignable)
//   - active critilog.co.il (assignable)
//   - inactive fritz.co.il (must be hidden)
//   - active non-fritz domain (must be hidden)
// ─────────────────────────────────────────────────────────────────────────

export const ACTIONOS_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    externalEmployeeId: 'F-1001',
    fullName: 'BT Almoga',
    email: 'bt.almoga@fritz.co.il',
    team: 'Operations',
    role: 'Account Owner',
    isActive: true,
    sourceSystem: 'Fritz'
  },
  {
    id: 'emp-2',
    externalEmployeeId: 'F-1002',
    fullName: 'Dana Levy',
    email: 'dana.levy@fritz.co.il',
    team: 'Customer Success',
    role: 'CS Manager',
    isActive: true,
    sourceSystem: 'Fritz'
  },
  {
    id: 'emp-3',
    externalEmployeeId: 'F-1003',
    fullName: 'Rami Cohen',
    email: 'rami.cohen@critilog.co.il',
    team: 'Logistics',
    role: 'Logistics Lead',
    isActive: true,
    sourceSystem: 'Fritz'
  },
  {
    id: 'emp-4',
    externalEmployeeId: 'F-1004',
    fullName: 'Noa Shafir',
    email: 'noa.shafir@fritz.co.il',
    team: 'Finance',
    role: 'Finance Admin',
    isActive: true,
    sourceSystem: 'Fritz'
  },
  {
    id: 'emp-5',
    externalEmployeeId: 'F-1005',
    fullName: 'Yossi Mizrahi',
    email: 'yossi.mizrahi@critilog.co.il',
    team: 'Operations',
    role: 'Ops Coordinator',
    isActive: true,
    sourceSystem: 'Fritz'
  },
  // Inactive — must NEVER appear in assignable list
  {
    id: 'emp-6',
    externalEmployeeId: 'F-0901',
    fullName: 'Tamar Ben-Ami',
    email: 'tamar.benami@fritz.co.il',
    team: 'Sales',
    role: 'Former Sales Rep',
    isActive: false,
    sourceSystem: 'Fritz'
  },
  // Non-fritz domain — must NEVER appear in assignable list
  {
    id: 'emp-7',
    externalEmployeeId: 'EXT-0021',
    fullName: 'External Consultant',
    email: 'consultant@partner.com',
    team: 'External',
    role: 'Consultant',
    isActive: true,
    sourceSystem: 'Mock'
  }
];

// Customers — externalGroupId mirrors a real Servitz_Customers_Groups.id (mocked).
// Names are realistic Israeli logistics/FMCG customer-group names.
export const ACTIONOS_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    externalGroupId: 'SCG-1001',
    name: 'Strauss Group',
    type: 'Existing',
    status: 'Active',
    primaryContactName: 'Eitan Shoval',
    primaryContactEmail: 'eitan.shoval@strauss-group.com',
    primaryContactPhone: '+972-3-675-5000',
    accountOwnerEmployeeId: 'emp-2',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-05-20T10:15:00.000Z'
  },
  {
    id: 'cust-2',
    externalGroupId: 'SCG-1042',
    name: 'Tnuva',
    type: 'Existing',
    status: 'At Risk',
    primaryContactName: 'Michal Ronen',
    primaryContactEmail: 'michal.ronen@tnuva.co.il',
    primaryContactPhone: '+972-3-918-7000',
    accountOwnerEmployeeId: 'emp-1',
    createdAt: '2026-02-04T09:00:00.000Z',
    updatedAt: '2026-05-22T11:00:00.000Z'
  },
  {
    id: 'cust-3',
    externalGroupId: 'SCG-1077',
    name: 'Osem-Nestle',
    type: 'Existing',
    status: 'Active',
    primaryContactName: 'Yair Levi',
    primaryContactEmail: 'yair.levi@osem.co.il',
    primaryContactPhone: '+972-3-948-0500',
    accountOwnerEmployeeId: 'emp-2',
    createdAt: '2026-02-18T09:00:00.000Z',
    updatedAt: '2026-05-15T14:00:00.000Z'
  },
  {
    id: 'cust-4',
    externalGroupId: 'SCG-1093',
    name: 'Sano Bruno’s Enterprises',
    type: 'Existing',
    status: 'Active',
    primaryContactName: 'Liat Bar',
    primaryContactEmail: 'liat.bar@sano.co.il',
    primaryContactPhone: '+972-3-928-0000',
    accountOwnerEmployeeId: 'emp-5',
    createdAt: '2026-03-02T09:00:00.000Z',
    updatedAt: '2026-05-10T09:00:00.000Z'
  },
  // Prospects — externalGroupId stays null until promoted
  {
    id: 'cust-5',
    externalGroupId: null,
    name: 'Telma Foods (prospect)',
    type: 'Prospect',
    status: 'Prospect',
    primaryContactName: 'Ronit Klein',
    primaryContactEmail: 'ronit.klein@telma-prospect.com',
    primaryContactPhone: '+972-3-555-0123',
    accountOwnerEmployeeId: 'emp-1',
    createdAt: '2026-05-05T09:00:00.000Z',
    updatedAt: '2026-05-05T09:00:00.000Z'
  },
  {
    id: 'cust-6',
    externalGroupId: null,
    name: 'Soglowek (prospect)',
    type: 'Prospect',
    status: 'Prospect',
    primaryContactName: 'Avi Tal',
    primaryContactEmail: 'avi.tal@soglowek-prospect.com',
    accountOwnerEmployeeId: 'emp-2',
    createdAt: '2026-05-12T09:00:00.000Z',
    updatedAt: '2026-05-12T09:00:00.000Z'
  }
];

export const ACTIONOS_CUSTOMER_MEETINGS: CustomerMeeting[] = [
  {
    id: 'cmeet-1',
    customerId: 'cust-1',
    subject: 'Q2 service review and pricing alignment',
    meetingDate: '2026-05-15T10:00:00.000Z',
    meetingLeaderEmployeeId: 'emp-2',
    internalParticipantEmployeeIds: ['emp-1', 'emp-3'],
    customerParticipants: [
      { name: 'Eitan Shoval', email: 'eitan.shoval@strauss-group.com', role: 'Logistics Director' },
      { name: 'Sigal Peer', email: 'sigal.peer@strauss-group.com', role: 'Procurement' }
    ],
    goal: 'Align on Q3 freight allocations and review SLA performance.',
    summary: 'Strauss is happy with on-time delivery (97% in Q2). They flagged customs documentation delays on EU lanes and asked for a dedicated weekly status. Pricing discussion deferred to next round.',
    notes: [
      { id: 'cnote-1', type: 'decision', content: 'Weekly EU customs status report starts next week.' },
      { id: 'cnote-2', type: 'action', content: 'Prepare Q3 freight allocation proposal.', ownerId: 'emp-2', dueDate: '2026-05-28', convertedTaskId: 'mtask-1' },
      { id: 'cnote-3', type: 'blocker', content: 'Customs broker change still pending on customer side.' },
      { id: 'cnote-4', type: 'action', content: 'Draft new weekly EU customs status template.', ownerId: 'emp-3', dueDate: '2026-05-22', convertedTaskId: 'mtask-2' }
    ],
    nextMeetingDate: '2026-06-12T10:00:00.000Z',
    status: 'Tasks Created',
    attachmentIds: [],
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-15T12:30:00.000Z'
  },
  {
    id: 'cmeet-2',
    customerId: 'cust-2',
    subject: 'Tnuva chilled-chain quarterly review',
    meetingDate: '2026-05-19T13:00:00.000Z',
    meetingLeaderEmployeeId: 'emp-1',
    internalParticipantEmployeeIds: ['emp-3', 'emp-5'],
    customerParticipants: [
      { name: 'Michal Ronen', email: 'michal.ronen@tnuva.co.il', role: 'Supply Chain Manager' }
    ],
    goal: 'Address recent temperature deviations and re-baseline the SLA.',
    summary: 'Two temperature deviation incidents in April. Tnuva requests a remediation plan with measurable SLA targets. Account is at risk if not closed in 30 days.',
    notes: [
      { id: 'cnote-5', type: 'blocker', content: 'Two temperature deviations in April; root cause partially identified.' },
      { id: 'cnote-6', type: 'action', content: 'Build remediation plan with measurable SLA targets.', ownerId: 'emp-1', dueDate: '2026-05-24', convertedTaskId: 'mtask-3' },
      { id: 'cnote-7', type: 'decision', content: 'Escalation path: incident -> ops lead within 15 minutes.' },
      { id: 'cnote-10', type: 'action', content: 'Send Tnuva a draft SLA addendum for legal review.', createdByEmployeeId: 'emp-1', dueDate: '2026-06-04' },
      { id: 'cnote-11', type: 'action', content: 'Schedule follow-up call with Tnuva ops lead to walk through the remediation plan.', createdByEmployeeId: 'emp-1', dueDate: '2026-06-02' }
    ],
    nextMeetingDate: '2026-06-09T13:00:00.000Z',
    status: 'Tasks Created',
    attachmentIds: [],
    createdAt: '2026-05-19T13:00:00.000Z',
    updatedAt: '2026-05-19T15:00:00.000Z'
  },
  {
    id: 'cmeet-3',
    customerId: 'cust-1',
    subject: 'Initial scoping for new SKUs',
    meetingDate: '2026-04-20T09:00:00.000Z',
    meetingLeaderEmployeeId: 'emp-2',
    internalParticipantEmployeeIds: ['emp-1'],
    customerParticipants: [
      { name: 'Eitan Shoval', role: 'Logistics Director' }
    ],
    goal: 'Understand volume changes from new SKU launches.',
    summary: 'Strauss is launching 12 new SKUs in Q3. Volume estimate: +8% over Q2. No immediate change to allocations needed; revisit after launch.',
    notes: [
      { id: 'cnote-8', type: 'note', content: '12 new SKUs in Q3.' },
      { id: 'cnote-9', type: 'decision', content: 'Revisit allocations post-launch (mid-Q3).' },
      { id: 'cnote-12', type: 'action', content: 'Model volume impact on warehouse capacity for +8% Q3 SKU increase.', createdByEmployeeId: 'emp-1', dueDate: '2026-06-06' }
    ],
    nextMeetingDate: '2026-05-15T10:00:00.000Z',
    status: 'Closed',
    attachmentIds: [],
    createdAt: '2026-04-20T09:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z'
  }
];

// Meeting tasks across statuses, including overdue and waiting-for-customer
// (today is 2026-05-26 per the workspace clock; dueDate < today + open = overdue)
export const ACTIONOS_MEETING_TASKS: Partial<Task>[] = [
  {
    id: 'mtask-1',
    title: 'Q3 freight allocation proposal',
    description: 'Build proposal covering Asia-EU and Asia-IL lanes.',
    source: 'meeting',
    customerId: 'cust-1',
    sourceMeetingId: 'cmeet-1',
    openedByEmployeeId: 'emp-2',
    assignedToEmployeeId: 'emp-2',
    dueDate: '2026-05-28',
    priority: 'High',
    status: 'In Progress',
    attachmentIds: [],
    watcherEmployeeIds: ['emp-2', 'emp-1'],
    checklist: [
      { label: 'Validate lane assumptions with finance', done: true },
      { label: 'Share draft with customer team', done: false }
    ],
    treatmentNotes: 'Draft outline ready, waiting on rate sheet from finance.',
    notifications: [
      { event: 'assigned', channel: 'email', sentAt: '2026-05-15T12:30:00.000Z', recipientEmployeeId: 'emp-2' }
    ],
    createdAt: '2026-05-15T12:30:00.000Z',
    updatedAt: '2026-05-22T09:00:00.000Z'
  },
  {
    id: 'mtask-2',
    title: 'Draft weekly EU customs status template',
    description: 'Single-page status template for customs broker updates.',
    source: 'meeting',
    customerId: 'cust-1',
    sourceMeetingId: 'cmeet-1',
    openedByEmployeeId: 'emp-2',
    assignedToEmployeeId: 'emp-3',
    dueDate: '2026-05-22',
    priority: 'Medium',
    status: 'Done',
    attachmentIds: [],
    watcherEmployeeIds: ['emp-2', 'emp-3'],
    checklist: [
      { label: 'Draft template', done: true },
      { label: 'Obtain procurement approval', done: true }
    ],
    completedAt: '2026-05-21T17:00:00.000Z',
    treatmentNotes: 'Template approved by Strauss procurement on 2026-05-21.',
    notifications: [
      { event: 'assigned', channel: 'email', sentAt: '2026-05-15T12:30:00.000Z', recipientEmployeeId: 'emp-3' },
      { event: 'status-changed', channel: 'email', sentAt: '2026-05-21T17:00:00.000Z', recipientEmployeeId: 'emp-2' }
    ],
    createdAt: '2026-05-15T12:30:00.000Z',
    updatedAt: '2026-05-21T17:00:00.000Z'
  },
  {
    id: 'mtask-3',
    title: 'Tnuva remediation plan with SLA targets',
    description: 'Document and circulate corrective actions with measurable SLAs.',
    source: 'meeting',
    customerId: 'cust-2',
    sourceMeetingId: 'cmeet-2',
    openedByEmployeeId: 'emp-1',
    assignedToEmployeeId: 'emp-1',
    dueDate: '2026-05-24',
    priority: 'Critical',
    status: 'In Progress',
    attachmentIds: [],
    watcherEmployeeIds: ['emp-1', 'emp-5'],
    checklist: [
      { label: 'Draft remediation plan', done: true },
      { label: 'Get operations sign-off', done: false }
    ],
    treatmentNotes: 'First draft circulated internally; awaiting ops lead review.',
    notifications: [
      { event: 'assigned', channel: 'email', sentAt: '2026-05-19T15:00:00.000Z', recipientEmployeeId: 'emp-1' }
    ],
    createdAt: '2026-05-19T15:00:00.000Z',
    updatedAt: '2026-05-23T16:00:00.000Z'
  },
  {
    id: 'mtask-4',
    title: 'Confirm customs broker change-over date',
    description: 'Get a firm date from customer for new customs broker switchover.',
    source: 'meeting',
    customerId: 'cust-1',
    sourceMeetingId: 'cmeet-1',
    openedByEmployeeId: 'emp-2',
    assignedToEmployeeId: 'emp-3',
    dueDate: '2026-05-30',
    priority: 'Medium',
    status: 'Waiting For Customer',
    attachmentIds: [],
    watcherEmployeeIds: ['emp-2', 'emp-3'],
    checklist: [
      { label: 'Send change-over request', done: true },
      { label: 'Receive confirmed date', done: false }
    ],
    waitingReason: 'Waiting for customer confirmation on broker switchover date.',
    treatmentNotes: 'Email sent 2026-05-23; awaiting reply.',
    notifications: [
      { event: 'assigned', channel: 'email', sentAt: '2026-05-15T12:30:00.000Z', recipientEmployeeId: 'emp-3' }
    ],
    createdAt: '2026-05-15T12:30:00.000Z',
    updatedAt: '2026-05-23T10:00:00.000Z'
  },
  {
    id: 'mtask-5',
    title: 'Internal review of Tnuva escalation path',
    description: 'Confirm ops lead availability windows for the 15-minute escalation.',
    source: 'meeting',
    customerId: 'cust-2',
    sourceMeetingId: 'cmeet-2',
    openedByEmployeeId: 'emp-1',
    assignedToEmployeeId: 'emp-5',
    dueDate: '2026-05-23',
    priority: 'High',
    status: 'Waiting For Internal',
    attachmentIds: [],
    watcherEmployeeIds: ['emp-1', 'emp-5'],
    checklist: [
      { label: 'Escalate to operations director', done: true },
      { label: 'Confirm availability windows', done: false }
    ],
    waitingReason: 'Operations director unavailable until return from PTO.',
    treatmentNotes: 'Operations director on PTO; expected response 2026-05-27.',
    notifications: [
      { event: 'assigned', channel: 'email', sentAt: '2026-05-19T15:00:00.000Z', recipientEmployeeId: 'emp-5' }
    ],
    createdAt: '2026-05-19T15:00:00.000Z',
    updatedAt: '2026-05-22T09:00:00.000Z'
  },
  {
    id: 'mtask-6',
    title: 'Send updated rate card to Strauss procurement',
    description: 'Forward refreshed rate card; flag SKU expansion items.',
    source: 'meeting',
    customerId: 'cust-1',
    sourceMeetingId: 'cmeet-3',
    openedByEmployeeId: 'emp-2',
    assignedToEmployeeId: 'emp-2',
    dueDate: '2026-04-25',
    priority: 'Medium',
    status: 'Done',
    attachmentIds: [],
    watcherEmployeeIds: ['emp-2'],
    checklist: [
      { label: 'Update rate card', done: true },
      { label: 'Send procurement package', done: true }
    ],
    completedAt: '2026-04-24T15:00:00.000Z',
    treatmentNotes: 'Sent on 2026-04-24; confirmation received.',
    notifications: [
      { event: 'assigned', channel: 'email', sentAt: '2026-04-20T10:00:00.000Z', recipientEmployeeId: 'emp-2' },
      { event: 'status-changed', channel: 'email', sentAt: '2026-04-24T15:00:00.000Z', recipientEmployeeId: 'emp-2' }
    ],
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-24T15:00:00.000Z'
  }
];

export const ACTIONOS_ATTACHMENTS: Attachment[] = [];

/**
 * Stable mocked external customer-group catalog. Future implementation will fetch
 * from HomePage_Server -> reportcental.[dig].[Servitz_Customers_Groups].
 * Used by the "Promote prospect" flow when selecting the real group to link.
 */
export const ACTIONOS_EXTERNAL_CUSTOMER_GROUPS: { id: string; name: string }[] = [
  { id: 'SCG-1001', name: 'Strauss Group' },
  { id: 'SCG-1042', name: 'Tnuva' },
  { id: 'SCG-1077', name: 'Osem-Nestle' },
  { id: 'SCG-1093', name: 'Sano Bruno’s Enterprises' },
  { id: 'SCG-1110', name: 'Telma Foods' },
  { id: 'SCG-1121', name: 'Soglowek' },
  { id: 'SCG-1135', name: 'Tara Dairy' },
  { id: 'SCG-1148', name: 'Elite' }
];
