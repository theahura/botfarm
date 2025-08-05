import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomePage from './views/HomePage.vue'
import ChatPage from './views/ChatPage.vue'

const routes = [
  { path: '/', component: HomePage },
  { path: '/chat/:id', component: ChatPage, props: true }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')