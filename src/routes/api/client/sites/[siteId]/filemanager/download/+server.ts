import { error, type RequestHandler } from '@sveltejs/kit';
import axios, { AxiosError } from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizePath = (input: string): string => {
	const p = (input ?? '').trim().replace(/\\/g, '/');
	const cleaned = p.replace(/^\/+|\/+$/g, '');
	if (!cleaned) return '';
	if (cleaned.includes('..')) throw error(400, 'Invalid path');
	return cleaned;
};

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

export const GET: RequestHandler = async ({ params, request, url, setHeaders }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const rawPath = url.searchParams.get('path') ?? '';
	const relPath = normalizePath(rawPath);
	const filename = (url.searchParams.get('filename') ?? '').trim();

	const ctx = await requireApiKeySiteAccess(request, siteId, { filemanager: ['download'] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	const upstream =
		`${base}/api/filemanager/${encodeURIComponent(ctx.siteId)}/download` +
		`?path=${encodeURIComponent(relPath || '/')}` +
		(filename ? `&filename=${encodeURIComponent(filename)}` : '');

	try {
		const upstreamRes = await axios.get(upstream, {
			headers: { Authorization: `Bearer ${ctx.connectorToken}` },
			responseType: 'stream',
			timeout: 0
		});

		setHeaders({
			'cache-control': 'no-store',
			pragma: 'no-cache',
			'x-content-type-options': 'nosniff'
		});

		const h = upstreamRes.headers ?? {};
		const headers = new Headers();
		if (h['content-type']) headers.set('content-type', String(h['content-type']));
		if (h['content-length']) headers.set('content-length', String(h['content-length']));
		if (h['content-disposition']) headers.set('content-disposition', String(h['content-disposition']));
		if (h['accept-ranges']) headers.set('accept-ranges', String(h['accept-ranges']));
		if (h['content-range']) headers.set('content-range', String(h['content-range']));
		headers.set('x-accel-buffering', 'no');
		headers.set('cache-control', 'no-store');

		return new Response(upstreamRes.data as any, {
			status: upstreamRes.status,
			headers
		});
	} catch (err) {
		const e = err as AxiosError<any>;
		const status = e.response?.status ?? 502;
		const msg = e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';
		throw error(status, String(msg));
	}
};
