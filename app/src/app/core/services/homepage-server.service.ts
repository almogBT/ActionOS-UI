import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HomePageUserDto {
  id: string;
  displayName: string;
}

export interface HomePageOrgDto {
  id: string | null;
  displayName: string | null;
  description: string | null;
}

@Injectable({ providedIn: 'root' })
export class HomePageServerService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.homePageServerUrl;

  getUsers(): Observable<HomePageUserDto[]> {
    return this.http.get<HomePageUserDto[]>(`${this.base}/api/User/getAllUsers`);
  }

  getCustomerGroups(): Observable<HomePageOrgDto[]> {
    return this.http.get<HomePageOrgDto[]>(`${this.base}/api/Customer/getAllCustomers/true`);
  }
}