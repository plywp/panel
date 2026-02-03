import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { location } from '$lib/server/db/schema/location';
import { desc } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const schema = z.object({
	name: z.string().min(1).max(191),
	country: z.string().min(1).max(191)
});

export const GET: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { locations: ['read'] } });

	const locations = await db.select().from(location).orderBy(desc(location.id));
	return json({ locations });
};

export const POST: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { locations: ['create'] } });

	const body = await request.json().catch(() => ({}));
	const parsed = schema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid location payload');

	const result = await db.insert(location).values({
		name: parsed.data.name,
		country: parsed.data.country
	});

	return json({ ok: true, id: Number(result.insertId) });
};
