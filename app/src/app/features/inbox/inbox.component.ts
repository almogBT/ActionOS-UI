import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MeetingNote, TaskItem, TaskStatus, ViewId } from '../../core/models/actionos.models';
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

  promote(task: TaskItem, status: TaskStatus): void {
    this.workspace.promoteTask(task, status);
  }

  convert(note: MeetingNote): void {
    const task = this.workspace.convertAction(note);

    if (task) {
      this.workspace.openTaskDrawer(task);
    }
  }

  convertAll(): void {
    this.workspace.convertAllOpenActions();
  }
}
