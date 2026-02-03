import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';
import { plyordeRequest } from '$lib/server/plyorde';

const updateSchema = z.object({
	name: z.string().min(2).max(191).optional(),
	description: z.string().optional().or(z.literal('')),
	domain: z.string().min(3).max(255).optional(),
	phpVersion: z.string().optional().or(z.literal('')),
	status: z.string().optional()
});

export const GET: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	await verifyAdminApiKeyOrThrow(request, {
		requiredPermissions: { sites: ['read'] }
	});

	const site = await db.query.wp_site.findFirst({ where: eq(wp_site.id, siteId) });
	if (!site) throw error(404, 'Site not found');

	const { adminPassword, dbPassword, connectorId, adminEmail, adminUsername, ...safe } = site;
	return json({ site: safe });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	await verifyAdminApiKeyOrThrow(request, {
		requiredPermissions: { sites: ['update'] }
	});

	const body = await request.json().catch(() => ({}));
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid site payload');

	const updates: Record<string, unknown> = {};
	if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
	if (parsed.data.description !== undefined)
		updates.description = parsed.data.description ? parsed.data.description.trim() : null;
	if (parsed.data.domain !== undefined) updates.domain = parsed.data.domain.trim();
	if (parsed.data.phpVersion !== undefined)
		updates.phpVersion = parsed.data.phpVersion ? parsed.data.phpVersion.trim() : null;
	if (parsed.data.status !== undefined) updates.status = parsed.data.status;

	if (!Object.keys(updates).length) return json({ ok: true });

	await db.update(wp_site).set(updates).where(eq(wp_site.id, siteId));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	await verifyAdminApiKeyOrThrow(request, {
		requiredPermissions: { sites: ['delete'] }
	});

	const [site] = await db
		.select({
			id: wp_site.id,
			internalId: wp_site.internalId,
			connectorId: wp_site.connectorId
		})
		.from(wp_site)
		.where(eq(wp_site.id, siteId))
		.limit(1);

	if (!site || !site.connectorId) throw error(404, 'Site connector not found');

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

	if (!conn) throw error(404, 'Connector not found');

	try {
		await plyordeRequest(conn, `/api/sites/${site.internalId}`, { method: 'DELETE' });
	} catch (err) {
		console.error('Plyorde delete failed:', err);
		throw error(502, 'Failed to delete site on connector');
	}

	await db.delete(wp_site).where(eq(wp_site.id, site.id));
	return json({ ok: true });
};
