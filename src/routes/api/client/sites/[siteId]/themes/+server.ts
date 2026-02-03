import { error, json, type RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

export const GET: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const ctx = await requireApiKeySiteAccess(request, siteId, { themes: ['read'] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	const { data } = await axios.get(`${base}/api/sites/${ctx.siteId}/themes`, {
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

	const ctx = await requireApiKeySiteAccess(request, siteId, { themes: [action] });
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
			const { data } = await axios.post(`${base}/api/sites/${ctx.siteId}/themes/install`, payload, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		case 'activate': {
			const theme = body?.theme;
			if (!theme) throw error(400, 'Missing theme');
			const { data } = await axios.post(
				`${base}/api/sites/${ctx.siteId}/themes/${encodeURIComponent(theme)}/activate`,
				null,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` } }
			);
			return json(data ?? { ok: true });
		}
		case 'enable': {
			const theme = body?.theme;
			if (!theme) throw error(400, 'Missing theme');
			const { network, activate } = body ?? {};
			const payload = {
				network: network || undefined,
				activate: activate || undefined
			};
			const { data } = await axios.post(
				`${base}/api/sites/${ctx.siteId}/themes/${encodeURIComponent(theme)}/enable`,
				payload,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` } }
			);
			return json(data ?? { ok: true });
		}
		case 'delete': {
			const theme = body?.theme;
			if (!theme) throw error(400, 'Missing theme');
			const { data } = await axios.delete(
				`${base}/api/sites/${ctx.siteId}/themes/${encodeURIComponent(theme)}`,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` } }
			);
			return json(data ?? { ok: true });
		}
		case 'update': {
			const { theme = 'all', exclude, version } = body ?? {};
			const payload = {
				theme,
				exclude: Array.isArray(exclude) && exclude.length ? exclude : undefined,
				version: version || undefined
			};
			const { data } = await axios.post(`${base}/api/sites/${ctx.siteId}/themes/update`, payload, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		default:
			throw error(400, 'Unsupported action');
	}
};
