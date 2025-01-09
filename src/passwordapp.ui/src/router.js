import Vue from 'vue'
import Router from 'vue-router'
import NotFound from '@/components/notfound/pagenotfound.vue'
import Home from '@/components/home/home.vue'
import Create from '@/components/create/create.vue'
import Update from '@/components/update/update.vue'
import Authentication from './components/azuread/AzureAD.Authentication.js'

Vue.use(Router)

let requiresAuthentication = process.env.VUE_APP_REQUIRES_AUTHENTICATION  == 'true' ? true : false;

var router = new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    {
      path: '/password/update/:id',
      name: 'Update',
      component: Update,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    {
      path: '/password/create',
      name: 'Create',
      component: Create,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    {
      path: '*',
      name: 'NotFound',
      component: NotFound,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
  ]
})

router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuthentication)) {
    if (Authentication.isAuthenticated()) {
      next();
    } else {
      Authentication.signIn();
    }
  } else {
    next();
  }
});

export default router;