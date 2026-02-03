import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq } from 'drizzle-orm';

export type SiteFrontend = {
	id: string;
	name: string;
	domain: string;
	connectorId: string | null;
	connectorFqdn: string | null;
	connectorDaemonSslEnabled: boolean | null;
	locationName: string | null;
	locationCountry: string | null;
	adminUsername: string;
};

export type SiteInternal = SiteFrontend & {
	connectorToken: string;
};

export function requireAuth(locals: App.Locals) {
	const session = locals.session;
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	return session;
}

export function normalizeConnectorBase(fqdn: string) {
	return fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;
}

export async function getSiteInternal(siteId: string): Promise<SiteInternal> {
	const rows = await db
		.select({
			id: wp_site.id,
			name: wp_site.name,
			domain: wp_site.domain,
			adminUsername: wp_site.adminUsername,
			connectorId: wp_site.connectorId,
			connectorFqdn: connector.fqdn,
			connectorToken: connector.token,
			connectorDaemonSslEnabled: connector.daemonSslEnabled,
			locationName: location.name,
			locationCountry: location.country
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.leftJoin(location, eq(connector.locationId, location.id))
		.where(eq(wp_site.id, siteId))
		.limit(1);

	const site = rows[0];
	if (!site || !site.connectorFqdn || !site.connectorToken) throw error(404, 'Site not found');

	return site;
}

export async function getSiteFrontend(siteId: string): Promise<SiteFrontend> {
	const { connectorToken: _t, ...safe } = await getSiteInternal(siteId);
	return safe;
}

/**
 * Main helper: ensures auth, validates params.id, loads site+connector token,
 * returns ready-to-use connector base URL + auth header token.
 */
export async function requireSiteCtx(params: { id?: string }, locals: App.Locals) {
	requireAuth(locals);

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid site ID');

	const site = await getSiteInternal(id);
	const base = normalizeConnectorBase(site.connectorFqdn!);

	return {
		siteId: id,
		site,
		base,
		connectorToken: site.connectorToken
	};
}
