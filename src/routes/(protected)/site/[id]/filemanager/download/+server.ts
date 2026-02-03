import { error, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';
import axios, { AxiosError } from 'axios';

type SessionBundle = NonNullable<App.Locals['session']>;

type SiteConnectorRow = {
	id: string;
	organizationId: string;
	connectorFqdn: string | null;
	connectorToken: string | null;
	connectorDaemonSslEnabled: boolean;
};

function requireSession(locals: App.Locals): SessionBundle {
	const session = locals.session;
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	return session;
}

function canAccessSite(session: SessionBundle, siteOrgId: string): boolean {
	if (session.user.role === 'admin') return true;
	return session.session.activeOrganizationId === siteOrgId;
}

function normalizePath(input: string): string {
	const p = (input ?? '').trim().replace(/\\/g, '/');
	const cleaned = p.replace(/^\/+|\/+$/g, '');
	if (!cleaned) return '';
	if (cleaned.includes('..')) throw error(400, 'Invalid path');

	return cleaned;
}

async function getSiteConnector(locals: App.Locals, siteId: string): Promise<SiteConnectorRow> {
	const session = requireSession(locals);

	const rows = await db
		.select({
			id: wp_site.id,
			organizationId: wp_site.organizationId,
			connectorFqdn: connector.fqdn,
			connectorToken: connector.token,
			connectorDaemonSslEnabled: connector.daemonSslEnabled
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.where(eq(wp_site.id, siteId))
		.limit(1);

	const site = rows[0];
	if (!site) throw error(404, 'Site not found');
	if (!canAccessSite(session, site.organizationId)) throw error(403, 'Forbidden');

	if (!site.connectorFqdn || !site.connectorToken) {
		throw error(500, 'Missing connector information');
	}

	return site;
}

export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	const siteId = params.id?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const rawPath = url.searchParams.get('path') ?? '';
	const relPath = normalizePath(rawPath);
	const filename = (url.searchParams.get('filename') ?? '').trim();

	const site = await getSiteConnector(locals, siteId);
	const base = site.connectorFqdn;

	const upstream =
		`${base}/api/filemanager/${encodeURIComponent(site.id)}/download` +
		`?path=${encodeURIComponent(relPath || '/')}` +
		(filename ? `&filename=${encodeURIComponent(filename)}` : '');

	try {
		const upstreamRes = await axios.get(upstream, {
			headers: {
				Authorization: `Bearer ${site.connectorToken}`
			},
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
		if (h['content-disposition'])
			headers.set('content-disposition', String(h['content-disposition']));

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
