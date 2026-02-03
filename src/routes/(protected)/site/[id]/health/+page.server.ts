import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq } from 'drizzle-orm';
import axios from 'axios';

type SiteFrontend = {
	id: string;
	name: string;
	domain: string;
	connectorId: string | null;
	connectorFqdn: string | null;
	connectorDaemonSslEnabled: boolean | null;
	locationName: string | null;
	locationCountry: string | null;
};

type SiteInternal = SiteFrontend & {
	connectorToken: string;
};

async function getSiteInternal(id: string): Promise<SiteInternal> {
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
	if (!site || !site.connectorFqdn || !site.connectorToken) {
		throw error(404, 'Site not found');
	}

	return site;
}

function normalizeConnectorBase(fqdn: string) {
	return fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;
}

async function getSiteFrontend(id: string): Promise<SiteFrontend> {
	const site = await getSiteInternal(id);
	const { connectorToken, ...safe } = site;
	return safe;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid site ID');

	const site = await getSiteFrontend(id);
	return { site };
};

export const actions: Actions = {
	health: async ({ params }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { type: 'failure', message: 'Invalid site ID' });

		try {
			const site = await getSiteInternal(id);
			const base = normalizeConnectorBase(site.connectorFqdn);

			const { data } = await axios.get(`${base}/api/sites/${site.id}/health`, {
				headers: {
					Authorization: `Bearer ${site.connectorToken}`
				},
				timeout: 10_000
			});

			return data;
		} catch (error) {
			console.log(error);
			return fail(500, { type: 'failure', message: 'Health check failed' });
		}
	},
	installStatus: async ({ params }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { type: 'failure', message: 'Invalid site ID' });

		try {
			const site = await getSiteInternal(id);
			const base = normalizeConnectorBase(site.connectorFqdn);

			const { data } = await axios.get(`${base}/api/sites/${site.id}/status`, {
				headers: {
					Authorization: `Bearer ${site.connectorToken}`
				},
				timeout: 10_000
			});

			return data;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.status === 404) {
				return null;
			}
			console.log(error);
			return fail(500, { type: 'failure', message: 'Install status check failed' });
		}
	}
};
