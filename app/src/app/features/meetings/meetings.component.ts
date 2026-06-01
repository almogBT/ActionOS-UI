import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CalendarEvent, Customer, CustomerMeeting, CustomerMeetingStatus, Task, ViewId
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarComponent } from '../../shared/calendar/calendar.component';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

type MeetingLane = 'upcoming' | 'in-progress' | 'closed';
export type MeetingTileLens = 'upcoming' | 'in-progress' | 'open-tasks';

interface LaneBucket {
  lane: MeetingLane;
  labelKey: string;
  meetings: CustomerMeeting[];
}

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent, CalendarComponent],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss'
})
export class MeetingsComponent implements OnInit, OnChanges {
  @Input() openNewTick = 0;
  @Output() viewChange = new EventEmitter<ViewId>();
  @Output() prepareMeeting = new EventEmitter<Customer>();

  customerFilter: 'all' | string = 'all';
  showPrepPicker = false;
  prepPickerCustomerId = '';
  openLens: MeetingTileLens | null = null;

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  ngOnInit(): void {
    const id = this.workspace.pendingOpenMeetingId;
    if (id) {
      this.workspace.pendingOpenMeetingId = null;
      const meeting = this.workspace.customerMeetings.find(m => m.id === id);
      if (meeting) { this.openMeeting(meeting); }
    } else if (this.openNewTick > 0) {
      this.newMeeting();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['openNewTick'] && !changes['openNewTick'].firstChange) {
      this.newMeeting();
    }
  }

  // ── Customer filter ───────────────────────────────────────────────────────

  get customerFilterOptions(): SelectOption[] {
    return [
      { value: 'all', label: this.i18n.translate('meetingsOverview.allCustomers') },
      ...this.workspace.customers.map(c => ({ value: c.id, label: c.name }))
    ];
  }

  get prepPickerOptions(): SelectOption[] {
    return this.workspace.customers.map(c => ({ value: c.id, label: c.name }));
  }

  get filteredMeetings(): CustomerMeeting[] {
    const all = this.workspace.customerMeetings;
    return this.customerFilter === 'all'
      ? all
      : all.filter(m => m.customerId === this.customerFilter);
  }

  // ── Lanes ─────────────────────────────────────────────────────────────────

  get buckets(): LaneBucket[] {
    return [
      { lane: 'upcoming',    labelKey: 'meetingsOverview.upcoming',   meetings: this.getLane('upcoming') },
      { lane: 'in-progress', labelKey: 'meetingsOverview.inProgress', meetings: this.getLane('in-progress') },
      { lane: 'closed',      labelKey: 'meetingsOverview.closed',     meetings: this.getLane('closed') }
    ];
  }

  getLane(lane: MeetingLane): CustomerMeeting[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.filteredMeetings.filter(m => this.assignLane(m, today) === lane);
  }

  tasksFromMeeting(m: CustomerMeeting): Task[] {
    return this.workspace.meetingTasksByMeeting(m.id);
  }

  get openMeetingTasksCount(): number {
    return this.workspace.openMeetingTasks.length;
  }

  get openMeetingTasks(): Task[] {
    return this.workspace.openMeetingTasks;
  }

  // ── Calendar (meetings only, no tasks) ────────────────────────────────────

  get meetingCalendarEvents(): CalendarEvent[] {
    return this.workspace.calendarEvents.filter(e => e.kind !== 'task');
  }

  onCalendarEventOpened(evt: CalendarEvent): void {
    this.workspace.openMeetingDrawer(evt.sourceId);
  }

  // ── Tile popup ────────────────────────────────────────────────────────────

  openTile(lens: MeetingTileLens): void {
    this.openLens = lens;
  }

  closeTile(): void {
    this.openLens = null;
  }

  get lensMeetings(): CustomerMeeting[] {
    if (!this.openLens || this.openLens === 'open-tasks') return [];
    return this.getLane(this.openLens as MeetingLane);
  }

  get lensTitleKey(): string {
    switch (this.openLens) {
      case 'upcoming':    return 'meetingsOverview.upcoming';
      case 'in-progress': return 'meetingsOverview.inProgress';
      case 'open-tasks':  return 'meetingsOverview.openMeetingTasks';
      default:            return 'meetingsOverview.title';
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onPrepCustomerSelected(customerId: string): void {
    const customer = this.workspace.customers.find(c => c.id === customerId);
    if (customer) {
      this.showPrepPicker = false;
      this.prepPickerCustomerId = '';
      this.prepareMeeting.emit(customer);
    }
  }

  newMeeting(): void {
    this.workspace.openNewMeetingModal();
  }

  openMeeting(m: CustomerMeeting): void {
    this.workspace.openMeetingDrawer(m.id);
  }

  openTask(task: Task): void {
    this.workspace.selectMeetingTask(task);
  }

  private assignLane(m: CustomerMeeting, today: string): MeetingLane {
    const meetingDay = m.meetingDate.slice(0, 10);
    const closedStatuses: CustomerMeetingStatus[] = ['Closed'];
    if (closedStatuses.includes(m.status)) return 'closed';
    if (meetingDay >= today) return 'upcoming';
    return 'in-progress';
  }
}
