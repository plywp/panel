import { error, json, type RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

export const GET: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const ctx = await requireApiKeySiteAccess(request, siteId, { sites: ['health'] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	const { data } = await axios.get(`${base}/api/sites/${ctx.siteId}/health`, {
		headers: { Authorization: `Bearer ${ctx.connectorToken}` },
		timeout: 10_000
	});

	return json(data ?? {});
};
