import { error, json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { eq } from 'drizzle-orm';
import { verifyOrgApiKeyOrThrow } from '$lib/server/auth/api-keys';

export const POST: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const site = await db.query.wp_site.findFirst({ where: eq(wp_site.id, siteId) });
	if (!site) throw error(404, 'Site not found');

	await verifyOrgApiKeyOrThrow(request, {
		orgId: site.organizationId,
		requiredPermissions: { sites: ['credentials'] },
		targetSiteId: siteId
	});

	return json({ adminUsername: site.adminUsername, adminPassword: site.adminPassword });
};
