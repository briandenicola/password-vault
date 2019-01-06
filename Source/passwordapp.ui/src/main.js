import Vue from 'vue'
import App from './App.vue'
import router from './router'
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import Authentication from './components/AzureAD.Authentication.js'
import Axios from 'axios';

Vue.config.productionTip = false
Vue.use(BootstrapVue);

Axios.defaults.baseURL = process.env.VUE_APP_API_ENDPOINT;
Axios.defaults.headers.common['x-functions-key'] = process.env.VUE_APP_API_KEY;

Authentication.initialize().then(() => {
  new Vue({
    router,
    render: function (h) { return h(App) }
  }).$mount('#app');
});