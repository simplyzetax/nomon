export class Logger {
	static log(message: string, data?: any) {
		if (data) {
			console.log(`[DoH-Proxy] ${message}`, data);
		} else {
			console.log(`[DoH-Proxy] ${message}`);
		}
	}

	static error(message: string, error?: any) {
		if (error) {
			console.error(`[DoH-Proxy] ERROR: ${message}`, error);
		} else {
			console.error(`[DoH-Proxy] ERROR: ${message}`);
		}
	}

	static warn(message: string, data?: any) {
		if (data) {
			console.warn(`[DoH-Proxy] WARN: ${message}`, data);
		} else {
			console.warn(`[DoH-Proxy] WARN: ${message}`);
		}
	}

	static debug(message: string, data?: any) {
		if (data) {
			console.debug(`[DoH-Proxy] DEBUG: ${message}`, data);
		} else {
			console.debug(`[DoH-Proxy] DEBUG: ${message}`);
		}
	}

	static blocked(domains: string[]) {
		console.log(`[DoH-Proxy] BLOCKED: ${domains.join(', ')}`);
	}
}
