import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { and, desc, eq } from 'drizzle-orm';
import { syncSitesForConnector } from '$lib/server/plyorde-sites';
import { resizePlyordeSite } from '$lib/server/plyorde';

export const load: PageServerLoad = async ({ locals }) => {
	const organizationId = locals.session?.session.activeOrganizationId ?? null;

	if (!organizationId) {
		return { sites: [], activeOrganizationId: null };
	}

	const sites = await db
		.select({
			id: wp_site.id,
			name: wp_site.name,
			domain: wp_site.domain,
			diskLimitMb: wp_site.diskLimitMb,
			phpVersion: wp_site.phpVersion,
			status: wp_site.status,
			connectorId: wp_site.connectorId,
			connectorFqdn: connector.fqdn,
			locationName: location.name,
			locationCountry: location.country
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.leftJoin(location, eq(connector.locationId, location.id))
		.where(eq(wp_site.organizationId, organizationId))
		.orderBy(desc(wp_site.id));

	return { sites, activeOrganizationId: organizationId };
};

export const actions: Actions = {
	sync: async ({ locals }) => {
		const organizationId = locals.session?.session.activeOrganizationId;
		if (!organizationId) {
			return fail(400, { message: 'No active organization selected' });
		}

		const connectors = await db
			.select({
				id: connector.id,
				fqdn: connector.fqdn,
				token: connector.token,
				daemonSslEnabled: connector.daemonSslEnabled,
				dataDir: connector.dataDir
			})
			.from(connector);

		try {
			await Promise.all(connectors.map((conn) => syncSitesForConnector(conn, organizationId)));
		} catch (err) {
			console.error('Sync failed:', err);
			return fail(502, { message: 'Failed to sync sites from connectors' });
		}

		return { success: true };
	},
	resize: async ({ locals, request }) => {
		const organizationId = locals.session?.session.activeOrganizationId;
		if (!organizationId) {
			return fail(400, { message: 'No active organization selected' });
		}

		const formData = await request.formData();
		const siteId = String(formData.get('siteId') ?? '').trim();
		const newSizeRaw = String(formData.get('newSize') ?? '').trim();
		const unitType = String(formData.get('unitType') ?? '')
			.trim()
			.toUpperCase();

		const values = {
			siteId,
			newSize: newSizeRaw,
			unitType
		};

		const errors: Record<string, string[]> = {};
		const parsedSize = Number.parseInt(newSizeRaw, 10);
		if (!siteId) errors.siteId = ['Missing site'];
		if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
			errors.newSize = ['Enter a size greater than 0'];
		}
		if (!unitType || !['M', 'G', 'T'].includes(unitType)) {
			errors.unitType = ['Select a valid unit'];
		}

		if (Object.keys(errors).length) {
			return fail(400, { message: 'Invalid resize request', errors, values });
		}

		const [site] = await db
			.select({
				id: wp_site.id,
				internalId: wp_site.internalId,
				connectorId: wp_site.connectorId
			})
			.from(wp_site)
			.where(and(eq(wp_site.id, siteId), eq(wp_site.organizationId, organizationId)))
			.limit(1);

		if (!site || !site.connectorId) {
			return fail(404, { message: 'Site connector not found', values });
		}

		const [conn] = await db
			.select({
				id: connector.id,
				fqdn: connector.fqdn,
				token: connector.token,
				daemonSslEnabled: connector.daemonSslEnabled,
				dataDir: connector.dataDir
			})
			.from(connector)
			.where(eq(connector.id, site.connectorId))
			.limit(1);

		if (!conn) {
			return fail(404, { message: 'Connector not found', values });
		}

		try {
			const response = await resizePlyordeSite(conn, site.internalId, parsedSize, unitType);
			if (response?.requested_mb) {
				await db
					.update(wp_site)
					.set({ diskLimitMb: response.requested_mb })
					.where(eq(wp_site.id, site.id));
			}
		} catch (err) {
			console.error('Resize failed:', err);
			return fail(502, { message: 'Failed to resize site on connector', values });
		}

		return {
			success: true,
			message: 'Resize requested.',
			siteId
		};
	}
};
