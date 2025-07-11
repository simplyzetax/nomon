import { DNSBlockingResult, BlockedDomain, DNSQuestion } from '../types/dns.js';
import { Logger } from '../utils/logger.js';

export class DomainChecker {
	private storage: any; // DNSStorage instance

	constructor(storage: any) {
		this.storage = storage;
	}

	/**
	 * Check if a single domain should be blocked
	 */
	async isDomainBlocked(domain: string): Promise<{
		isBlocked: boolean;
		exactMatch: boolean;
		parentDomain?: string;
		reason?: string;
	}> {
		return await this.storage.isInBlocklist(domain);
	}

	/**
	 * Check if multiple domains should be blocked
	 */
	async checkDomains(domains: string[]): Promise<DNSBlockingResult> {
		const result = await this.storage.checkDomains(domains);

		if (result.blocked) {
			Logger.blocked(result.blockedDomains.map((bd: any) => bd.domain));
		}

		return {
			blocked: result.blocked,
			blockedDomains: result.blockedDomains.map((bd: any) => ({
				domain: bd.domain,
				reason: bd.reason,
			})),
		};
	}

	/**
	 * Check DNS questions for blocked domains
	 */
	async checkDNSQuestions(questions: DNSQuestion[]): Promise<DNSBlockingResult> {
		const domains = questions.map((q) => q.name);
		return this.checkDomains(domains);
	}

	/**
	 * Get detailed blocking information for a domain
	 */
	async getBlockingInfo(domain: string): Promise<{
		isBlocked: boolean;
		exactMatch: boolean;
		parentDomain?: string;
		reason?: string;
	}> {
		return await this.storage.isInBlocklist(domain);
	}

	/**
	 * Get statistics about the current blocklist
	 */
	async getStatistics(): Promise<{
		totalBlocked: number;
		isLoaded: boolean;
	}> {
		const stats = await this.storage.getStatistics();
		return {
			totalBlocked: parseInt(stats.blocklist_size || '0'),
			isLoaded: true,
		};
	}

	// Static methods for backward compatibility (will be deprecated)
	/**
	 * @deprecated Use instance methods with DNSStorage instead
	 */
	static isDomainBlocked(domain: string): boolean {
		throw new Error('Static domain checking is deprecated. Use DNSStorage instance methods.');
	}

	/**
	 * @deprecated Use instance methods with DNSStorage instead
	 */
	static checkDomains(domains: string[]): DNSBlockingResult {
		throw new Error('Static domain checking is deprecated. Use DNSStorage instance methods.');
	}

	/**
	 * @deprecated Use instance methods with DNSStorage instead
	 */
	static checkDNSQuestions(questions: DNSQuestion[]): DNSBlockingResult {
		throw new Error('Static domain checking is deprecated. Use DNSStorage instance methods.');
	}

	/**
	 * @deprecated Use instance methods with DNSStorage instead
	 */
	static getBlockingInfo(domain: string): {
		isBlocked: boolean;
		exactMatch: boolean;
		parentDomain?: string;
		reason?: string;
	} {
		throw new Error('Static domain checking is deprecated. Use DNSStorage instance methods.');
	}

	/**
	 * @deprecated Use instance methods with DNSStorage instead
	 */
	static getStatistics(): {
		totalBlocked: number;
		isLoaded: boolean;
	} {
		throw new Error('Static domain checking is deprecated. Use DNSStorage instance methods.');
	}
}
