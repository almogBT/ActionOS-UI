import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Priority, ProgressionNote, Task, TaskStatus } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  templateUrl: './task-drawer.component.html',
  styles: [`
    .task-attach-list { display: grid; gap: 6px; margin-top: 8px; }
    .task-attach-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px;
      border: 1px solid var(--line); border-radius: 8px;
      background: var(--bg-canvas);
    }
    .task-attach-name { flex: 1; font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .watcher-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .watcher-chip {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px 4px 10px;
      border: 1px solid var(--line); border-radius: 999px;
      background: var(--bg-canvas); font-size: 13px; color: var(--text-primary);
    }
    .watcher-chip button { padding: 0 2px; font-size: 11px; line-height: 1; }
    .progression-form { display: grid; gap: 8px; margin-top: 10px; }
    .progression-form-actions { display: flex; gap: 8px; }
    .progression-notes-list { display: grid; gap: 10px; margin-top: 14px; }
    .progression-note {
      padding: 10px 12px;
      border: 1px solid var(--line); border-radius: 10px;
      background: var(--bg-canvas);
    }
    .progression-note.note-editing { border-color: var(--accent); }
    .progression-note-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    }
    .progression-note-actions { margin-left: auto; display: flex; gap: 4px; }
    .progression-note-body { margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; }
  `]
})
export class TaskDrawerComponent {
  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  meetingChecklistText = '';
  meetingCommentText = '';
  uploadingAttachment = false;
  progressionNoteText = '';
  editingProgressionNoteId: string | null = null;

  @ViewChild('drawerFileInput') drawerFileInput?: ElementRef<HTMLInputElement>;

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  get taskPriorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({
      value: p,
      label: this.i18n.translate('priority.' + this.workspace.statusClass(p))
    }));
  }

  get meetingTaskStatusOptions(): SelectOption[] {
    return this.workspace.meetingTaskStatuses.map(s => ({
      value: s,
      label: this.i18n.translate('meetingTask.statusValues.' + s)
    }));
  }

  get employeeSelectOptions(): SelectOption[] {
    return this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }));
  }

  watcherSelectModel: string | null = null;

  watcherCandidateOptions(task: Task): SelectOption[] {
    return this.workspace.employees
      .filter(e => !task.watcherEmployeeIds.includes(e.id))
      .map(e => ({ value: e.id, label: e.fullName }));
  }

  onWatcherSelect(task: Task, employeeId: string): void {
    if (!employeeId) return;
    this.workspace.toggleMeetingTaskWatcher(task, employeeId, true);
    this.watcherSelectModel = null;
  }

  saveProgressionNote(task: Task): void {
    const content = this.progressionNoteText.trim();
    if (!content) return;

    if (this.editingProgressionNoteId) {
      const updated = (task.progressionNotes ?? []).map(n =>
        n.id === this.editingProgressionNoteId ? { ...n, content } : n
      );
      this.workspace.updateMeetingTask(task.id, { progressionNotes: updated });
      this.editingProgressionNoteId = null;
    } else {
      this.workspace.addTaskProgressionNote(task.id, content);
    }
    this.progressionNoteText = '';
  }

  startEditProgressionNote(note: ProgressionNote): void {
    this.editingProgressionNoteId = note.id;
    this.progressionNoteText = note.content;
  }

  cancelEditProgressionNote(): void {
    this.editingProgressionNoteId = null;
    this.progressionNoteText = '';
  }

  deleteProgressionNote(task: Task, noteId: string): void {
    const updated = (task.progressionNotes ?? []).filter(n => n.id !== noteId);
    this.workspace.updateMeetingTask(task.id, { progressionNotes: updated });
    if (this.editingProgressionNoteId === noteId) {
      this.cancelEditProgressionNote();
    }
  }

  updateMeetingTaskField<K extends keyof Task>(task: Task, field: K, value: Task[K]): void {
    this.workspace.updateMeetingTask(task.id, { [field]: value } as Partial<Task>);
  }

  updateMeetingTaskStatus(task: Task, status: TaskStatus): void {
    this.workspace.updateMeetingTask(task.id, { status });
  }

  addMeetingChecklistItem(task: Task): void {
    this.workspace.addMeetingTaskChecklistItem(task, this.meetingChecklistText);
    this.meetingChecklistText = '';
  }

  addMeetingComment(task: Task): void {
    this.workspace.addMeetingTaskComment(task.id, this.meetingCommentText);
    this.meetingCommentText = '';
  }

  triggerFileInput(): void {
    this.drawerFileInput?.nativeElement.click();
  }

  async onFileSelected(event: Event, task: Task): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    this.uploadingAttachment = true;
    for (const file of Array.from(input.files)) {
      await this.workspace.uploadAttachment(file, 'meeting-task', task.id);
    }
    this.uploadingAttachment = false;
    input.value = '';
  }
}
