import {createRouter, createMemoryHistory} from 'vue-router'
import Home from '@/components/home/home.vue'
import Authentication from './components/azuread/AzureAD.Authentication.js'

const NotFound = () => import('@/components/notfound/pagenotfound.vue')
// Home is the first screen, so it stays in the main bundle; every other page loads on demand.
const Create = () => import('@/components/create/create.vue')
const Update = () => import('@/components/update/update.vue')
const Settings = () => import('@/components/settings/settings.vue')
const Audit = () => import('@/components/audit/audit.vue')
const Trash = () => import('@/components/trash/trash.vue')
const Transfer = () => import('@/components/transfer/transfer.vue')

let requiresAuthentication = import.meta.env.VUE_APP_REQUIRES_AUTHENTICATION  == 'true' ? true : false;

var router = createRouter({
  history: createMemoryHistory(import.meta.env.BASE_URL),
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