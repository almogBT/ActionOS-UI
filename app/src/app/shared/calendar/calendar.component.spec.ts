import { TestBed } from '@angular/core/testing';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { CalendarEvent } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarComponent } from './calendar.component';

describe('CalendarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        { provide: ActionosWorkspaceService, useValue: { calendarEvents: [] } },
        { provide: ActionosI18nService, useValue: { language: 'en' } },
      ],
    }).compileComponents();
  });

  it('keeps an equivalent event override stable across input checks', () => {
    const fixture = TestBed.createComponent(CalendarComponent);
    const component = fixture.componentInstance;
    const event: CalendarEvent = {
      id: 'task-1',
      title: 'Prepare release',
      startsAt: '2026-06-03T09:00:00',
      durationMinutes: 30,
      kind: 'task',
      attendeeCount: 0,
      sourceId: '1',
    };

    component.events = [event];
    expect(component.nextEvent()).toBe(event);

    component.events = [{ ...event }];
    expect(component.nextEvent()).toBe(event);

    component.events = [{ ...event, title: 'Prepare final release' }];
    expect(component.nextEvent()?.title).toBe('Prepare final release');
  });

  it('emits the clicked day + hour when an empty slot is selected', () => {
    const fixture = TestBed.createComponent(CalendarComponent);
    const component = fixture.componentInstance;

    let emitted: Date | undefined;
    component.slotSelected.subscribe((d) => (emitted = d));

    component.selectSlot(new Date(2026, 5, 9, 0, 0, 0), 14); // Tue Jun 9 2026, 2 PM

    expect(emitted).toBeDefined();
    expect(emitted!.getFullYear()).toBe(2026);
    expect(emitted!.getMonth()).toBe(5);
    expect(emitted!.getDate()).toBe(9);
    expect(emitted!.getHours()).toBe(14);
    expect(emitted!.getMinutes()).toBe(0);
  });
});
