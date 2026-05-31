import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CreateMemberInput } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  templateUrl: './members.component.html'
})
export class MembersComponent {
  newMember: CreateMemberInput = this.getEmptyMember();

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  get roleOptions(): SelectOption[] {
    return ['Owner', 'Admin', 'Manager', 'Member', 'Viewer', 'Guest'].map(r => ({
      value: r, label: this.i18n.translate('members.roles.' + r.toLowerCase())
    }));
  }

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
