import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq } from 'drizzle-orm';
import { plyordeRequest, resizePlyordeSite } from '$lib/server/plyorde';
import { syncSitesForConnector } from '$lib/server/plyorde-sites';

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id?.trim();
	if (!id) {
		throw error(400, 'Invalid site ID');
	}

	const rows = await db
		.select({
			id: wp_site.id,
			internalId: wp_site.internalId,
			name: wp_site.name,
			description: wp_site.description,
			domain: wp_site.domain,
			docroot: wp_site.docroot,
			diskLimitMb: wp_site.diskLimitMb,
			dbHost: wp_site.dbHost,
			dbName: wp_site.dbName,
			dbUser: wp_site.dbUser,
			dbPassword: wp_site.dbPassword,
			tablePrefix: wp_site.tablePrefix,
			phpVersion: wp_site.phpVersion,
			status: wp_site.status,
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

export const actions: Actions = {
	sync: async ({ params }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { message: 'Invalid site ID' });

		const [site] = await db
			.select({
				id: wp_site.id,
				organizationId: wp_site.organizationId,
				connectorId: wp_site.connectorId
			})
			.from(wp_site)
			.where(eq(wp_site.id, id))
			.limit(1);

		if (!site || !site.connectorId) {
			return fail(404, { message: 'Site connector not found' });
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
			return fail(404, { message: 'Connector not found' });
		}

		try {
			await syncSitesForConnector(conn, site.organizationId);
		} catch (err) {
			console.error('Site sync failed:', err);
			return fail(502, { message: 'Failed to sync site from connector' });
		}

		return { success: true };
	},
	resize: async ({ params, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { message: 'Invalid site ID' });

		const formData = await request.formData();
		const newSizeRaw = String(formData.get('newSize') ?? '').trim();
		const unitType = String(formData.get('unitType') ?? '')
			.trim()
			.toUpperCase();

		const values = {
			newSize: newSizeRaw,
			unitType
		};

		const errors: Record<string, string[]> = {};
		const parsedSize = Number.parseInt(newSizeRaw, 10);
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
			.where(eq(wp_site.id, id))
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
			message: 'Resize requested.'
		};
	},

	delete: async ({ params }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { message: 'Invalid site ID' });

		const [site] = await db
			.select({
				id: wp_site.id,
				internalId: wp_site.internalId,
				connectorId: wp_site.connectorId
			})
			.from(wp_site)
			.where(eq(wp_site.id, id))
			.limit(1);

		if (!site || !site.connectorId) {
			return fail(404, { message: 'Site connector not found' });
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
			return fail(404, { message: 'Connector not found' });
		}

		try {
			await db.delete(wp_site).where(eq(wp_site.id, site.id));
			await plyordeRequest(conn, `/api/sites/${site.internalId}`, { method: 'DELETE' });
		} catch (err) {
			console.error('Plyorde delete failed:', err);
			return fail(502, { message: 'Failed to delete site on connector' });
		}

		await db.delete(wp_site).where(eq(wp_site.id, site.id));
		throw redirect(303, '/admin/sites');
	}
};
