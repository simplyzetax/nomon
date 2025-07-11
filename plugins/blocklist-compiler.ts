import { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const LOCALHOST_DOMAINS = ['localhost', 'localhost.localdomain', 'local', 'broadcasthost'];

export interface BlocklistCompilerOptions {
	/**
	 * Path to the blocklist file relative to project root
	 */
	blocklistPath: string;
	/**
	 * Virtual module ID for importing the compiled blocklist
	 */
	virtualModuleId?: string;
	/**
	 * Whether to log compilation statistics
	 */
	logStats?: boolean;
}

export function blocklistCompiler(options: BlocklistCompilerOptions): Plugin {
	const virtualModuleId = options.virtualModuleId || 'virtual:compiled-blocklist';
	const resolvedVirtualModuleId = '\0' + virtualModuleId;

	return {
		name: 'blocklist-compiler',

		resolveId(id) {
			if (id === virtualModuleId) {
				return resolvedVirtualModuleId;
			}
		},

		load(id) {
			if (id === resolvedVirtualModuleId) {
				// Compile the blocklist
				const startTime = Date.now();

				try {
					// Read the blocklist file
					const blocklistPath = resolve(process.cwd(), options.blocklistPath);
					const content = readFileSync(blocklistPath, 'utf-8');

					// Parse the blocklist
					const blockedDomains = new Set<string>();
					const lines = content.split('\n');

					for (const line of lines) {
						const trimmed = line.trim();

						// Skip comments and empty lines
						if (!trimmed || trimmed.startsWith('#')) {
							continue;
						}

						// Parse hosts file format: IP_ADDRESS DOMAIN
						const parts = trimmed.split(/\s+/);
						if (parts.length >= 2) {
							const domain = parts[1].toLowerCase();

							// Skip localhost entries
							if (!LOCALHOST_DOMAINS.includes(domain)) {
								blockedDomains.add(domain);
							}
						}
					}

					const compilationTime = Date.now() - startTime;

					if (options.logStats) {
						console.log(`[blocklist-compiler] Compiled ${blockedDomains.size} blocked domains in ${compilationTime}ms`);
					}

					// Generate the module code
					const domainsArray = JSON.stringify(Array.from(blockedDomains));

					return `
// Auto-generated blocklist module - do not edit manually
// Compiled from: ${options.blocklistPath}
// Domains count: ${blockedDomains.size}
// Compilation time: ${compilationTime}ms

const BLOCKED_DOMAINS_ARRAY = ${domainsArray};

export const COMPILED_BLOCKLIST = new Set(BLOCKED_DOMAINS_ARRAY);

export const BLOCKLIST_STATS = {
	totalDomains: ${blockedDomains.size},
	compilationTime: ${compilationTime},
	sourceFile: '${options.blocklistPath}',
	compiledAt: '${new Date().toISOString()}'
};

// Export individual functions for convenience
export function isCompiledDomainBlocked(domain) {
	const normalizedDomain = domain.toLowerCase();
	
	// Check exact match
	if (COMPILED_BLOCKLIST.has(normalizedDomain)) {
		return true;
	}
	
	// Check if any parent domain is blocked (for subdomains)
	const parts = normalizedDomain.split('.');
	for (let i = 1; i < parts.length; i++) {
		const parentDomain = parts.slice(i).join('.');
		if (COMPILED_BLOCKLIST.has(parentDomain)) {
			return true;
		}
	}
	
	return false;
}

export function getBlocklistSize() {
	return COMPILED_BLOCKLIST.size;
}

export default COMPILED_BLOCKLIST;
`.trim();
				} catch (error) {
					this.error(`Failed to compile blocklist: ${error.message}`);
				}
			}
		},
	};
}
