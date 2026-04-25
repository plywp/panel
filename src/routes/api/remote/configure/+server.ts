import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from '../configure/$types';
import { connector } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization');
	if (!auth) throw error(401, 'Unauthorized');

	const [scheme, token] = auth.split(' ');

	if (scheme !== 'Bearer' || !token) {
		throw error(401, 'Invalid authorization header');
	}

	const nodeId = url.searchParams.get('node');
	if (!nodeId) throw error(400, 'Node ID is required');

	// Query by token and id for extra security
	const result = await db
		.select()
		.from(connector)
		.where(and(eq(connector.token, token), eq(connector.id, Number(nodeId))));

	if (result.length === 0) {
		throw error(404, 'Connector not found or invalid token');
	}

	const conn = result[0];
	if (conn?.sslIssuerExpectedIps) {
		try {
			conn.sslIssuerExpectedIps = JSON.parse(conn.sslIssuerExpectedIps as any);
		} catch {
			// leave as-is if invalid
		}
	}
	return json(conn);
};
