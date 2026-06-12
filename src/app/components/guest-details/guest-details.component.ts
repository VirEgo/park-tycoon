import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Guest } from '../../models/guest.model';

@Component({
    selector: 'app-guest-details',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './guest-details.component.html',
    styleUrls: ['./guest-details.component.scss']
})
export class GuestDetailsComponent {
    guest = input.required<Guest>();
    guestImageSrc = input.required<string>();
    close = output<void>();
}
