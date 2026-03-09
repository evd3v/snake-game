<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <nav>
    <RouterLink to="/">Dashboard</RouterLink>
    <RouterLink to="/sentences">Sentences</RouterLink>
    <RouterLink to="/vocabulary">Vocabulary</RouterLink>
  </nav>
  <main>
    <RouterView />
  </main>
</template>
