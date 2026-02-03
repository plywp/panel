import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const updateSchema = z
	.object({
		locationId: z.coerce.number().int().positive().optional(),
		serverIp: z.string().min(3).max(191).optional(),
		fqdn: z.string().min(6).max(191).optional(),
		webServer: z.string().min(1).optional(),
		dataDir: z.string().min(1).optional(),
		autoSsl: z.boolean().optional(),
		sslIssuerEnabled: z.boolean().optional(),
		sslIssuerMode: z.string().optional().or(z.literal('')),
		sslIssuerEmail: z.string().optional().or(z.literal('')),
		sslIssuerCaDirUrl: z.string().optional().or(z.literal('')),
		sslIssuerAcceptTos: z.boolean().optional(),
		sslIssuerKeyType: z.string().optional().or(z.literal('')),
		sslIssuerAccountDir: z.string().optional().or(z.literal('')),
		sslIssuerIncludeWww: z.string().optional().or(z.literal('')),
		sslIssuerRenewEnabled: z.boolean().optional(),
		sslIssuerRenewIntervalHours: z.coerce.number().int().min(1).max(8760).optional(),
		sslIssuerCertPath: z.string().optional().or(z.literal('')),
		sslIssuerKeyPath: z.string().optional().or(z.literal('')),
		sslIssuerWebrootPath: z.string().optional().or(z.literal('')),
		sslIssuerTimeoutSeconds: z.coerce.number().int().min(5).max(600).optional(),
		sslIssuerExpectedIps: z.array(z.string()).optional(),
		sslIssuerVerifyDns: z.boolean().optional(),
		sslIssuerVerifyHttp: z.boolean().optional(),
		daemonSslEnabled: z.boolean().optional(),
		daemonSslCrt: z.string().optional().or(z.literal('')),
		daemonSslKey: z.string().optional().or(z.literal('')),
		dnsServerAddress: z.string().min(1).optional(),
		dnsServerPort: z.coerce.number().int().min(1).max(65535).optional(),
		dnsServerProto: z.enum(['tcp', 'udp', 'both']).optional()
	})
	.superRefine((val, ctx) => {
		if (val.sslIssuerEnabled) {
			if (!val.sslIssuerEmail?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['sslIssuerEmail'],
					message: 'Issuer email required when SSL issuer is enabled'
				});
			}
			if (!val.sslIssuerCertPath?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['sslIssuerCertPath'],
					message: 'Cert path required when SSL issuer is enabled'
				});
			}
			if (!val.sslIssuerKeyPath?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['sslIssuerKeyPath'],
					message: 'Key path required when SSL issuer is enabled'
				});
			}
		}
		if (val.daemonSslEnabled) {
			if (!val.daemonSslCrt?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['daemonSslCrt'],
					message: 'Cert path required when Daemon SSL is enabled'
				});
			}
			if (!val.daemonSslKey?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['daemonSslKey'],
					message: 'Key path required when Daemon SSL is enabled'
				});
			}
		}
	});

function parseExpectedIps(value: string | null) {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : value;
	} catch {
		return value;
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['read'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid connector id');

	const rows = await db
		.select({
			id: connector.id,
			serverIp: connector.serverIp,
			fqdn: connector.fqdn,
			token: connector.token,
			webServer: connector.webServer,
			dataDir: connector.dataDir,
			autoSsl: connector.autoSsl,
			sslIssuerEnabled: connector.sslIssuerEnabled,
			sslIssuerMode: connector.sslIssuerMode,
			sslIssuerEmail: connector.sslIssuerEmail,
			sslIssuerCaDirUrl: connector.sslIssuerCaDirUrl,
			sslIssuerAcceptTos: connector.sslIssuerAcceptTos,
			sslIssuerKeyType: connector.sslIssuerKeyType,
			sslIssuerAccountDir: connector.sslIssuerAccountDir,
			sslIssuerIncludeWww: connector.sslIssuerIncludeWww,
			sslIssuerRenewEnabled: connector.sslIssuerRenewEnabled,
			sslIssuerRenewIntervalHours: connector.sslIssuerRenewIntervalHours,
			sslIssuerCertPath: connector.sslIssuerCertPath,
			sslIssuerKeyPath: connector.sslIssuerKeyPath,
			sslIssuerWebrootPath: connector.sslIssuerWebrootPath,
			sslIssuerTimeoutSeconds: connector.sslIssuerTimeoutSeconds,
			sslIssuerExpectedIps: connector.sslIssuerExpectedIps,
			sslIssuerVerifyDns: connector.sslIssuerVerifyDns,
			sslIssuerVerifyHttp: connector.sslIssuerVerifyHttp,
			daemonSslEnabled: connector.daemonSslEnabled,
			daemonSslCrt: connector.daemonSslCrt,
			daemonSslKey: connector.daemonSslKey,
			dnsServerAddress: connector.dnsServerAddress,
			dnsServerPort: connector.dnsServerPort,
			dnsServerProto: connector.dnsServerProto,
			locationId: connector.locationId,
			locationName: location.name,
			locationCountry: location.country
		})
		.from(connector)
		.leftJoin(location, eq(connector.locationId, location.id))
		.where(eq(connector.id, id))
		.limit(1);

	const conn = rows[0];
	if (!conn) throw error(404, 'Connector not found');

	return json({
		connector: {
			...conn,
			sslIssuerExpectedIps: parseExpectedIps(conn.sslIssuerExpectedIps)
		}
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['update'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid connector id');

	const body = await request.json().catch(() => ({}));
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid connector payload');

	const data = { ...parsed.data };
	if ('daemonSslCrt' in data && data.daemonSslCrt === '') data.daemonSslCrt = null;
	if ('daemonSslKey' in data && data.daemonSslKey === '') data.daemonSslKey = null;
	if ('sslIssuerMode' in data && data.sslIssuerMode === '') data.sslIssuerMode = null;
	if ('sslIssuerEmail' in data && data.sslIssuerEmail === '') data.sslIssuerEmail = null;
	if ('sslIssuerCaDirUrl' in data && data.sslIssuerCaDirUrl === '') data.sslIssuerCaDirUrl = null;
	if ('sslIssuerKeyType' in data && data.sslIssuerKeyType === '') data.sslIssuerKeyType = null;
	if ('sslIssuerAccountDir' in data && data.sslIssuerAccountDir === '')
		data.sslIssuerAccountDir = null;
	if ('sslIssuerIncludeWww' in data && data.sslIssuerIncludeWww === '')
		data.sslIssuerIncludeWww = null;
	if ('sslIssuerCertPath' in data && data.sslIssuerCertPath === '') data.sslIssuerCertPath = null;
	if ('sslIssuerKeyPath' in data && data.sslIssuerKeyPath === '') data.sslIssuerKeyPath = null;
	if ('sslIssuerWebrootPath' in data && data.sslIssuerWebrootPath === '')
		data.sslIssuerWebrootPath = null;
	if ('sslIssuerExpectedIps' in data) {
		if (!data.sslIssuerExpectedIps || data.sslIssuerExpectedIps.length === 0) {
			data.sslIssuerExpectedIps = null;
		} else {
			data.sslIssuerExpectedIps = JSON.stringify(data.sslIssuerExpectedIps);
		}
	}

	await db.update(connector).set(data).where(eq(connector.id, id));

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['delete'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid connector id');

	await db.delete(connector).where(eq(connector.id, id));
	return json({ ok: true });
};
