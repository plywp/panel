import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(404, 'Not found');

	const rows = await db.select().from(connector).where(eq(connector.id, id)).limit(1);
	const conn = rows[0];
	if (!conn) throw error(404, 'Not found');

	let sslIssuerExpectedIps: unknown = conn.sslIssuerExpectedIps;
	if (typeof sslIssuerExpectedIps === 'string' && sslIssuerExpectedIps.trim()) {
		try {
			sslIssuerExpectedIps = JSON.parse(sslIssuerExpectedIps);
		} catch {
			// leave as-is
		}
	}

	return { conn: { ...conn, sslIssuerExpectedIps } };
};
