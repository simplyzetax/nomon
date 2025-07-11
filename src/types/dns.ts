export interface DNSQuestion {
	name: string;
	type: string;
	class: string;
}

export interface DNSAnswer {
	name: string;
	type: string;
	class?: string;
	ttl: number;
	data: string | null;
}

export interface DNSPacket {
	id: number;
	type: 'query' | 'response';
	flags?: number;
	questions?: DNSQuestion[];
	answers?: DNSAnswer[];
}

export interface ParsedDNSQuery {
	id: number;
	type: string;
	questions: DNSQuestion[];
}

export interface ParsedDNSResponse {
	id: number;
	type: string;
	answers?: DNSAnswer[];
}

export interface BlockedDomain {
	domain: string;
	reason: string;
}

export interface DNSBlockingResult {
	blocked: boolean;
	blockedDomains: BlockedDomain[];
}

export interface DNSResponseOptions {
	contentType: string;
	cacheControl?: string;
	status?: number;
}
