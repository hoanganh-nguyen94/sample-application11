
import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

import { Subject, from } from 'rxjs';
import { map } from 'rxjs/operators';

import * as Keycloak_ from 'keycloak-js';
export const Keycloak = Keycloak_;

import {
  ExcludedUrl,
  ExcludedUrlRegex,
  KeycloakOptions,
} from '../interfaces/keycloak-options';
import { KeycloakEvent, KeycloakEventType } from '../interfaces/keycloak-event';

@Injectable()
export class KeycloakService {

  private _instance: Keycloak.KeycloakInstance;
  private _userProfile: Keycloak.KeycloakProfile;
  private _enableBearerInterceptor: boolean;
  private _silentRefresh: boolean;
  private _loadUserProfileAtStartUp: boolean;
  private _bearerPrefix: string;
  private _authorizationHeaderName: string;
  private _excludedUrls: ExcludedUrlRegex[];
  private _keycloakEvents$: Subject<KeycloakEvent> = new Subject<
    KeycloakEvent
  >();

  private bindsKeycloakEvents(): void {
    this._instance.onAuthError = (errorData) => {
      this._keycloakEvents$.next({
        args: errorData,
        type: KeycloakEventType.OnAuthError,
      });
    };

    this._instance.onAuthLogout = () => {
      this._keycloakEvents$.next({ type: KeycloakEventType.OnAuthLogout });
    };

    this._instance.onAuthRefreshSuccess = () => {
      this._keycloakEvents$.next({
        type: KeycloakEventType.OnAuthRefreshSuccess,
      });
    };

    this._instance.onAuthRefreshError = () => {
      this._keycloakEvents$.next({
        type: KeycloakEventType.OnAuthRefreshError,
      });
    };

    this._instance.onAuthSuccess = () => {
      this._keycloakEvents$.next({ type: KeycloakEventType.OnAuthSuccess });
    };

    this._instance.onTokenExpired = () => {
      this._keycloakEvents$.next({
        type: KeycloakEventType.OnTokenExpired,
      });
    };

    this._instance.onReady = (authenticated) => {
      this._keycloakEvents$.next({
        args: authenticated,
        type: KeycloakEventType.OnReady,
      });
    };
  }

  private loadExcludedUrls(
    bearerExcludedUrls: (string | ExcludedUrl)[]
  ): ExcludedUrlRegex[] {
    const excludedUrls: ExcludedUrlRegex[] = [];
    for (const item of bearerExcludedUrls) {
      let excludedUrl: ExcludedUrlRegex;
      if (typeof item === 'string') {
        excludedUrl = { urlPattern: new RegExp(item, 'i'), httpMethods: [] };
      } else {
        excludedUrl = {
          urlPattern: new RegExp(item.url, 'i'),
          httpMethods: item.httpMethods,
        };
      }
      excludedUrls.push(excludedUrl);
    }
    return excludedUrls;
  }

  private initServiceValues({
    enableBearerInterceptor = true,
    loadUserProfileAtStartUp = false,
    bearerExcludedUrls = [],
    authorizationHeaderName = 'Authorization',
    bearerPrefix = 'Bearer',
    initOptions,
  }: KeycloakOptions): void {
    this._enableBearerInterceptor = enableBearerInterceptor;
    this._loadUserProfileAtStartUp = loadUserProfileAtStartUp;
    this._authorizationHeaderName = authorizationHeaderName;
    this._bearerPrefix = bearerPrefix.trim().concat(' ');
    this._excludedUrls = this.loadExcludedUrls(bearerExcludedUrls);
    this._silentRefresh = initOptions ? initOptions.flow === 'implicit' : false;
  }

  public async init(options: KeycloakOptions = {}) {
    this.initServiceValues(options);
    const { config, initOptions } = options;

    this._instance = Keycloak(config);
    this.bindsKeycloakEvents();

    const authenticated = await this._instance.init(initOptions);

    if (authenticated && this._loadUserProfileAtStartUp) {
      await this.loadUserProfile();
    }

    return authenticated;
  }

  public async login(options: Keycloak.KeycloakLoginOptions = {}) {
    await this._instance.login(options);

    if (this._loadUserProfileAtStartUp) {
      await this.loadUserProfile();
    }
  }

  public async logout(redirectUri?: string) {
    const options = {
      redirectUri,
    };

    await this._instance.logout(options);
    this._userProfile = undefined;
  }

  public async register(
    options: Keycloak.KeycloakLoginOptions = { action: 'register' }
  ) {
    await this._instance.register(options);
  }

  isUserInRole(role: string, resource?: string): boolean {
    let hasRole: boolean;
    hasRole = this._instance.hasResourceRole(role, resource);
    if (!hasRole) {
      hasRole = this._instance.hasRealmRole(role);
    }
    return hasRole;
  }

  getUserRoles(allRoles: boolean = true): string[] {
    let roles: string[] = [];
    if (this._instance.resourceAccess) {
      for (const key in this._instance.resourceAccess) {
        if (this._instance.resourceAccess.hasOwnProperty(key)) {
          const resourceAccess: any = this._instance.resourceAccess[key];
          const clientRoles = resourceAccess['roles'] || [];
          roles = roles.concat(clientRoles);
        }
      }
    }
    if (allRoles && this._instance.realmAccess) {
      const realmRoles = this._instance.realmAccess['roles'] || [];
      roles.push(...realmRoles);
    }
    return roles;
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      if (!this._instance.authenticated) {
        return false;
      }
      await this.updateToken(20);
      return true;
    } catch (error) {
      return false;
    }
  }

  isTokenExpired(minValidity: number = 0): boolean {
    return this._instance.isTokenExpired(minValidity);
  }

  public async updateToken(minValidity = 5) {
    // TODO: this is a workaround until the silent refresh (issue #43)
    // is not implemented, avoiding the redirect loop.
    if (this._silentRefresh) {
      if (this.isTokenExpired()) {
        throw new Error(
          'Failed to refresh the token, or the session is expired'
        );
      }

      return true;
    }

    if (!this._instance) {
      throw new Error('Keycloak Angular library is not initialized.');
    }

    return this._instance.updateToken(minValidity);
  }

  public async loadUserProfile(forceReload = false) {
    if (this._userProfile && !forceReload) {
      return this._userProfile;
    }

    if (!this._instance.authenticated) {
      throw new Error(
        'The user profile was not loaded as the user is not logged in.'
      );
    }

    return this._userProfile = await this._instance.loadUserProfile();
  }

  public async getToken() {
    await this.updateToken(10);
    return this._instance.token;
  }

  public getUsername() {
    if (!this._userProfile) {
      throw new Error('User not logged in or user profile was not loaded.');
    }

    return this._userProfile.username;
  }

  clearToken(): void {
    this._instance.clearToken();
  }

  public addTokenToHeader(headers: HttpHeaders = new HttpHeaders()) {
    return from(this.getToken()).pipe(
      map((token) =>
        token ? headers.set(this._authorizationHeaderName, this._bearerPrefix + token) : headers
      )
    );
  }

  getKeycloakInstance(): Keycloak.KeycloakInstance {
    return this._instance;
  }

  get excludedUrls(): ExcludedUrlRegex[] {
    return this._excludedUrls;
  }

  get enableBearerInterceptor(): boolean {
    return this._enableBearerInterceptor;
  }

  get keycloakEvents$(): Subject<KeycloakEvent> {
    return this._keycloakEvents$;
  }
}
