import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { organization, wp_site } from '$lib/server/db/schema/auth-schema';
import { eq } from 'drizzle-orm';
import { docrootForSite, plyordeRequest, systemUsernameFromId } from '$lib/server/plyorde';

const schema = z.object({
	organizationId: z.string().min(1),
	connectorId: z.coerce.number().int().positive(),
	name: z.string().min(2).max(191),
	description: z.string().optional().or(z.literal('')),
	domain: z.string().min(3).max(255),
	diskLimitMb: z.coerce.number().int().min(40),
	phpVersion: z.string().optional().or(z.literal('')),
	autoSsl: z.preprocess((v) => v === 'true' || v === '1' || v === 'on', z.boolean()).default(false),
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

export const load: PageServerLoad = async ({ locals }) => {
	const organizations = await db
		.select({
			id: organization.id,
			name: organization.name,
			slug: organization.slug
		})
		.from(organization)
		.orderBy(organization.name);

	const connectors = await db
		.select({
			id: connector.id,
			fqdn: connector.fqdn,
			daemonSslEnabled: connector.daemonSslEnabled,
			dataDir: connector.dataDir,
			locationName: location.name,
			locationCountry: location.country
		})
		.from(connector)
		.leftJoin(location, eq(connector.locationId, location.id))
		.orderBy(connector.id);

	return {
		connectors,
		organizations,
		defaultOrganizationId: locals.session?.session.activeOrganizationId ?? null
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const values = { ...form };
		delete (values as Record<string, unknown>).adminPass;
		const parsed = schema.safeParse(form);

		if (!parsed.success) {
			return fail(400, {
				message: 'Invalid data',
				errors: parsed.error.flatten().fieldErrors,
				values
			});
		}

		const organizationId = parsed.data.organizationId?.trim();
		if (!organizationId) {
			return fail(400, { message: 'Organization is required', values });
		}

		const orgExists = await db
			.select({ id: organization.id })
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);

		if (!orgExists.length) {
			return fail(404, { message: 'Organization not found', values });
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
			.where(eq(connector.id, parsed.data.connectorId))
			.limit(1);

		if (!conn) {
			return fail(404, { message: 'Connector not found', values });
		}

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
			admin_email: parsed.data.adminEmail.trim(),
			auto_ssl: parsed.data.autoSsl
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
			return fail(502, { message: 'Failed to create site on connector', values });
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

		throw redirect(303, `/admin/sites/${internalId}/edit`);
	}
};
