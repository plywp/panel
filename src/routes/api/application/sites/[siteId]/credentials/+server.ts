import { error, json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { eq } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

export const GET: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	await verifyAdminApiKeyOrThrow(request, {
		requiredPermissions: { sites: ['credentials'] }
	});

	const site = await db.query.wp_site.findFirst({ where: eq(wp_site.id, siteId) });
	if (!site) throw error(404, 'Site not found');

	return json({ adminUsername: site.adminUsername, adminPassword: site.adminPassword });
};
