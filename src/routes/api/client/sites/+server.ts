import { error, json, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { parseApiKeyMetadata } from '$lib/server/auth/api-keys';
import { and, eq, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async ({ request }) => {
	const headerKey = request.headers.get('x-api-key')?.trim();
	const authHeader = request.headers.get('authorization')?.trim();
	const bearerKey =
		authHeader && authHeader.toLowerCase().startsWith('bearer ')
			? authHeader.slice(7).trim()
			: null;
	const apiKey = headerKey || bearerKey;
	if (!apiKey) throw error(401, 'Unauthorized');

	const result = await auth.api.verifyApiKey({
		body: {
			key: apiKey,
			permissions: { sites: ['read'] }
		}
	});

	if (!result.valid || !result.key) {
		throw error(401, result.error?.message ?? 'Unauthorized');
	}

	const metadata = parseApiKeyMetadata(result.key.metadata);
	if (!metadata?.orgId || !Array.isArray(metadata.allowedSiteIds)) {
		throw error(403, 'Forbidden');
	}

	const isAllSites = metadata.allowedSiteIds.length === 1 && metadata.allowedSiteIds[0] === '*';
	if (!isAllSites && metadata.allowedSiteIds.length === 0) {
		return json({ orgId: metadata.orgId, sites: [] });
	}
	const sites = await db
		.select({ id: wp_site.id, name: wp_site.name, domain: wp_site.domain })
		.from(wp_site)
		.where(
			isAllSites
				? eq(wp_site.organizationId, metadata.orgId)
				: and(
						eq(wp_site.organizationId, metadata.orgId),
						inArray(wp_site.id, metadata.allowedSiteIds)
					)
		);

	return json({ orgId: metadata.orgId, sites });
};
