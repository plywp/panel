import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq, desc } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const schema = z
	.object({
		locationId: z.coerce.number().int().positive(),
		serverIp: z.string().min(3).max(191),
		fqdn: z.string().min(6).max(191),
		webServer: z.string().min(1),
		dataDir: z.string().min(1),
		autoSsl: z.boolean().default(false),
		sslIssuerEnabled: z.boolean().default(false),
		sslIssuerMode: z.string().optional().or(z.literal('')),
		sslIssuerEmail: z.string().optional().or(z.literal('')),
		sslIssuerCaDirUrl: z.string().optional().or(z.literal('')),
		sslIssuerAcceptTos: z.boolean().optional().default(false),
		sslIssuerKeyType: z.string().optional().or(z.literal('')),
		sslIssuerAccountDir: z.string().optional().or(z.literal('')),
		sslIssuerIncludeWww: z.string().optional().or(z.literal('')),
		sslIssuerRenewEnabled: z.boolean().optional().default(false),
		sslIssuerRenewIntervalHours: z.coerce.number().int().min(1).max(8760).optional(),
		sslIssuerCertPath: z.string().optional().or(z.literal('')),
		sslIssuerKeyPath: z.string().optional().or(z.literal('')),
		sslIssuerWebrootPath: z.string().optional().or(z.literal('')),
		sslIssuerTimeoutSeconds: z.coerce.number().int().min(5).max(600).optional(),
		sslIssuerExpectedIps: z.array(z.string()).optional(),
		sslIssuerVerifyDns: z.boolean().optional().default(true),
		sslIssuerVerifyHttp: z.boolean().optional().default(true),
		daemonSslEnabled: z.boolean().default(false),
		daemonSslCrt: z.string().optional().or(z.literal('')),
		daemonSslKey: z.string().optional().or(z.literal('')),
		dnsServerAddress: z.string().min(1),
		dnsServerPort: z.coerce.number().int().min(1).max(65535).default(53),
		dnsServerProto: z.enum(['tcp', 'udp', 'both']).default('tcp')
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

function createConnectorToken() {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
	return jwt.sign({ id: uuid(), type: 'connector' }, secret, { expiresIn: '1h' });
}

export const GET: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['read'] } });

	const connectors = await db
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
		.orderBy(desc(connector.id));

	const normalized = connectors.map((conn) => ({
		...conn,
		sslIssuerExpectedIps: parseExpectedIps(conn.sslIssuerExpectedIps)
	}));

	return json({ connectors: normalized });
};

export const POST: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['create'] } });

	const body = await request.json().catch(() => ({}));
	const parsed = schema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid connector payload');

	const crt = parsed.data.daemonSslEnabled ? parsed.data.daemonSslCrt?.trim() : null;
	const key = parsed.data.daemonSslEnabled ? parsed.data.daemonSslKey?.trim() : null;
	const expectedIps =
		parsed.data.sslIssuerExpectedIps && parsed.data.sslIssuerExpectedIps.length > 0
			? JSON.stringify(parsed.data.sslIssuerExpectedIps)
			: null;

	let token: string;
	try {
		token = createConnectorToken();
	} catch (err) {
		console.error(err);
		throw error(500, 'Server misconfigured: BETTER_AUTH_SECRET missing');
	}

	try {
		const result = await db.insert(connector).values({
			locationId: parsed.data.locationId,
			token,
			serverIp: parsed.data.serverIp,
			fqdn: parsed.data.fqdn,
			webServer: parsed.data.webServer,
			dataDir: parsed.data.dataDir,
			autoSsl: parsed.data.autoSsl,
			sslIssuerEnabled: parsed.data.sslIssuerEnabled,
			sslIssuerMode: parsed.data.sslIssuerMode?.trim() || null,
			sslIssuerEmail: parsed.data.sslIssuerEmail?.trim() || null,
			sslIssuerCaDirUrl: parsed.data.sslIssuerCaDirUrl?.trim() || null,
			sslIssuerAcceptTos: parsed.data.sslIssuerAcceptTos ?? false,
			sslIssuerKeyType: parsed.data.sslIssuerKeyType?.trim() || null,
			sslIssuerAccountDir: parsed.data.sslIssuerAccountDir?.trim() || null,
			sslIssuerIncludeWww: parsed.data.sslIssuerIncludeWww?.trim() || null,
			sslIssuerRenewEnabled: parsed.data.sslIssuerRenewEnabled ?? false,
			sslIssuerRenewIntervalHours: parsed.data.sslIssuerRenewIntervalHours ?? null,
			sslIssuerCertPath: parsed.data.sslIssuerCertPath?.trim() || null,
			sslIssuerKeyPath: parsed.data.sslIssuerKeyPath?.trim() || null,
			sslIssuerWebrootPath: parsed.data.sslIssuerWebrootPath?.trim() || null,
			sslIssuerTimeoutSeconds: parsed.data.sslIssuerTimeoutSeconds ?? null,
			sslIssuerExpectedIps: expectedIps,
			sslIssuerVerifyDns: parsed.data.sslIssuerVerifyDns ?? true,
			sslIssuerVerifyHttp: parsed.data.sslIssuerVerifyHttp ?? true,
			daemonSslEnabled: parsed.data.daemonSslEnabled,
			daemonSslCrt: crt,
			daemonSslKey: key,
			dnsServerAddress: parsed.data.dnsServerAddress,
			dnsServerPort: parsed.data.dnsServerPort,
			dnsServerProto: parsed.data.dnsServerProto
		});

		return json({ ok: true, id: Number(result.insertId), token });
	} catch (err: any) {
		if (err?.code === 'ER_DUP_ENTRY') {
			throw error(409, 'Connector token already exists. Try again.');
		}
		console.error(err);
		throw error(500, 'Database error while creating connector');
	}
};
