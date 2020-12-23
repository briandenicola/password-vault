using Microsoft.Identity.Client;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace password.vault.cli
{
    public class PublicAppUsingDeviceCodeFlow
    {
        public PublicAppUsingDeviceCodeFlow(IPublicClientApplication app)
        {
            App = app;
        }
        protected IPublicClientApplication App { get; private set; }

        public async Task<AuthenticationResult> GetTokenForWebApiUsingDeviceCodeFlowAsync(IEnumerable<String> scopes)
        {
            AuthenticationResult result;

            try
            {

                result = await App.AcquireTokenWithDeviceCode(scopes, deviceCodeCallback =>  {
                    Console.WriteLine(deviceCodeCallback.Message);
                    return Task.FromResult(0);
                }).ExecuteAsync();
            }
            catch (MsalServiceException)
            {
                throw;
            }
            catch (OperationCanceledException)
            {
                result = null;
            }
            catch (MsalClientException)
            {
                result = null;
            }
            
            return result;
        }
    }
}
