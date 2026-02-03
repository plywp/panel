import { posix as pathPosix } from 'node:path';

export type ConnectorInfo = {
	id: number;
	fqdn: string;
	token: string;
	daemonSslEnabled: boolean;
	dataDir: string;
};

export type PlyordeSite = {
	ID: string;
	DiskLimitMb: string;
	Domain: string;
	DBHost: string;
	DBName: string;
	DBPassword: string;
	User: string;
	PHPVersion: string;
};

export type PlyordeResizeResponse = {
	current_mb: number;
	requested_mb: number;
	message?: string;
	direction?: string;
	id?: string;
	requested_b?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export function systemUsernameFromId(id: string): string {
	const cleaned = id.replace(/-/g, '');
	return `wp_${cleaned.slice(0, 16)}`;
}

export function docrootForSite(connector: ConnectorInfo, id: string): string {
	const dataDir = connector.dataDir?.trim() || '/var/plyorde';
	const systemId = systemUsernameFromId(id);
	return pathPosix.join(dataDir, systemId, 'public', 'wordpress');
}

export function normalizeConnectorBaseUrl(connector: ConnectorInfo): string {
	const raw = connector.fqdn.trim();
	if (!raw) {
		throw new Error('Connector FQDN is missing');
	}

	const hasScheme = /^https?:\/\//i.test(raw);
	let base = raw;
	if (!hasScheme) {
		const scheme = connector.daemonSslEnabled ? 'https://' : 'http://';
		base = scheme + base;
	}

	let url: URL;
	try {
		url = new URL(base);
	} catch (err) {
		throw new Error('Connector FQDN is invalid');
	}

	if (!hasScheme && !url.port) {
		url.port = '8080';
	}

	const path = url.pathname.replace(/\/+$/, '');
	const suffix = path && path !== '/' ? path : '';
	return `${url.origin}${suffix}`;
}

export async function plyordeRequest<T>(
	connector: ConnectorInfo,
	path: string,
	init: RequestInit = {}
): Promise<T> {
	const url = new URL(path, normalizeConnectorBaseUrl(connector));
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${connector.token}`);

	if (init.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	try {
		const res = await fetch(url, {
			...init,
			headers,
			signal: controller.signal
		});

		const text = await res.text();
		if (!res.ok) {
			throw new Error(`plyorde ${res.status} ${res.statusText}: ${text}`);
		}

		if (!text) {
			return null as T;
		}

		return JSON.parse(text) as T;
	} finally {
		clearTimeout(timeout);
	}
}

export async function listPlyordeSites(connector: ConnectorInfo): Promise<PlyordeSite[]> {
	return plyordeRequest<PlyordeSite[]>(connector, '/api/sites', {
		method: 'GET'
	});
}

export async function resizePlyordeSite(
	connector: ConnectorInfo,
	siteId: string,
	newSize: number,
	unitType: string
): Promise<PlyordeResizeResponse> {
	return plyordeRequest<PlyordeResizeResponse>(connector, `/api/sites/${siteId}/resize`, {
		method: 'POST',
		body: JSON.stringify({ newSize, unitType })
	});
}
