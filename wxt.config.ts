import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  entrypointsDir: "src/entrypoints",
  srcDir: "src",

  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
