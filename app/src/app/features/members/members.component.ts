import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CreateMemberInput } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './members.component.html'
})
export class MembersComponent {
  newMember: CreateMemberInput = this.getEmptyMember();

  constructor(public workspace: ActionosWorkspaceService) {}

  addMember(): void {
    if (!this.newMember.name.trim()) {
      return;
    }

    this.workspace.addMember(this.newMember);
    this.newMember = this.getEmptyMember();
  }

  private getEmptyMember(): CreateMemberInput {
    return {
      name: '',
      role: 'Member',
      team: 'Operations'
    };
  }
}
