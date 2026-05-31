import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, Task, TaskStatus, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './inbox.component.html'
})
export class InboxComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly triageStatuses: TaskStatus[] = ['Planned', 'In Progress', 'Waiting', 'Done'];

  constructor(public workspace: ActionosWorkspaceService) {}

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  promote(task: Task, status: TaskStatus): void {
    this.workspace.promoteTask(task, status);
  }

  convert(item: { note: MeetingNote; meeting: CustomerMeeting }): void {
    this.workspace.convertMeetingAction(item.meeting.id, item.note.id);
  }

  convertAll(): void {
    for (const item of this.workspace.myUnconvertedActionItems) {
      this.workspace.convertMeetingAction(item.meeting.id, item.note.id);
    }
  }

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
