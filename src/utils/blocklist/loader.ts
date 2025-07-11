import { Logger } from '../utils/logger.js';

export class BlocklistLoader {
	private static blockedDomains: Set<string> | null = null;
	private static stats: any = null;

	/**
	 * Load a pre-compiled blocklist (from Vite plugin)
	 */
	static loadCompiledBlocklist(compiledBlocklist: Set<string>, stats?: any): void {
		this.blockedDomains = compiledBlocklist;
		this.stats = stats;

		Logger.log(`Loaded pre-compiled blocklist with ${compiledBlocklist.size} blocked domains`);

		if (stats) {
			Logger.log('Blocklist compilation stats:', {
				totalDomains: stats.totalDomains,
				compilationTime: stats.compilationTime,
				sourceFile: stats.sourceFile,
				compiledAt: stats.compiledAt,
			});
		}
	}

	/**
	 * Legacy method: Parse and load the blocklist from hosts file content (runtime parsing)
	 * @deprecated Use pre-compiled blocklist from Vite plugin instead
	 */
	static loadBlocklist(content: string): void {
		Logger.warn('Using legacy runtime parsing. Consider using pre-compiled blocklist for better performance.');

		this.blockedDomains = new Set<string>();

		const lines = content.split('\n');
		const LOCALHOST_DOMAINS = ['localhost', 'localhost.localdomain', 'local', 'broadcasthost'];

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
					this.blockedDomains.add(domain);
				}
			}
		}

		Logger.log(`Loaded ${this.blockedDomains.size} blocked domains from runtime parsing`);
	}

	/**
	 * Get the current blocklist as a Set
	 */
	static getBlocklist(): Set<string> {
		if (!this.blockedDomains) {
			throw new Error('Blocklist not loaded. Call loadCompiledBlocklist() or loadBlocklist() first.');
		}
		return this.blockedDomains;
	}

	/**
	 * Get the number of blocked domains
	 */
	static getBlocklistSize(): number {
		return this.blockedDomains?.size || 0;
	}

	/**
	 * Check if the blocklist has been loaded
	 */
	static isLoaded(): boolean {
		return this.blockedDomains !== null && this.blockedDomains.size > 0;
	}

	/**
	 * Add a domain to the blocklist manually
	 */
	static addDomain(domain: string): void {
		if (!this.blockedDomains) {
			throw new Error('Blocklist not loaded. Call loadCompiledBlocklist() or loadBlocklist() first.');
		}
		this.blockedDomains.add(domain.toLowerCase());
	}

	/**
	 * Remove a domain from the blocklist manually
	 */
	static removeDomain(domain: string): boolean {
		if (!this.blockedDomains) {
			return false;
		}
		return this.blockedDomains.delete(domain.toLowerCase());
	}

	/**
	 * Get all blocked domains as an array (for debugging/testing)
	 * Warning: This creates a copy of all domains which can be memory intensive
	 */
	static getAllDomains(): string[] {
		if (!this.blockedDomains) {
			return [];
		}
		return Array.from(this.blockedDomains).sort();
	}

	/**
	 * Get compilation statistics (if available)
	 */
	static getStats(): any {
		return this.stats;
	}

	/**
	 * Reset the blocklist (for testing purposes)
	 */
	static reset(): void {
		this.blockedDomains = null;
		this.stats = null;
	}
}
