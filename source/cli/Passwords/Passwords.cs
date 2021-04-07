

using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Collections.Generic;

using Microsoft.Identity.Client;

using password.vault.models;

namespace password.vault.cli
{
    public class Passwords
    {
        public Passwords(IPublicClientApplication app, PasswordConfiguration config)
        {
            tokenAcquisitionHelper = new PublicAppUsingDeviceCodeFlow(app);
            protectedApiCallHelper = new ProtectedApiCallHelper<PasswordHistory>(client);

            this.PasswordEndPoint = config.PasswordApiEndpoint;
            this.PasswordApiCode = config.PasswordApiCode;
            this.PasswordId = config.PasswordClientId;
            this.Scopes = new string[] { config.PasswordApiScope };
        }

        protected PublicAppUsingDeviceCodeFlow tokenAcquisitionHelper;

        protected ProtectedApiCallHelper<PasswordHistory> protectedApiCallHelper;

        private string[] Scopes { get; set; }

        private string PasswordEndPoint { get; set; }
        private string PasswordApiCode { get; set; }
        private string PasswordId { get; set; }
        private string PasswordHistoryUrl { get { return $"{PasswordEndPoint}/api/passwords/{PasswordId}/history?code={PasswordApiCode}"; } }
        private HttpClient client = new HttpClient();

        public async Task DisplayPasswordHistory()
        {
            AuthenticationResult authenticationResult = await tokenAcquisitionHelper.GetTokenForWebApi(Scopes);
            if (authenticationResult != null)
            {
                DisplaySignedInAccount(authenticationResult.Account, authenticationResult.AccessToken);
                var result = await CallWebApiAsync(PasswordHistoryUrl, authenticationResult.AccessToken);
                Display(result);
            }
        }

        private void DisplaySignedInAccount(IAccount account, string token)
        {
            Console.WriteLine("==============================================================");
            Console.WriteLine($"|Information for Debug:");
            Console.WriteLine($"|Password Uri: {PasswordHistoryUrl}");
            Console.WriteLine($"|Logged in User: {account.Username}");
            Console.WriteLine($"|Access Token: {token}");
            Console.WriteLine("==============================================================");
        }

        private async Task<List<PasswordHistory>> CallWebApiAsync(string url, string accessToken)
        {
            var history = await protectedApiCallHelper.CallWebApiAndProcessResultAsync(url, accessToken);
            return history;
        }

        private static void Display(List<PasswordHistory> result)
        {
            Console.WriteLine($"Password History for Site: {result.FirstOrDefault().SiteName}");
            foreach (PasswordHistory child in result.OrderByDescending(c => c.TimeStamp))
            {
                Console.WriteLine($"[{child.TimeStamp.ToString("MM/dd/yyyy hh:mm tt")}] - {child.Password}");
            }
        }
    }
}
