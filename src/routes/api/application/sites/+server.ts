import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { organization, wp_site } from '$lib/server/db/schema/auth-schema';
import { eq } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';
import { docrootForSite, plyordeRequest, systemUsernameFromId } from '$lib/server/plyorde';

const createSchema = z.object({
	organizationId: z.string().min(1),
	connectorId: z.coerce.number().int().positive(),
	name: z.string().min(2).max(191),
	description: z.string().optional().or(z.literal('')),
	domain: z.string().min(3).max(255),
	diskLimitMb: z.coerce.number().int().min(40),
	phpVersion: z.string().optional().or(z.literal('')),
	adminUser: z.string().min(1).max(64),
	adminPass: z.string().min(8).max(255),
	adminEmail: z.string().email()
});

function sanitizeDbNamePart(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function buildDbNameSuffix(domain: string, name: string): string {
	const domainBase = sanitizeDbNamePart(domain.split('/')[0] ?? '');
	const nameBase = sanitizeDbNamePart(name);
	let base = domainBase || nameBase || 'site';

	if (!/^[a-z]/.test(base)) {
		base = `site_${base}`;
	}

	base = base.replace(/^_+|_+$/g, '');
	if (!base) {
		base = 'site';
	}

	const suffix = randomBytes(2).toString('hex');
	const maxBase = 24;
	const trimmed = base.slice(0, maxBase).replace(/_+$/g, '');
	return `${trimmed || 'site'}_${suffix}`;
}

export const GET: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, {
		requiredPermissions: { sites: ['read'] }
	});

	const sites = await db
		.select({
			id: wp_site.id,
			name: wp_site.name,
			domain: wp_site.domain,
			organizationId: wp_site.organizationId,
			status: wp_site.status,
			phpVersion: wp_site.phpVersion,
			diskLimitMb: wp_site.diskLimitMb
		})
		.from(wp_site);

	return json({ sites });
};

export const POST: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, {
		requiredPermissions: { sites: ['create'] }
	});

	const body = await request.json().catch(() => ({}));
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid site payload');

	const organizationId = parsed.data.organizationId.trim();
	const orgExists = await db
		.select({ id: organization.id })
		.from(organization)
		.where(eq(organization.id, organizationId))
		.limit(1);

	if (!orgExists.length) throw error(404, 'Organization not found');

	const [conn] = await db
		.select({
			id: connector.id,
			fqdn: connector.fqdn,
			token: connector.token,
			daemonSslEnabled: connector.daemonSslEnabled,
			dataDir: connector.dataDir
		})
		.from(connector)
		.where(eq(connector.id, parsed.data.connectorId))
		.limit(1);

	if (!conn) throw error(404, 'Connector not found');

	const domain = parsed.data.domain.trim();
	const name = parsed.data.name.trim();
	const dbNameSuffix = buildDbNameSuffix(domain, name);
	const payload: Record<string, unknown> = {
		disk_limit_mb: parsed.data.diskLimitMb,
		domain_name: domain,
		db_name: dbNameSuffix,
		site_title: name,
		admin_user: parsed.data.adminUser.trim(),
		admin_pass: parsed.data.adminPass,
		admin_email: parsed.data.adminEmail.trim()
	};

	const phpVersion = parsed.data.phpVersion?.trim();
	if (phpVersion) {
		payload.php_version = phpVersion;
	}

	let result: { id: string; status: string };
	try {
		result = await plyordeRequest(conn, '/api/sites', {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	} catch (err) {
		console.error('Plyorde create failed:', err);
		throw error(502, 'Failed to create site on connector');
	}

	const internalId = result.id;
	const systemId = systemUsernameFromId(internalId);
	const siteDbName = `${systemId}_${dbNameSuffix}`;

	await db.insert(wp_site).values({
		id: internalId,
		organizationId,
		internalId,
		name,
		description: parsed.data.description?.trim() || null,
		domain,
		docroot: docrootForSite(conn, internalId),
		diskLimitMb: parsed.data.diskLimitMb,
		dbHost: '127.0.0.1',
		dbName: siteDbName,
		dbUser: systemId,
		dbPassword: 'pending',
		adminUsername: parsed.data.adminUser.trim(),
		adminPassword: parsed.data.adminPass,
		adminEmail: parsed.data.adminEmail.trim(),
		tablePrefix: 'wp_',
		connectorId: conn.id,
		phpVersion: phpVersion || null,
		status: 'provisioning'
	});

	return json({ ok: true, siteId: internalId, status: result.status });
};
