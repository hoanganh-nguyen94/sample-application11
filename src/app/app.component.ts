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
        url: 'http://dayaway-identity-dev.the-hash.com/auth/',
        realm: 'dayaway-guest',
        clientId: 'dayaway-public-site',

      },
      initOptions: {
        onLoad: 'login-required',
        pkceMethod: 'S256'
      }
    }).then(() => {
      // keycloakService.getToken().then(console.log);
      // keycloakService.login();
      keycloakService.updateToken()
      // setTimeout(() => keycloakService.logout('https://google.com').then(), 3000);
    });

  }
}
