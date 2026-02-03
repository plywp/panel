import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id?.trim();
	if (!id) {
		throw error(400, 'Invalid site ID');
	}

	const rows = await db
		.select({
			id: wp_site.id,
			name: wp_site.name,
			domain: wp_site.domain,
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
		.where(eq(wp_site.id, id))
		.limit(1);

	const site = rows[0];
	if (!site) {
		throw error(404, 'Site not found');
	}

	return { site };
};
