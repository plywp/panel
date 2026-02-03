import { error, json, type RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

export const GET: RequestHandler = async ({ params, request, url }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const ctx = await requireApiKeySiteAccess(request, siteId, { plugins: ['read'] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);
	const status = url.searchParams.get('status') ?? 'active';

	const { data } = await axios.get(`${base}/api/sites/${ctx.siteId}/plugins`, {
		params: { status },
		headers: { Authorization: `Bearer ${ctx.connectorToken}` },
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

	const ctx = await requireApiKeySiteAccess(request, siteId, { plugins: [action] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	switch (action) {
		case 'install': {
			const { source, version, activate, force } = body ?? {};
			if (!source) throw error(400, 'Missing source');
			const payload = {
				source,
				activate: activate || undefined,
				force: force || undefined,
				version: version || undefined
			};
			const { data } = await axios.post(`${base}/api/sites/${ctx.siteId}/plugins/install`, payload, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		case 'activate':
		case 'deactivate': {
			const plugin = body?.plugin;
			if (!plugin) throw error(400, 'Missing plugin');
			const endpoint = `${base}/api/sites/${ctx.siteId}/plugins/${encodeURIComponent(plugin)}/${action}`;
			const { data } = await axios.post(endpoint, null, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		case 'delete': {
			const plugin = body?.plugin;
			if (!plugin) throw error(400, 'Missing plugin');
			const { data } = await axios.delete(
				`${base}/api/sites/${ctx.siteId}/plugins/${encodeURIComponent(plugin)}`,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` } }
			);
			return json(data ?? { ok: true });
		}
		case 'update': {
			const { plugin = 'all', exclude, version } = body ?? {};
			const payload = {
				plugin,
				exclude: Array.isArray(exclude) && exclude.length ? exclude : undefined,
				version: version || undefined
			};
			const { data } = await axios.post(`${base}/api/sites/${ctx.siteId}/plugins/update`, payload, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		default:
			throw error(400, 'Unsupported action');
	}
};
