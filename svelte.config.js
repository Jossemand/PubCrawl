import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // SPA mode: every route is client-rendered, with a fallback shell.
    // Works on any static host and runs fully offline on the crawl device.
    adapter: adapter({ fallback: 'index.html' })
  }
};

export default config;
