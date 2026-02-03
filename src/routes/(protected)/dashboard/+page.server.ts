import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session) {
		throw redirect(302, '/sign-in');
	}

	const organizationId = session.session.activeOrganizationId ?? null;
	if (!organizationId) {
		return { session, sites: [], activeOrganizationId: null };
	}

	const sites = await db
		.select({
			id: wp_site.id,
			name: wp_site.name,
			domain: wp_site.domain,
			diskLimitMb: wp_site.diskLimitMb,
			phpVersion: wp_site.phpVersion,
			status: wp_site.status,
			connectorFqdn: connector.fqdn,
			locationName: location.name,
			locationCountry: location.country
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.leftJoin(location, eq(connector.locationId, location.id))
		.where(eq(wp_site.organizationId, organizationId))
		.orderBy(desc(wp_site.id));

	return { session, sites, activeOrganizationId: organizationId };
};
