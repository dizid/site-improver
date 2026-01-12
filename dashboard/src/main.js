import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import DashboardView from './views/DashboardView.vue';
import PreviewView from './views/PreviewView.vue';
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
  ]
});

// Create and mount app
const app = createApp(App);
app.use(router);
app.mount('#app');
