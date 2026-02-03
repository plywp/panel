import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { connector } from '$lib/server/db/schema/connector';
import { location } from '$lib/server/db/schema/location';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const connectors = await db
		.select({
			id: connector.id,
			serverIp: connector.serverIp,
			fqdn: connector.fqdn,
			token: connector.token,
			webServer: connector.webServer,
			dataDir: connector.dataDir,

			autoSsl: connector.autoSsl,
			daemonSslEnabled: connector.daemonSslEnabled,

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

	return { connectors };
};

const deleteSchema = z.object({
	id: z.coerce.number().int().positive()
});

export const actions: Actions = {
	delete: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = deleteSchema.safeParse(form);
		if (!parsed.success) return fail(400, { message: 'Invalid id' });

		await db.delete(connector).where(eq(connector.id, parsed.data.id));
		return { success: true };
	}
};
