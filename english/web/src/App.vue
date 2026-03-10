<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <span class="logo">📖 English</span>
        <nav class="nav">
          <RouterLink to="/" class="nav-link" :class="{ active: route.path === '/' }">Dashboard</RouterLink>
          <RouterLink to="/sentences" class="nav-link" :class="{ active: route.path === '/sentences' }">Sentences</RouterLink>
          <RouterLink to="/vocabulary" class="nav-link" :class="{ active: route.path === '/vocabulary' }">Vocabulary</RouterLink>
          <RouterLink to="/grammar" class="nav-link" :class="{ active: route.path === '/grammar' }">Grammar</RouterLink>
          <RouterLink to="/collocations" class="nav-link" :class="{ active: route.path === '/collocations' }">Collocations</RouterLink>
          <RouterLink to="/review" class="nav-link" :class="{ active: route.path === '/review' }">Review</RouterLink>
        </nav>
      </div>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style>
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f8fafc;
  color: #1e293b;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.3px;
}

.nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  transition: all 0.15s;
}

.nav-link:hover {
  color: #334155;
  background: #f1f5f9;
}

.nav-link.active {
  color: #2563eb;
  background: #eff6ff;
}

.main {
  flex: 1;
}
</style>
