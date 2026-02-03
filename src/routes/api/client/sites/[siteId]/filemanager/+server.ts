import { error, json, type RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

const normalizePath = (input: string) => {
	const p = (input ?? '').trim().replace(/\\/g, '/');
	const cleaned = p.replace(/^\/+|\/+$/g, '');
	if (cleaned.includes('..')) throw error(400, 'Invalid path');
	return cleaned;
};

export const GET: RequestHandler = async ({ params, request, url }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const path = normalizePath(url.searchParams.get('path') ?? '');
	const ctx = await requireApiKeySiteAccess(request, siteId, { filemanager: ['read'] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	const { data } = await axios.get(`${base}/api/filemanager/${ctx.siteId}/list`, {
		params: { path: path || '/' },
		headers: { Authorization: `Bearer ${ctx.connectorToken}`, Accept: 'application/json' },
		timeout: 10_000
	});

	return json(data ?? {});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const body = await request.json();
	const action = String(body?.action ?? '').trim();
	if (!action) throw error(400, 'Missing action');

	const permissionAction = action === 'createFile' || action === 'createFolder' ? 'write' : action;
	const ctx = await requireApiKeySiteAccess(request, siteId, { filemanager: [permissionAction] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	switch (action) {
		case 'read': {
			const path = normalizePath(String(body?.path ?? ''));
			const { data } = await axios.get(
				`${base}/api/filemanager/${ctx.siteId}/read?path=${encodeURIComponent(path || '/')}`,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? {});
		}
		case 'write': {
			const path = normalizePath(String(body?.path ?? ''));
			const content = String(body?.content ?? '');
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/write?path=${encodeURIComponent(path)}`,
				content,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'createFile': {
			const path = normalizePath(String(body?.path ?? ''));
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/write?path=${encodeURIComponent(path)}`,
				'',
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'createFolder': {
			const path = normalizePath(String(body?.path ?? ''));
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/mkdir`,
				{ path },
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'rename': {
			const from = normalizePath(String(body?.from ?? ''));
			const to = normalizePath(String(body?.to ?? ''));
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/move`,
				{ from, to },
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'move': {
			const from = normalizePath(String(body?.from ?? ''));
			const to = normalizePath(String(body?.to ?? ''));
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/move`,
				{ from, to },
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'copy': {
			const sources = Array.isArray(body?.sources) ? body.sources : [];
			const target = normalizePath(String(body?.target ?? ''));
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/copy`,
				{ sources, target },
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'delete': {
			const paths = Array.isArray(body?.paths) ? body.paths : [];
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/delete`,
				{ paths },
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 10_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'archive': {
			const sources = Array.isArray(body?.sources) ? body.sources : [];
			const target = normalizePath(String(body?.target ?? ''));
			const format = body?.format;
			const payload: { sources: string[]; target: string; format?: string } = { sources, target };
			if (format) payload.format = format;
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/compress`,
				payload,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 60_000 }
			);
			return json(data ?? { ok: true });
		}
		case 'extract': {
			const source = normalizePath(String(body?.source ?? ''));
			const target = normalizePath(String(body?.target ?? ''));
			const format = body?.format;
			const payload: { source: string; target: string; format?: string } = { source, target };
			if (format) payload.format = format;
			const { data } = await axios.post(
				`${base}/api/filemanager/${ctx.siteId}/decompress`,
				payload,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` }, timeout: 60_000 }
			);
			return json(data ?? { ok: true });
		}
		default:
			throw error(400, 'Unsupported action');
	}
};
