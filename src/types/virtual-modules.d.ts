declare module 'virtual:compiled-blocklist' {
	export const COMPILED_BLOCKLIST: Set<string>;
	export const BLOCKLIST_STATS: {
		totalDomains: number;
		compilationTime: number;
		sourceFile: string;
		compiledAt: string;
	};
	export function isCompiledDomainBlocked(domain: string): boolean;
	export function getBlocklistSize(): number;
	const _default: Set<string>;
	export default _default;
}
