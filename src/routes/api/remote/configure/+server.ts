import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from '../configure/$types';
import { connector } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('authorization');
	if (!auth) throw error(401, 'Unauthorized');

	const [scheme, token] = auth.split(' ');

	if (scheme !== 'Bearer' || !token) {
		throw error(401, 'Invalid authorization header');
	}

	// Query by token instead of id (assuming connector has a 'token' column)
	const result = await db.select().from(connector).where(eq(connector.token, token));

	if (result.length === 0) {
		throw error(404, 'Connector not found');
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
