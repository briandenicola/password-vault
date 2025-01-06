import * as msal from "@azure/msal-browser";

let username = "";

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

function handleRedirectResponse(resp) {
  if (resp !== null) {
    username = resp.account.username;
  } else {
    const currentAccounts = authService.getAllAccounts();
    if (!currentAccounts) {
      return; 
    } else if (currentAccounts.length >= 1) {
      username = currentAccounts[0].username;
    }
  }
}

//Still does not handle inital page load properly 
const authService = new msal.PublicClientApplication(msalConfig);
authService.handleRedirectPromise().then(handleRedirectResponse).catch((error) => {
  console.log(error);
});

export default {

  tokenRequest: {
    scopes: [process.env.VUE_APP_AAD_SCOPE]
  },

  loginRequest: {
    scopes: ["User.Read"]
  },

  initialize() {
    const currentAccounts = authService.getAllAccounts();
    if (!currentAccounts) {
      return; 
    } else if (currentAccounts.length >= 1) {
      username = currentAccounts[0].username;
    }
  },

  isAuthenticated() {
    if (username === "") {
      return false;
    }

    let user = authService.getAccountByUsername(username);
    if (!user || user.length < 1) {
      return false;
    }

    return true;
  },

  getUserProfile() {
    return username;
  },

  async signIn() {
    await authService.loginRedirect(this.loginRequest);
  },

  signOut() {
    const logoutRequest = {
      account: authService.getAccountByUsername(username)
    };

    authService.logoutRedirect(logoutRequest);
  },

  async getTokenRedirect(request) {
    request.account = authService.getAccountByUsername(username);
    
    try
    {
      var token = await authService.acquireTokenSilent(request); 
      return token;
    }
    catch(error) 
    {
      if (error instanceof msal.InteractionRequiredAuthError) {
        var tokenFromRedirection = await authService.acquireTokenRedirect(request);        
        return tokenFromRedirection;
      }
    }
    
  },

  async getBearerToken() {
    var response = await this.getTokenRedirect(this.tokenRequest);
    if(response === null || response === undefined ) {
      return null;
    }
    return response.accessToken;
  },

}