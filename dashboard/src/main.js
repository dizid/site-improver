import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import App from './App.vue';
import DashboardView from './views/DashboardView.vue';
import PreviewView from './views/PreviewView.vue';
import BillingView from './views/BillingView.vue';
import TeamView from './views/TeamView.vue';
import './styles.css';

// Router configuration
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/preview/:slug',
      name: 'preview',
      component: PreviewView
    },
    {
      path: '/billing',
      name: 'billing',
      component: BillingView
    },
    {
      path: '/team',
      name: 'team',
      component: TeamView
    }
  ]
});

// Create and mount app
const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount('#app');
