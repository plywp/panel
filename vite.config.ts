import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import devtools from 'vite-plugin-devtools-json';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), devtools()],
    server: {
      allowedHosts: []
    }
});
