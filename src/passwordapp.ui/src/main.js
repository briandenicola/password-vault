import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import 'primeicons/primeicons.css'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Paginator from 'primevue/paginator'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Tooltip from 'primevue/tooltip'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'

import 'bootstrap/dist/css/bootstrap.css'

import { library } from '@fortawesome/fontawesome-svg-core'
import { faKey } from '@fortawesome/free-solid-svg-icons'
import { faUserEdit } from '@fortawesome/free-solid-svg-icons'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { faInfo } from '@fortawesome/free-solid-svg-icons'
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { faMoon } from '@fortawesome/free-solid-svg-icons'
import { faBars } from '@fortawesome/free-solid-svg-icons'
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import Authentication from './components/azuread/AzureAD.Authentication.js'
import { ClickAnalyticsPlugin } from '@microsoft/applicationinsights-clickanalytics-js';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import Axios from 'axios'
import './registerServiceWorker'
import './css/main.css';
import { configureAuthenticatedAxios } from './components/api/authenticated-axios.js';

let requiresAppInsights = process.env.VUE_APP_REQUIRES_APP_INSIGHTS == 'true' ? true : false;

(async () =>
{
  library.add(faKey)
  library.add(faUserEdit)
  library.add(faInfo)
  library.add(faCopy)
  library.add(faTrashAlt)
  library.add(faBars)
  library.add(faClockRotateLeft)
  library.add(faMoon)
  library.add(faRightFromBracket)

  Axios.defaults.baseURL = process.env.VUE_APP_API_ENDPOINT;

  await Authentication.initialize();
  configureAuthenticatedAxios(Axios, Authentication, {
    enabled: process.env.VUE_APP_REQUIRES_AUTHENTICATION == 'true',
  });

  if(requiresAppInsights ) {
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
  }

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        // Keep PrimeVue's dark theme off the .dark-mode class collision; use a custom selector.
        darkModeSelector: '.p-dark',
      },
    },
  });
  app.use(ToastService);

  app.component('font-awesome-icon', FontAwesomeIcon);
  app.component('Button', Button);
  app.component('InputText', InputText);
  app.component('Textarea', Textarea);
  app.component('Checkbox', Checkbox);
  app.component('RadioButton', RadioButton);
  app.component('Select', Select);
  app.component('Dialog', Dialog);
  app.component('DataTable', DataTable);
  app.component('Column', Column);
  app.component('Paginator', Paginator);
  app.component('Tag', Tag);
  app.component('Message', Message);
  app.component('Toast', Toast);
  app.directive('tooltip', Tooltip);

  app.mount('#app');
})();
