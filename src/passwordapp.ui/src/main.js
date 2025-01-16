import Vue, { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import BootstrapVue from 'bootstrap-vue'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faKey } from '@fortawesome/free-solid-svg-icons'
import { faUserEdit } from '@fortawesome/free-solid-svg-icons'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { faInfo } from '@fortawesome/free-solid-svg-icons'
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import Authentication from './components/azuread/AzureAD.Authentication.js'
import { ClickAnalyticsPlugin } from '@microsoft/applicationinsights-clickanalytics-js';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import Axios from 'axios'
import './registerServiceWorker'

(async () => 
{
  library.add(faKey)
  library.add(faUserEdit)
  library.add(faInfo)
  library.add(faCopy)
  library.add(faTrashAlt)
  library.add(faBars)

  Vue.component('font-awesome-icon', FontAwesomeIcon)
  Vue.config.productionTip = false
  Vue.use(BootstrapVue);
  
  Axios.defaults.baseURL = process.env.VUE_APP_API_ENDPOINT;
  Axios.defaults.headers.common['x-functions-key'] = process.env.VUE_APP_API_KEY;

  Authentication.initialize();
  var token = await Authentication.getBearerToken();
  Axios.defaults.headers.common['Authorization'] = "Bearer ".concat(token);

  const clickPluginInstance = new ClickAnalyticsPlugin();
  const clickPluginConfig = {
    autoCapture: true
  };

  const appInsights = new ApplicationInsights({ config: {
    connectionString: process.env.VUE_APP_INSIGHTS_CONNECTION_STRING,
    extensions: [ clickPluginInstance ],
    extensionConfig: {
      [clickPluginInstance.identifier] : clickPluginConfig
    },
  }});
  appInsights.loadAppInsights();
  appInsights.trackPageView();
  
  createApp(App).use(router).mount('#app');
  
})();