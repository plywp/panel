import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { env } from '$env/dynamic/private';

const zBool = z.preprocess((v) => {
	if (typeof v === 'boolean') return v;
	if (typeof v === 'string') return v === 'true' || v === '1' || v === 'on';
	return false;
}, z.boolean());

const zStringList = z.preprocess((v) => {
	if (Array.isArray(v)) return v;
	if (typeof v !== 'string') return [];
	const raw = v.trim();
	if (!raw) return [];
	if (raw.startsWith('[')) {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return raw
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}, z.array(z.string()));

const schema = z
	.object({
		locationId: z.coerce.number().int().positive(),

		serverIp: z.string().min(3).max(191),
		fqdn: z.string().min(6).max(191),
		webServer: z.string().min(1),
		dataDir: z.string().min(1),

		autoSsl: zBool.default(false),

		sslIssuerEnabled: zBool.default(false),
		sslIssuerMode: z.string().optional().or(z.literal('')),
		sslIssuerEmail: z.string().optional().or(z.literal('')),
		sslIssuerCaDirUrl: z.string().optional().or(z.literal('')),
		sslIssuerAcceptTos: zBool.default(false),
		sslIssuerKeyType: z.string().optional().or(z.literal('')),
		sslIssuerAccountDir: z.string().optional().or(z.literal('')),
		sslIssuerIncludeWww: z.string().optional().or(z.literal('')),
		sslIssuerRenewEnabled: zBool.default(false),
		sslIssuerRenewIntervalHours: z.coerce.number().int().min(1).max(8760).optional(),
		sslIssuerCertPath: z.string().optional().or(z.literal('')),
		sslIssuerKeyPath: z.string().optional().or(z.literal('')),
		sslIssuerWebrootPath: z.string().optional().or(z.literal('')),
		sslIssuerTimeoutSeconds: z.coerce.number().int().min(5).max(600).optional(),
		sslIssuerExpectedIps: zStringList.optional(),
		sslIssuerVerifyDns: zBool.default(true),
		sslIssuerVerifyHttp: zBool.default(true),

		daemonSslEnabled: zBool.default(false),
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
			if (!val.sslIssuerAcceptTos) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['sslIssuerAcceptTos'],
					message: 'Accept ToS is required when SSL issuer is enabled'
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

export const load: PageServerLoad = async () => {
	return {};
};

function createConnectorToken() {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');

	// include whatever you want in JWT payload; uuid() is fine
	return jwt.sign({ id: uuid(), type: 'connector' }, secret, { expiresIn: '1h' });
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = schema.safeParse(form);

		if (!parsed.success) {
			return fail(400, {
				message: 'Invalid data',
				errors: parsed.error.flatten().fieldErrors,
				values: form
			});
		}

		const crt = parsed.data.daemonSslEnabled ? parsed.data.daemonSslCrt.trim() : null;
		const key = parsed.data.daemonSslEnabled ? parsed.data.daemonSslKey.trim() : null;
		const expectedIps =
			parsed.data.sslIssuerExpectedIps && parsed.data.sslIssuerExpectedIps.length > 0
				? JSON.stringify(parsed.data.sslIssuerExpectedIps)
				: null;

		let token: string;
		try {
			token = createConnectorToken();
		} catch (e) {
			console.error(e);
			return fail(500, { message: 'Server misconfigured: BETTER_AUTH_SECRET missing' });
		}

		try {
			await db.insert(connector).values({
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
				sslIssuerAcceptTos: parsed.data.sslIssuerAcceptTos,
				sslIssuerKeyType: parsed.data.sslIssuerKeyType?.trim() || null,
				sslIssuerAccountDir: parsed.data.sslIssuerAccountDir?.trim() || null,
				sslIssuerIncludeWww: parsed.data.sslIssuerIncludeWww?.trim() || null,
				sslIssuerRenewEnabled: parsed.data.sslIssuerRenewEnabled,
				sslIssuerRenewIntervalHours: parsed.data.sslIssuerRenewIntervalHours ?? null,
				sslIssuerCertPath: parsed.data.sslIssuerCertPath?.trim() || null,
				sslIssuerKeyPath: parsed.data.sslIssuerKeyPath?.trim() || null,
				sslIssuerWebrootPath: parsed.data.sslIssuerWebrootPath?.trim() || null,
				sslIssuerTimeoutSeconds: parsed.data.sslIssuerTimeoutSeconds ?? null,
				sslIssuerExpectedIps: expectedIps,
				sslIssuerVerifyDns: parsed.data.sslIssuerVerifyDns,
				sslIssuerVerifyHttp: parsed.data.sslIssuerVerifyHttp,

				daemonSslEnabled: parsed.data.daemonSslEnabled,
				daemonSslCrt: crt,
				daemonSslKey: key,

				dnsServerAddress: parsed.data.dnsServerAddress,
				dnsServerPort: parsed.data.dnsServerPort,
				dnsServerProto: parsed.data.dnsServerProto
			});
		} catch (e: any) {
			// MySQL duplicate key (token unique)
			if (e?.code === 'ER_DUP_ENTRY') {
				return fail(409, { message: 'Connector token already exists. Try again.' });
			}
			console.error(e);
			return fail(500, { message: 'Database error while creating connector' });
		}

		throw redirect(303, '/admin/connectors');
	}
};
