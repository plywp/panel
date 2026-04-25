import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';

const schema = z
	.object({
		id: z.coerce.number().int().positive(),
		locationId: z.coerce.number().int().positive(),

		token: z.string().min(10),
		serverIp: z.string().min(3).max(191),
		fqdn: z.string().min(6).max(191),
		webServer: z.string().min(1),
		dataDir: z.string().min(1),

		autoSsl: z.coerce.boolean().default(false),

		daemonSslEnabled: z.coerce.boolean().default(false),
		daemonSslCrt: z.string().optional().or(z.literal('')),
		daemonSslKey: z.string().optional().or(z.literal('')),

		dnsServerAddress: z.string().min(1),
		dnsServerPort: z.coerce.number().int().min(1).max(65535).default(53),
		dnsServerProto: z.enum(['tcp', 'udp', 'both']).default('tcp'),

		sslIssuerEnabled: z.coerce.boolean().default(false),
		sslIssuerMode: z.string().optional().or(z.literal('')),
		sslIssuerEmail: z.string().optional().or(z.literal('')),
		sslIssuerCaDirUrl: z.string().optional().or(z.literal('')),
		sslIssuerAcceptTos: z.coerce.boolean().default(false),
		sslIssuerKeyType: z.string().optional().or(z.literal('')),
		sslIssuerAccountDir: z.string().optional().or(z.literal('')),
		sslIssuerIncludeWww: z.string().optional().or(z.literal('')),
		sslIssuerRenewEnabled: z.coerce.boolean().default(false),
		sslIssuerRenewIntervalHours: z.coerce.number().int().optional(),
		sslIssuerCertPath: z.string().optional().or(z.literal('')),
		sslIssuerKeyPath: z.string().optional().or(z.literal('')),
		sslIssuerWebrootPath: z.string().optional().or(z.literal('')),
		sslIssuerTimeoutSeconds: z.coerce.number().int().optional(),
		sslIssuerExpectedIps: z.string().optional().or(z.literal('')),
		sslIssuerVerifyDns: z.coerce.boolean().default(true),
		sslIssuerVerifyHttp: z.coerce.boolean().default(true),

		dataBaseUsername: z.string().min(1),
		dataBasePassword: z.string().min(1),
		dataBaseHost: z.string().min(1),
		dataBasePort: z.coerce.number().int().min(1).max(65535).default(3306),
		dataBaseName: z.string().min(1),
		dataBaseDir: z.string().min(1)
	})
	.superRefine((val, ctx) => {
		if (val.daemonSslEnabled) {
			if (!val.daemonSslCrt?.trim())
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['daemonSslCrt'],
					message: 'Cert path required'
				});
			if (!val.daemonSslKey?.trim())
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['daemonSslKey'],
					message: 'Key path required'
				});
		}
	});

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(404, 'Not found');

	try {
		const rows = await db.select().from(connector).where(eq(connector.id, id)).limit(1);
		const conn = rows[0];
		if (!conn) throw error(404, 'Not found');
		return { conn };
	} catch (e: any) {
		console.error('Error loading connector:', e);
		throw error(500, `Database error: ${e.message}`);
	}
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const id = Number(params.id);

		const form = Object.fromEntries(await request.formData());
		const parsed = schema.safeParse({ ...form, id });

		if (!parsed.success)
			return fail(400, { message: 'Invalid data', issues: parsed.error.flatten() });

		const crt = parsed.data.daemonSslEnabled ? parsed.data.daemonSslCrt.trim() : null;
		const key = parsed.data.daemonSslEnabled ? parsed.data.daemonSslKey.trim() : null;

		await db
			.update(connector)
			.set({
				locationId: parsed.data.locationId,

				token: parsed.data.token,
				serverIp: parsed.data.serverIp,
				fqdn: parsed.data.fqdn,
				webServer: parsed.data.webServer,
				dataDir: parsed.data.dataDir,

				autoSsl: parsed.data.autoSsl,

				daemonSslEnabled: parsed.data.daemonSslEnabled,
				daemonSslCrt: crt,
				daemonSslKey: key,

				dnsServerAddress: parsed.data.dnsServerAddress,
				dnsServerPort: parsed.data.dnsServerPort,
				dnsServerProto: parsed.data.dnsServerProto,

				sslIssuerEnabled: parsed.data.sslIssuerEnabled,
				sslIssuerMode: parsed.data.sslIssuerMode,
				sslIssuerEmail: parsed.data.sslIssuerEmail,
				sslIssuerCaDirUrl: parsed.data.sslIssuerCaDirUrl,
				sslIssuerAcceptTos: parsed.data.sslIssuerAcceptTos,
				sslIssuerKeyType: parsed.data.sslIssuerKeyType,
				sslIssuerAccountDir: parsed.data.sslIssuerAccountDir,
				sslIssuerIncludeWww: parsed.data.sslIssuerIncludeWww,
				sslIssuerRenewEnabled: parsed.data.sslIssuerRenewEnabled,
				sslIssuerRenewIntervalHours: parsed.data.sslIssuerRenewIntervalHours,
				sslIssuerCertPath: parsed.data.sslIssuerCertPath,
				sslIssuerKeyPath: parsed.data.sslIssuerKeyPath,
				sslIssuerWebrootPath: parsed.data.sslIssuerWebrootPath,
				sslIssuerTimeoutSeconds: parsed.data.sslIssuerTimeoutSeconds,
				sslIssuerExpectedIps: parsed.data.sslIssuerExpectedIps,
				sslIssuerVerifyDns: parsed.data.sslIssuerVerifyDns,
				sslIssuerVerifyHttp: parsed.data.sslIssuerVerifyHttp,

				dataBaseUsername: parsed.data.dataBaseUsername,
				dataBasePassword: parsed.data.dataBasePassword,
				dataBaseHost: parsed.data.dataBaseHost,
				dataBasePort: parsed.data.dataBasePort,
				dataBaseName: parsed.data.dataBaseName,
				dataBaseDir: parsed.data.dataBaseDir
			})
			.where(eq(connector.id, id));

		throw redirect(303, '/admin/connectors');
	},
	delete: async ({ params }) => {
		const id = Number(params.id);
		await db.delete(connector).where(eq(connector.id, id));
		throw redirect(303, '/admin/connectors');
	}
};
