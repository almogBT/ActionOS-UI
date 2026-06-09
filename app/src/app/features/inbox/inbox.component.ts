import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { InboxActionId, InboxCategory, InboxFeedItem, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

type InboxFilter = 'all' | InboxCategory;

/** A single (non-meeting) feed item rendered on its own row. */
interface InboxItemRow {
  type: 'item';
  key: string;
  timestamp: string;
  item: InboxFeedItem;
}

/** Several items from the same meeting, collapsed under one header. */
interface InboxMeetingRow {
  type: 'meeting';
  key: string;
  timestamp: string;
  meetingId: string;
  title: string;
  items: InboxFeedItem[];
  decisions: number;
  notes: number;
  actions: number;
}

type InboxRow = InboxItemRow | InboxMeetingRow;

interface InboxGroup {
  id: string;
  labelKey: string;
  rows: InboxRow[];
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss'
})
export class InboxComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  /**
   * When hosted inside another screen (e.g. the My Work "Inbox" tab) the page
   * already names the section, so the inbox's own title + subtitle are
   * redundant. Set this to hide that header text (the "mark all read" action
   * stays, right-aligned).
   */
  @Input() embedded = false;

  readonly workspace = inject(ActionosWorkspaceService);
  private readonly i18n = inject(ActionosI18nService);

  readonly filter = signal<InboxFilter>('all');
  readonly search = signal('');
  /** meeting-group keys that are currently expanded (collapsed is the default). */
  private readonly expandedKeys = signal<Set<string>>(new Set<string>());

  readonly filters: { id: InboxFilter; labelKey: string }[] = [
    { id: 'all',      labelKey: 'inbox.filters.all' },
    { id: 'tasks',    labelKey: 'inbox.filters.tasks' },
    { id: 'meetings', labelKey: 'inbox.filters.meetings' },
    { id: 'waiting',  labelKey: 'inbox.filters.waiting' }
  ];
  private readonly visibleItemsCache: {
    feed: InboxFeedItem[] | null;
    filter: InboxFilter | null;
    search: string;
    value: InboxFeedItem[];
  } = { feed: null, filter: null, search: '', value: [] };
  private readonly groupsCache: {
    items: InboxFeedItem[] | null;
    today: string;
    value: InboxGroup[];
    weekAgo: string;
  } = { items: null, today: '', value: [], weekAgo: '' };
  private readonly countsCache: {
    counts: Map<InboxFilter, number>;
    feed: InboxFeedItem[] | null;
  } = { counts: new Map(), feed: null };

  // ── Derived views ─────────────────────────────────────────────────────────

  /** Feed items matching the active filter pill and the search term. */
  get visibleItems(): InboxFeedItem[] {
    const active = this.filter();
    const term = this.search().trim().toLowerCase();
    const feed = this.workspace.inboxFeed;
    if (
      this.visibleItemsCache.feed === feed &&
      this.visibleItemsCache.filter === active &&
      this.visibleItemsCache.search === term
    ) {
      return this.visibleItemsCache.value;
    }

    let items = feed;
    if (active !== 'all') {
      items = items.filter(item => item.category === active);
    }
    if (term) {
      items = items.filter(item =>
        item.primaryText.toLowerCase().includes(term) ||
        (item.contextText?.toLowerCase().includes(term) ?? false)
      );
    }
    this.visibleItemsCache.feed = feed;
    this.visibleItemsCache.filter = active;
    this.visibleItemsCache.search = term;
    this.visibleItemsCache.value = items;
    return items;
  }

  /** Visible items → date sections, each holding item rows + meeting groups. */
  get groups(): InboxGroup[] {
    const items = this.visibleItems;
    const today = this.workspace.todayIso;
    const weekAgo = this.workspace.dateAfter(-7);
    if (
      this.groupsCache.items === items &&
      this.groupsCache.today === today &&
      this.groupsCache.weekAgo === weekAgo
    ) {
      return this.groupsCache.value;
    }

    const dayOf = (ts: string) => ts.slice(0, 10);

    const buckets: { id: string; labelKey: string; items: InboxFeedItem[] }[] = [
      { id: 'today',   labelKey: 'inbox.groups.today',   items: items.filter(i => dayOf(i.timestamp) >= today) },
      { id: 'week',    labelKey: 'inbox.groups.week',    items: items.filter(i => dayOf(i.timestamp) < today && dayOf(i.timestamp) >= weekAgo) },
      { id: 'earlier', labelKey: 'inbox.groups.earlier', items: items.filter(i => dayOf(i.timestamp) < weekAgo) }
    ];

    const value = buckets
      .filter(b => b.items.length)
      .map(b => ({ id: b.id, labelKey: b.labelKey, rows: this.toRows(b.items) }));
    this.groupsCache.items = items;
    this.groupsCache.today = today;
    this.groupsCache.weekAgo = weekAgo;
    this.groupsCache.value = value;
    return value;
  }

  /** Collapse meeting items (2+ from the same meeting) into one row. */
  private toRows(items: InboxFeedItem[]): InboxRow[] {
    const meetingBuckets = new Map<string, InboxFeedItem[]>();
    const rows: InboxRow[] = [];

    for (const item of items) {
      if (item.category === 'meetings' && item.meetingId) {
        const list = meetingBuckets.get(item.meetingId) ?? [];
        list.push(item);
        meetingBuckets.set(item.meetingId, list);
      } else {
        rows.push({ type: 'item', key: item.id, timestamp: item.timestamp, item });
      }
    }

    for (const [meetingId, list] of meetingBuckets) {
      if (list.length === 1) {
        rows.push({ type: 'item', key: list[0].id, timestamp: list[0].timestamp, item: list[0] });
        continue;
      }
      const newest = list.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
      rows.push({
        type: 'meeting',
        key: `mtg:${meetingId}`,
        timestamp: newest.timestamp,
        meetingId,
        title: list.find(i => i.groupLabel)?.groupLabel ?? '',
        items: list,
        decisions: list.filter(i => i.kind === 'meeting-decision').length,
        notes: list.filter(i => i.kind === 'meeting-note').length,
        actions: list.filter(i => i.kind === 'meeting-action').length
      });
    }

    return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  countFor(id: InboxFilter): number {
    const feed = this.workspace.inboxFeed;
    if (this.countsCache.feed !== feed) {
      this.countsCache.feed = feed;
      this.countsCache.counts = new Map<InboxFilter, number>([
        ['all', feed.length],
        ['tasks', 0],
        ['meetings', 0],
        ['waiting', 0]
      ]);
      for (const item of feed) {
        this.countsCache.counts.set(item.category, (this.countsCache.counts.get(item.category) ?? 0) + 1);
      }
    }
    return this.countsCache.counts.get(id) ?? 0;
  }

  groupHasUnread(row: InboxMeetingRow): boolean {
    return row.items.some(item => this.workspace.isInboxUnread(item.id));
  }

  isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  /** Human-friendly "2h ago" / "3d ago" label for the item timestamp. */
  relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) {
      return '';
    }
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return this.i18n.translate('inbox.time.now');
    if (mins < 60) return this.i18n.translate('inbox.time.minutes', { n: mins });
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return this.i18n.translate('inbox.time.hours', { n: hrs });
    const days = Math.round(hrs / 24);
    if (days < 30) return this.i18n.translate('inbox.time.days', { n: days });
    return iso.slice(0, 10);
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  setFilter(id: InboxFilter): void {
    this.filter.set(id);
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  markAllRead(): void {
    this.workspace.markAllInboxRead();
  }

  toggleGroup(key: string): void {
    const next = new Set(this.expandedKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.expandedKeys.set(next);
  }

  /** "View meeting" from a group header: opens the drawer and clears its unread. */
  openMeetingGroup(row: InboxMeetingRow, event: Event): void {
    event.stopPropagation();
    this.workspace.openMeetingDrawer(row.meetingId);
    for (const item of row.items) {
      this.workspace.markInboxRead(item.id);
    }
  }

  dismissGroup(row: InboxMeetingRow, event: Event): void {
    event.stopPropagation();
    for (const item of row.items) {
      this.workspace.dismissInboxItem(item.id);
    }
  }

  /** Clicking the row body opens the underlying task or meeting. */
  openItem(item: InboxFeedItem): void {
    if (item.taskId) {
      this.openTask(item);
    } else if (item.meetingId) {
      this.workspace.openMeetingDrawer(item.meetingId);
      this.workspace.markInboxRead(item.id);
    }
  }

  runAction(item: InboxFeedItem, action: InboxActionId, event: Event): void {
    event.stopPropagation();
    switch (action) {
      case 'open-task':
        this.openTask(item);
        break;
      case 'done':
        this.markTaskDone(item);
        break;
      case 'make-task':
        if (item.meetingId && item.noteId) {
          this.workspace.convertMeetingAction(item.meetingId, item.noteId);
        }
        this.workspace.markInboxRead(item.id);
        break;
      case 'view-meeting':
        if (item.meetingId) {
          this.workspace.openMeetingDrawer(item.meetingId);
        }
        this.workspace.markInboxRead(item.id);
        break;
      case 'dismiss':
        this.workspace.dismissInboxItem(item.id);
        break;
    }
  }

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  trackFilter(_index: number, filter: { id: InboxFilter }): InboxFilter {
    return filter.id;
  }

  trackGroup(_index: number, group: InboxGroup): string {
    return group.id;
  }

  trackRow(_index: number, row: InboxRow): string {
    return row.key;
  }

  trackItem(_index: number, item: InboxFeedItem): string {
    return item.id;
  }

  trackAction(_index: number, action: { id: InboxActionId }): InboxActionId {
    return action.id;
  }

  private taskById(id: string): Task | undefined {
    return this.workspace.meetingTasks.find(task => task.id === id);
  }

  private openTask(item: InboxFeedItem): void {
    if (item.taskId) {
      const task = this.taskById(item.taskId);
      if (task) {
        this.workspace.selectMeetingTask(task);
      }
    }
    this.workspace.markInboxRead(item.id);
  }

  private markTaskDone(item: InboxFeedItem): void {
    if (item.taskId) {
      const task = this.taskById(item.taskId);
      if (task) {
        this.workspace.promoteTask(task, 'Done');
      }
    }
    this.workspace.markInboxRead(item.id);
  }
}
