import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '../../../../../../lib/server/db';
import { connector } from '../../../../../../lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const connectorId = parseInt(params.id);

	if (isNaN(connectorId)) {
		throw error(400, 'Invalid connector ID');
	}

	try {
		const [conn] = await db
			.select({
				id: connector.id,
				fqdn: connector.fqdn,
				token: connector.token,
				daemonSslEnabled: connector.daemonSslEnabled
			})
			.from(connector)
			.where(eq(connector.id, connectorId))
			.limit(1);

		if (!conn) {
			throw error(404, 'Connector not found');
		}

		return {
			conn
		};
	} catch (e) {
		console.error('Failed to load connector:', e);
		throw error(500, 'Failed to load connector data');
	}
};
