import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';
import {
	verifyAdminApiKeyOrThrow,
	verifyOrgApiKeyOrThrow,
	type ApiKeyPermissions
} from './api-keys';

export type ApiSiteContext = {
	siteId: string;
	orgId: string;
	connectorFqdn: string;
	connectorToken: string;
	connectorDaemonSslEnabled: boolean;
};

export async function requireApiKeySiteAccess(
	request: Request,
	siteId: string,
	requiredPermissions: ApiKeyPermissions
): Promise<ApiSiteContext> {
	const rows = await db
		.select({
			id: wp_site.id,
			organizationId: wp_site.organizationId,
			connectorFqdn: connector.fqdn,
			connectorToken: connector.token,
			connectorDaemonSslEnabled: connector.daemonSslEnabled
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.where(eq(wp_site.id, siteId))
		.limit(1);

	const site = rows[0];
	if (!site || !site.connectorFqdn || !site.connectorToken) throw error(404, 'Site not found');

	await verifyOrgApiKeyOrThrow(request, {
		orgId: site.organizationId,
		requiredPermissions,
		targetSiteId: site.id
	});

	return {
		siteId: site.id,
		orgId: site.organizationId,
		connectorFqdn: site.connectorFqdn,
		connectorToken: site.connectorToken,
		connectorDaemonSslEnabled: Boolean(site.connectorDaemonSslEnabled)
	};
}

export async function requireAdminApiKeySiteAccess(
	request: Request,
	siteId: string,
	requiredPermissions: ApiKeyPermissions
): Promise<ApiSiteContext> {
	const rows = await db
		.select({
			id: wp_site.id,
			organizationId: wp_site.organizationId,
			connectorFqdn: connector.fqdn,
			connectorToken: connector.token,
			connectorDaemonSslEnabled: connector.daemonSslEnabled
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.where(eq(wp_site.id, siteId))
		.limit(1);

	const site = rows[0];
	if (!site || !site.connectorFqdn || !site.connectorToken) throw error(404, 'Site not found');

	await verifyAdminApiKeyOrThrow(request, { requiredPermissions });

	return {
		siteId: site.id,
		orgId: site.organizationId,
		connectorFqdn: site.connectorFqdn,
		connectorToken: site.connectorToken,
		connectorDaemonSslEnabled: Boolean(site.connectorDaemonSslEnabled)
	};
}
