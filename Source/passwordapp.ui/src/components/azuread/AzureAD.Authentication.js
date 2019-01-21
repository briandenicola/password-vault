import AuthenticationContext from 'adal-angular';

const config = {
  tenant: process.env.VUE_APP_AAD_TENANT_ID,
  clientId: process.env.VUE_APP_AAD_CLIENT_ID,
  redirectUri: process.env.VUE_APP_AAD_REDIRECT_URL,
  cacheLocation: 'localStorage'
};

export default {
  authenticationContext: null,
  /**
   * @return {Promise}
   */
  initialize() {
    this.authenticationContext = new AuthenticationContext(config);

    return new Promise((resolve) => {
      if (this.authenticationContext.isCallback(window.location.hash) || window.self !== window.top) {
        this.authenticationContext.handleWindowCallback();
      } else {
        let user = this.authenticationContext.getCachedUser();

        if (user) {
          resolve();
        } else {
          this.signIn();
        }
      }
    });
  },

  /**
   * @return {Promise.<String>} A promise that resolves to an ADAL token for resource access
   */
  acquireToken() {
    return new Promise((resolve, reject) => {
      this.authenticationContext.acquireToken('<azure active directory resource id>', (error, token) => {
        if (error || !token) {
          return reject(error);
        } else {
          return resolve(token);
        }
      });
    });
  },
  /**
   * Issue an interactive authentication request for the current user and the api resource.
   */
  acquireTokenRedirect() {
    this.authenticationContext.acquireTokenRedirect('<azure active directory resource id>');
  },
  /**
   * @return {Boolean} Indicates if there is a valid, non-expired access token present in localStorage.
   */
  isAuthenticated() {
    // getCachedToken will only return a valid, non-expired token.
    if (this.authenticationContext.getCachedToken(config.clientId)) { return true; }
    return false;
  },
  /**
   * @return An ADAL user profile object.
   */
  getUserProfile() {
    return this.authenticationContext.getCachedUser().profile;
  },
  signIn() {
    this.authenticationContext.login();
  },
  signOut() {
    this.authenticationContext.logOut();
  }
}
