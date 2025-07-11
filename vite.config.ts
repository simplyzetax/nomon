import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { blocklistCompiler } from './plugins/blocklist-compiler.js';

export default defineConfig({
	plugins: [
		cloudflare(),
		blocklistCompiler({
			blocklistPath: 'lists/pi-hole.txt',
			logStats: true,
		}),
	],
});
