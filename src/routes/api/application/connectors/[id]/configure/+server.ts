import { error, json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

export const POST: RequestHandler = async ({ params, request, url }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['configure'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid connector id');

	const rows = await db.select().from(connector).where(eq(connector.id, id)).limit(1);
	const conn = rows[0];
	if (!conn) throw error(404, 'Connector not found');

	const command = `plyorde configure --panel ${url.origin} --node ${conn.id} --token ${conn.token}`;
	return json({ command, connector: conn });
};
