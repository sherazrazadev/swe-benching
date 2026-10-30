<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'S4' })
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-white text-black">
    <h1 class="text-6xl font-bold">
      {{ title }}
    </h1>
  </div>
</template>
