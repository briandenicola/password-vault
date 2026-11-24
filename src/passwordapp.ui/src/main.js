// Third-party stylesheets load first so component styles (imported through
// App.vue and the router) come after them in the bundle and win cascade
// ties, e.g. home.css hiding the `.row` desktop table on phones.
import 'bootstrap/dist/css/bootstrap.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

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
import Axios from 'axios'
import './registerServiceWorker'
import './css/main.css';
import { configureAuthenticatedAxios } from './components/api/authenticated-axios.js';
import { useAccountsStore } from './stores/accounts.store.js';

let requiresAppInsights = import.meta.env.VUE_APP_REQUIRES_APP_INSIGHTS == 'true' ? true : false;

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

  Axios.defaults.baseURL = import.meta.env.VUE_APP_API_ENDPOINT;

  await Authentication.initialize();
  configureAuthenticatedAxios(Axios, Authentication, {
    enabled: import.meta.env.VUE_APP_REQUIRES_AUTHENTICATION == 'true',
  });

  const requiresAuthentication = import.meta.env.VUE_APP_REQUIRES_AUTHENTICATION == 'true';
  const pinia = createPinia();

  // Start loading the account list now, in parallel with mounting the app, instead
  // of waiting for the Home page to be created. The store dedupes, so Home's own
  // fetchAccounts() picks up this in-flight request. Only when already signed in:
  // otherwise the router guard owns the sign-in redirect.
  if (!requiresAuthentication || Authentication.isAuthenticated()) {
    useAccountsStore(pinia).fetchAccounts().catch(() => {
      // The store records the error; Home shows it when it mounts.
    });
  }

  const app = createApp(App);
  app.use(pinia);
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

  // Telemetry is not needed for the first screen: load it in its own chunk after mount.
  if (requiresAppInsights) {
    loadAppInsights().catch(err => console.error('App Insights failed to load:', err));
  }
})();

async function loadAppInsights() {
  const [{ ClickAnalyticsPlugin }, { ApplicationInsights }] = await Promise.all([
    import('@microsoft/applicationinsights-clickanalytics-js'),
    import('@microsoft/applicationinsights-web'),
  ]);
  const clickPluginInstance = new ClickAnalyticsPlugin();
  const appInsights = new ApplicationInsights({ config: {
    connectionString: import.meta.env.VUE_APP_INSIGHTS_CONNECTION_STRING,
    extensions: [ clickPluginInstance ],
    extensionConfig: {
      [clickPluginInstance.identifier]: { autoCapture: true },
    },
  }});
  appInsights.loadAppInsights();
  appInsights.trackPageView();
}
