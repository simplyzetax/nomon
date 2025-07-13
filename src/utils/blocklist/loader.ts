import { Logger } from '../logger';

export class BlocklistLoader {
	private static blockedDomains: Set<string> | null = null;
	private static stats: any = null;

	/**
	 * Load a pre-compiled blocklist (from Vite plugin)
	 */
	static loadCompiledBlocklist(compiledBlocklist: Set<string>): void {
		this.blockedDomains = compiledBlocklist;
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
