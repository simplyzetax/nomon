import { LOCALHOST_DOMAINS } from '../utils/constants.js';
import { Logger } from '../utils/logger.js';

export class BlocklistLoader {
	private static blockedDomains = new Set<string>();

	/**
	 * Parse and load the blocklist from hosts file content
	 */
	static loadBlocklist(content: string): void {
		this.blockedDomains.clear();

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
				if (!LOCALHOST_DOMAINS.includes(domain as any)) {
					this.blockedDomains.add(domain);
				}
			}
		}

		Logger.log(`Loaded ${this.blockedDomains.size} blocked domains`);
	}

	/**
	 * Get the current blocklist as a Set
	 */
	static getBlocklist(): Set<string> {
		return this.blockedDomains;
	}

	/**
	 * Get the number of blocked domains
	 */
	static getBlocklistSize(): number {
		return this.blockedDomains.size;
	}

	/**
	 * Check if the blocklist has been loaded
	 */
	static isLoaded(): boolean {
		return this.blockedDomains.size > 0;
	}

	/**
	 * Add a domain to the blocklist manually
	 */
	static addDomain(domain: string): void {
		this.blockedDomains.add(domain.toLowerCase());
	}

	/**
	 * Remove a domain from the blocklist manually
	 */
	static removeDomain(domain: string): boolean {
		return this.blockedDomains.delete(domain.toLowerCase());
	}

	/**
	 * Get all blocked domains as an array (for debugging/testing)
	 */
	static getAllDomains(): string[] {
		return Array.from(this.blockedDomains).sort();
	}
}
