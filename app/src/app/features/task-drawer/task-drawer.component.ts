import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { DrawerShellComponent } from '../shared/drawer-shell/drawer-shell.component';
import { TaskFormComponent } from './task-form.component';

/**
 * Thin wrapper that hosts the shared `app-task-form` inside a bottom-sheet
 * drawer for editing an existing (or quick-capture) task. The full task UI now
 * lives in `TaskFormComponent` so the exact same form can also be embedded
 * directly on the Tasks page.
 */
@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, DrawerShellComponent, TaskFormComponent],
  template: `
    <app-drawer-shell
      [open]="!!(workspace.drawerOpen && workspace.selectedTask)"
      ariaLabel="Task details"
      (closed)="workspace.closeTaskDrawer()"
    >
      <app-task-form
        *ngIf="workspace.selectedTask as task"
        [task]="task"
        (closed)="workspace.closeTaskDrawer()"
      ></app-task-form>
    </app-drawer-shell>
  `
})
export class TaskDrawerComponent {
  constructor(public workspace: ActionosWorkspaceService) {}
}
