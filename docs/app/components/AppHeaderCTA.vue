<template>
  <UButton
    v-if="$route.path == '/'"
    to="/getting-started/installation"
    color="neutral"
    size="sm"
    class="hidden lg:inline-flex"
  >
    Get Started
  </UButton>
</template>
