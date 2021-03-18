import {Component} from '@angular/core';
import {KeycloakService} from './services/keycloak.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'sample-application11';

  constructor(private keycloakService: KeycloakService) {
    keycloakService.init({
      config: {
        url: 'http://localhost:8000/auth/',
        realm: 'master',
        clientId: 'client-id-site',

      },
      initOptions: {
        onLoad: 'login-required',
        pkceMethod: 'S256'
      }
    }).then(() => {
      keycloakService.updateToken()
    });

  }
}
