using System;
using System.Linq;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Text.Json;
using password.vault.models; 

namespace password.vault.cli
{
    public class ProtectedApiCallHelper
    {
        public ProtectedApiCallHelper(HttpClient httpClient)
        {
            HttpClient = httpClient;
        }

        protected HttpClient HttpClient { get; private set; }
        public async Task<List<PasswordHistory>> CallWebApiAndProcessResultAsync(string webApiUrl, string accessToken)
        {
            var result = new List<PasswordHistory>();
            
            if (!string.IsNullOrEmpty(accessToken))
            {
                var defaultRequetHeaders = HttpClient.DefaultRequestHeaders;
                if (defaultRequetHeaders.Accept == null || !defaultRequetHeaders.Accept.Any(m => m.MediaType == "application/json"))
                {
                    HttpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                }
                HttpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("bearer", accessToken);

                var response = await HttpClient.GetAsync(webApiUrl);
                if (response.IsSuccessStatusCode)
                {
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                    };

                    string json = await response.Content.ReadAsStringAsync();
                    result = JsonSerializer.Deserialize<List<PasswordHistory>>(json, options);
                }
            }

            return result;
        }
    }
}
