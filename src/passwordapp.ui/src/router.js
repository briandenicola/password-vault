import Vue from 'vue'
import {createRouter, createMemoryHistory} from 'vue-router'
import NotFound from '@/components/notfound/pagenotfound.vue'
import Home from '@/components/home/home.vue'
import Create from '@/components/create/create.vue'
import Update from '@/components/update/update.vue'
import Settings from '@/components/settings/settings.vue'
import Audit from '@/components/audit/audit.vue'
import Trash from '@/components/trash/trash.vue'
import Transfer from '@/components/transfer/transfer.vue'
import Authentication from './components/azuread/AzureAD.Authentication.js'

let requiresAuthentication = process.env.VUE_APP_REQUIRES_AUTHENTICATION  == 'true' ? true : false;

var router = createRouter({
  history: createMemoryHistory(process.env.BASE_URL),
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
      path: '/settings',
      name: 'Settings',
      component: Settings,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    {
      path: '/audit',
      name: 'Audit',
      component: Audit,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    {
      path: '/trash',
      name: 'Trash',
      component: Trash,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    {
      path: '/transfer',
      name: 'Transfer',
      component: Transfer,
      meta: {
        requiresAuthentication: requiresAuthentication
      },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
    { path: '/:pathMatch(.*)', name: 'bad-not-found', component: NotFound },
  ]
})

router.beforeEach(async (to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuthentication)) {
    await Authentication.initialize();
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