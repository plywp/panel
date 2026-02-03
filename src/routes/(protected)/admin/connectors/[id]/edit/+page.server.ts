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
		dnsServerProto: z.enum(['tcp', 'udp', 'both']).default('tcp')
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

	const rows = await db.select().from(connector).where(eq(connector.id, id)).limit(1);
	const conn = rows[0];
	if (!conn) throw error(404, 'Not found');

	return { conn };
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
				dnsServerProto: parsed.data.dnsServerProto
			})
			.where(eq(connector.id, id));

		throw redirect(303, '/admin/connectors');
	}
};
