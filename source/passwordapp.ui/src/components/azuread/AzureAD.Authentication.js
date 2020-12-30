import * as msal from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: process.env.VUE_APP_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.VUE_APP_AAD_TENANT_ID}`,
    redirectUri: process.env.VUE_APP_AAD_REDIRECT_URL,
  },
  cache: {
    cacheLocation: "localStorage", 
    storeAuthStateInCookie: false, 
  }
};

const loginRequest = {
  scopes: ["User.Read"]
};

const tokenRequest = {
  scopes: [process.env.VUE_APP_AAD_SCOPE]
};

const myMSALObj = new msal.PublicClientApplication(msalConfig)
let username = "";

export default {
  initialize() {
    return new Promise((resolve) => {
      const currentAccounts = myMSALObj.getAllAccounts();
      if (currentAccounts === null || currentAccounts.length == 0) {
        this.signIn();
      } else {
        username = currentAccounts[0].username;
        resolve();
      }
    });
  },
  isAuthenticated() {
      if(username == "" ) {
          return false;
      }
  
      let user = myMSALObj.getAccountByUsername(username);
      if (!user || user.length < 1) {
          return false;
      }

      return true; 
  },
  handleResponse(resp) {
      if (resp !== null) {
        username = resp.account.username;
      } else {
        this.initialize();
      }
  },
  getUserProfile() {
    return username;
  },
  signIn() {
    myMSALObj.loginPopup(loginRequest).then(this.handleResponse).catch(error => {
        console.error(error);
    });
  },
  signOut() {
    const logoutRequest = {
      account: myMSALObj.getAccountByUsername(username)
    };

    myMSALObj.logout(logoutRequest);
  },
  getTokenRedirect(request) {
    request.account = myMSALObj.getAccountByUsername(username);
    return myMSALObj.acquireTokenSilent(request).catch(error => {
        if (error instanceof msal.InteractionRequiredAuthError) {
            return myMSALObj.acquireTokenPopup(request).then(tokenResponse => {
                return tokenResponse;
            }).catch(error => {
                console.error(error);
            });
        } else {
            console.warn(error);
        }
    });
  },
  getBearerToken() {
    return this.getTokenRedirect(tokenRequest).then(response => {
      return response.accessToken;
    }).catch(error => {
      console.error(error);
    });
  }
};
