import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import type { ConnectorInfo, PlyordeSite } from './plyorde';
import { docrootForSite, listPlyordeSites } from './plyorde';

const DEFAULT_TABLE_PREFIX = 'wp_';
const DEFAULT_STATUS_ACTIVE = 'active';

function parseDiskLimit(value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		return 1024;
	}
	return parsed;
}

function normalizePhpVersion(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export async function syncSitesForConnector(
	connector: ConnectorInfo,
	organizationId: string
): Promise<number> {
	const sites = await listPlyordeSites(connector);
	if (!sites.length) return 0;

	for (const site of sites) {
		await upsertSiteFromPlyorde(site, connector, organizationId);
	}

	return sites.length;
}

export async function upsertSiteFromPlyorde(
	site: PlyordeSite,
	connector: ConnectorInfo,
	organizationId: string
): Promise<void> {
	const internalId = site.ID;

	await db
		.insert(wp_site)
		.values({
			id: internalId,
			organizationId,
			internalId,
			name: site.Domain,
			description: null,
			domain: site.Domain,
			docroot: docrootForSite(connector, internalId),
			diskLimitMb: parseDiskLimit(site.DiskLimitMb),
			dbHost: site.DBHost,
			dbName: site.DBName,
			dbUser: site.User,
			dbPassword: site.DBPassword,
			tablePrefix: DEFAULT_TABLE_PREFIX,
			connectorId: connector.id,
			phpVersion: normalizePhpVersion(site.PHPVersion),
			status: DEFAULT_STATUS_ACTIVE
		})
		.onDuplicateKeyUpdate({
			set: {
				internalId,
				domain: site.Domain,
				docroot: docrootForSite(connector, internalId),
				diskLimitMb: parseDiskLimit(site.DiskLimitMb),
				dbHost: site.DBHost,
				dbName: site.DBName,
				dbUser: site.User,
				dbPassword: site.DBPassword,
				tablePrefix: DEFAULT_TABLE_PREFIX,
				connectorId: connector.id,
				phpVersion: normalizePhpVersion(site.PHPVersion),
				status: DEFAULT_STATUS_ACTIVE
			}
		});
}
