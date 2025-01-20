<template>
  <div :class="{ 'dark-mode': isDarkMode }">
    <nav class="navbar">
      <button class="btn" @click="toggleDarkMode">
        <font-awesome-icon icon="moon" />
      </button>
    </nav>
  <b-container fluid id="app">
    <b-row>
      <b-col />
    </b-row>
    <b-row>
      <b-col>
        <router-view/>
      </b-col>
    </b-row>
  </b-container>
  </div> 
</template>

<script>
import { ref } from 'vue';

export default {
  setup() {
    const isDarkMode = ref(localStorage.getItem('darkMode') === 'true');

    const toggleDarkMode = () => {
      isDarkMode.value = !isDarkMode.value;
      localStorage.setItem('darkMode', isDarkMode.value);
      if (isDarkMode.value) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    };

    if (isDarkMode.value) {
      document.body.classList.add('dark-mode');
    }

    return {
      isDarkMode,
      toggleDarkMode,
    };
  },
};
</script>

<style scoped>
</style>