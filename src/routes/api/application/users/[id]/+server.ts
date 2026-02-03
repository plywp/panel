import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '$lib/auth';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const updateSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	email: z.string().email().optional(),
	role: z.string().optional(),
	lang: z.string().optional()
});

export const GET: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['read'] } });

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid user id');

	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.findUserById(id);
	if (!user) throw error(404, 'User not found');

	return json({ user });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['update'] } });

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid user id');

	const body = await request.json().catch(() => ({}));
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid user payload');

	const ctx = await auth.$context;
	const updated = await ctx.internalAdapter.updateUser(id, parsed.data);

	return json({ user: updated });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['delete'] } });

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid user id');

	const ctx = await auth.$context;
	await ctx.internalAdapter.deleteUser(id);

	return json({ ok: true });
};
