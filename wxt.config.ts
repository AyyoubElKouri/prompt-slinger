import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  entrypointsDir: 'entrypoints',
  srcDir: 'src',

  manifest: {
    permissions: ['storage', 'scripting'],
    host_permissions: ['<all_urls>'],
  },

  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
