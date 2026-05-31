import {
  CreateCustomerMeetingInput,
  CreateMeetingNoteInput,
  CustomerMeeting,
  CustomerMeetingStatus,
  MeetingNote,
  UpdateCustomerMeetingInput,
  UpdateMeetingNoteInput
} from '../models/actionos.models';

/**
 * Boundary for ActionOS customer meetings (operational meetings — distinct from
 * FritzCustomersApi CRM meetings). The two concepts may coexist; ActionOS holds
 * an optional `externalCrmMeetingId` reference but never writes to FritzCustomersApi.
 */
export interface CustomerMeetingRepositoryPort {
  list(): CustomerMeeting[];
  listByCustomer(customerId: string): CustomerMeeting[];
  get(id: string): CustomerMeeting | undefined;
  add(input: CreateCustomerMeetingInput): CustomerMeeting;
  update(id: string, changes: UpdateCustomerMeetingInput): CustomerMeeting | null;
  setStatus(id: string, status: CustomerMeetingStatus): CustomerMeeting | null;
  addNote(
    meetingId: string,
    note: CreateMeetingNoteInput,
    noteId: string,
    createdByEmployeeId?: string,
  ): MeetingNote | null;
  updateNote(meetingId: string, noteId: string, changes: UpdateMeetingNoteInput): MeetingNote | null;
  removeNote(meetingId: string, noteId: string): boolean;
  linkNoteToTask(meetingId: string, noteId: string, taskId: string): void;
}

interface MeetingState {
  customerMeetings: CustomerMeeting[];
}

export class InMemoryCustomerMeetingRepository implements CustomerMeetingRepositoryPort {
  constructor(
    private readonly state: MeetingState,
    private readonly save: () => void,
    private readonly idFactory: () => string,
    private readonly now: () => string,
  ) {}

  list(): CustomerMeeting[] {
    return this.state.customerMeetings.slice().sort((a, b) =>
      b.meetingDate.localeCompare(a.meetingDate),
    );
  }

  listByCustomer(customerId: string): CustomerMeeting[] {
    return this.list().filter((m) => m.customerId === customerId);
  }

  get(id: string): CustomerMeeting | undefined {
    return this.state.customerMeetings.find((m) => m.id === id);
  }

  add(input: CreateCustomerMeetingInput): CustomerMeeting {
    const timestamp = this.now();
    const meeting: CustomerMeeting = {
      id: this.idFactory(),
      customerId: input.customerId,
      subject: input.subject.trim(),
      meetingDate: input.meetingDate,
      meetingLeaderEmployeeId: input.meetingLeaderEmployeeId,
      internalParticipantEmployeeIds: input.internalParticipantEmployeeIds ?? [],
      customerParticipants: input.customerParticipants ?? [],
      goal: input.goal?.trim(),
      summary: '',
      notes: [],
      nextMeetingDate: undefined,
      status: 'Planned',
      attachmentIds: [],
      externalCrmMeetingId: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.customerMeetings.push(meeting);
    this.save();
    return meeting;
  }

  update(id: string, changes: UpdateCustomerMeetingInput): CustomerMeeting | null {
    const target = this.state.customerMeetings.find((m) => m.id === id);
    if (!target) {
      return null;
    }
    Object.assign(target, changes, { updatedAt: this.now() });
    // First save of a summary nudges status forward
    if (target.status === 'Planned' && (target.summary?.trim() || target.notes.length > 0)) {
      target.status = 'Draft Summary';
    }
    this.save();
    return target;
  }

  setStatus(id: string, status: CustomerMeetingStatus): CustomerMeeting | null {
    const target = this.state.customerMeetings.find((m) => m.id === id);
    if (!target) {
      return null;
    }
    target.status = status;
    target.updatedAt = this.now();
    this.save();
    return target;
  }

  addNote(
    meetingId: string,
    note: CreateMeetingNoteInput,
    noteId: string,
    createdByEmployeeId?: string,
  ): MeetingNote | null {
    const target = this.state.customerMeetings.find((m) => m.id === meetingId);
    if (!target) {
      return null;
    }
    const newNote: MeetingNote = {
      id: noteId,
      type: note.type,
      content: note.content.trim(),
      ownerId: note.ownerId,
      dueDate: note.dueDate,
      createdByEmployeeId,
      createdAt: this.now(),
    };
    target.notes.push(newNote);
    target.updatedAt = this.now();
    if (target.status === 'Planned') {
      target.status = 'Draft Summary';
    }
    this.save();
    return newNote;
  }

  updateNote(meetingId: string, noteId: string, changes: UpdateMeetingNoteInput): MeetingNote | null {
    const target = this.state.customerMeetings.find((m) => m.id === meetingId);
    if (!target) {
      return null;
    }
    const note = target.notes.find((n) => n.id === noteId);
    if (!note) {
      return null;
    }
    if (changes.type !== undefined) {
      note.type = changes.type;
    }
    if (changes.content !== undefined) {
      note.content = changes.content.trim();
    }
    if (changes.ownerId !== undefined) {
      note.ownerId = changes.ownerId || undefined;
    }
    if (changes.dueDate !== undefined) {
      note.dueDate = changes.dueDate || undefined;
    }
    target.updatedAt = this.now();
    if (target.status === 'Planned') {
      target.status = 'Draft Summary';
    }
    this.save();
    return note;
  }

  removeNote(meetingId: string, noteId: string): boolean {
    const target = this.state.customerMeetings.find((m) => m.id === meetingId);
    if (!target) {
      return false;
    }
    const index = target.notes.findIndex((n) => n.id === noteId);
    if (index < 0) {
      return false;
    }
    target.notes.splice(index, 1);
    target.updatedAt = this.now();
    this.save();
    return true;
  }

  linkNoteToTask(meetingId: string, noteId: string, taskId: string): void {
    const target = this.state.customerMeetings.find((m) => m.id === meetingId);
    if (!target) {
      return;
    }
    const note = target.notes.find((n) => n.id === noteId);
    if (note) {
      note.convertedTaskId = taskId;
      target.updatedAt = this.now();
      this.save();
    }
  }
}
