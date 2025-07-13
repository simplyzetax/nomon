import dnsPacket from 'dns-packet';
import { ParsedDNSQuery, ParsedDNSResponse, DNSQuestion } from '../../types/dns';
import { Logger } from '../logger';

export class DNSParser {
	/**
	 * Parse a base64-encoded DNS query
	 */
	static parseBase64Query(base64Query: string): ParsedDNSQuery {
		const dnsBuffer = Buffer.from(base64Query, 'base64url');
		const parsed = dnsPacket.decode(dnsBuffer);

		return {
			id: parsed.id || 0,
			type: parsed.type || 'query',
			questions:
				parsed.questions?.map((q) => ({
					name: q.name,
					type: q.type,
					class: q.class || 'IN',
				})) || [],
		};
	}

	/**
	 * Parse a raw DNS query from buffer
	 */
	static parseRawQuery(buffer: Buffer): ParsedDNSQuery {
		const parsed = dnsPacket.decode(buffer);

		return {
			id: parsed.id || 0,
			type: parsed.type || 'query',
			questions:
				parsed.questions?.map((q) => ({
					name: q.name,
					type: q.type,
					class: q.class || 'IN',
				})) || [],
		};
	}

	/**
	 * Parse a DNS response from buffer
	 */
	static parseResponse(buffer: Buffer): ParsedDNSResponse {
		const parsed = dnsPacket.decode(buffer);

		return {
			id: parsed.id || 0,
			type: parsed.type || 'response',
			answers: parsed.answers?.map((a) => ({
				name: a.name,
				type: a.type,
				...(a as any), // Use type assertion to access all properties
			})),
		};
	}

	/**
	 * Extract domain names from DNS questions
	 */
	static extractDomains(questions: DNSQuestion[]): string[] {
		return questions.map((q) => q.name.toLowerCase());
	}
}
