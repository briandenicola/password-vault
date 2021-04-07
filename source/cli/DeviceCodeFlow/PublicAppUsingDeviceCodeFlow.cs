using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Identity.Client;
using Microsoft.Identity.Client.Extensions.Msal;

namespace password.vault.cli
{
    public class PublicAppUsingDeviceCodeFlow
    {
        public PublicAppUsingDeviceCodeFlow(IPublicClientApplication app)
        {
            App = app;
            var cacheHelper = CreateCacheHelperAsync().GetAwaiter().GetResult();
            cacheHelper.RegisterCache(app.UserTokenCache);
        }
        protected IPublicClientApplication App { get; private set; }
        private const string cacheFileName = ".msal_cache";
        private readonly static string cacheDirectory = MsalCacheHelper.UserRootDirectory;
        public async Task<AuthenticationResult> GetTokenForWebApi(IEnumerable<String> scopes)
        {
            AuthenticationResult result = null;

            var accounts = await App.GetAccountsAsync(); 

            if( accounts.Any() )
            {
                try {
                    result = await App.AcquireTokenSilent(scopes, accounts.FirstOrDefault())
                        .ExecuteAsync();
                }
                catch (MsalUiRequiredException) {}
            }

            if( result == null ) {
                result = await GetTokenForWebApiUsingDeviceCodeFlowAsync(scopes);
            }

            return result;
        }

        private async Task<AuthenticationResult> GetTokenForWebApiUsingDeviceCodeFlowAsync(IEnumerable<string> scopes)
        {
            AuthenticationResult result = null;
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

        private async Task<MsalCacheHelper> CreateCacheHelperAsync()
        {
            StorageCreationProperties storageProperties;
            MsalCacheHelper cacheHelper;
            try
            {
                storageProperties = ConfigureSecureStorage();
                cacheHelper = await MsalCacheHelper.CreateAsync(
                            storageProperties,
                            null)
                         .ConfigureAwait(false);

                cacheHelper.VerifyPersistence();

                return cacheHelper;
            }
            catch (MsalCachePersistenceException ex)
            {
                Console.WriteLine("Cannot persist data securely. ");
                Console.WriteLine("Details: " + ex);
                throw;
            }
        }

        private StorageCreationProperties ConfigureSecureStorage()
        {
            return new StorageCreationPropertiesBuilder(
                        cacheFileName,
                        cacheDirectory).Build();
        }
    }
}
