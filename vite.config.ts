import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
	plugins: [cloudflare()],
	assetsInclude: ['**/*.txt'], // Include .txt files as assets
	define: {
		// This allows importing text files as strings at build time
	},
});
