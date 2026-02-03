import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { location } from '$lib/server/db/schema/location';
import { eq } from 'drizzle-orm';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const updateSchema = z.object({
	name: z.string().min(1).max(191).optional(),
	country: z.string().min(1).max(191).optional()
});

export const GET: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { locations: ['read'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid location id');

	const rows = await db.select().from(location).where(eq(location.id, id)).limit(1);
	const loc = rows[0];
	if (!loc) throw error(404, 'Location not found');

	return json({ location: loc });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { locations: ['update'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid location id');

	const body = await request.json().catch(() => ({}));
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid location payload');

	await db.update(location).set(parsed.data).where(eq(location.id, id));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { locations: ['delete'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid location id');

	await db.delete(location).where(eq(location.id, id));
	return json({ ok: true });
};
