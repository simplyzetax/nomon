import { DNSBlockingResult, BlockedDomain, DNSQuestion } from '../types/dns.js';
import { BlocklistLoader } from './loader.js';
import { Logger } from '../utils/logger.js';

export class DomainChecker {
	/**
	 * Check if a single domain should be blocked
	 */
	static isDomainBlocked(domain: string): boolean {
		const normalizedDomain = domain.toLowerCase();
		const blocklist = BlocklistLoader.getBlocklist();

		// Check exact match
		if (blocklist.has(normalizedDomain)) {
			return true;
		}

		// Check if any parent domain is blocked (for subdomains)
		const parts = normalizedDomain.split('.');
		for (let i = 1; i < parts.length; i++) {
			const parentDomain = parts.slice(i).join('.');
			if (blocklist.has(parentDomain)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if multiple domains should be blocked
	 */
	static checkDomains(domains: string[]): DNSBlockingResult {
		const blockedDomains: BlockedDomain[] = [];

		for (const domain of domains) {
			if (this.isDomainBlocked(domain)) {
				blockedDomains.push({
					domain,
					reason: 'Listed in Pi-hole blocklist',
				});
			}
		}

		if (blockedDomains.length > 0) {
			Logger.blocked(blockedDomains.map((bd) => bd.domain));
		}

		return {
			blocked: blockedDomains.length > 0,
			blockedDomains,
		};
	}

	/**
	 * Check DNS questions for blocked domains
	 */
	static checkDNSQuestions(questions: DNSQuestion[]): DNSBlockingResult {
		const domains = questions.map((q) => q.name);
		return this.checkDomains(domains);
	}

	/**
	 * Get detailed blocking information for a domain
	 */
	static getBlockingInfo(domain: string): {
		isBlocked: boolean;
		exactMatch: boolean;
		parentDomain?: string;
		reason?: string;
	} {
		const normalizedDomain = domain.toLowerCase();
		const blocklist = BlocklistLoader.getBlocklist();

		// Check exact match first
		if (blocklist.has(normalizedDomain)) {
			return {
				isBlocked: true,
				exactMatch: true,
				reason: 'Domain exactly matches blocklist entry',
			};
		}

		// Check parent domains
		const parts = normalizedDomain.split('.');
		for (let i = 1; i < parts.length; i++) {
			const parentDomain = parts.slice(i).join('.');
			if (blocklist.has(parentDomain)) {
				return {
					isBlocked: true,
					exactMatch: false,
					parentDomain,
					reason: `Subdomain of blocked domain: ${parentDomain}`,
				};
			}
		}

		return {
			isBlocked: false,
			exactMatch: false,
		};
	}

	/**
	 * Get statistics about the current blocklist
	 */
	static getStatistics(): {
		totalBlocked: number;
		isLoaded: boolean;
	} {
		return {
			totalBlocked: BlocklistLoader.getBlocklistSize(),
			isLoaded: BlocklistLoader.isLoaded(),
		};
	}
}
