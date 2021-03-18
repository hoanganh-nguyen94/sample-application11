
export enum KeycloakEventType {

  OnAuthError,

  OnAuthLogout,
  OnAuthRefreshError,
  OnAuthRefreshSuccess,
  OnAuthSuccess,
  OnReady,
  OnTokenExpired
}

export interface KeycloakEvent {
  type: KeycloakEventType;
  args?: any;
}
