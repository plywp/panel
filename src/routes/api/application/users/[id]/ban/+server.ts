import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '$lib/auth';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const bodySchema = z.object({
	reason: z.string().optional(),
	expiresAt: z.string().datetime().optional()
});

export const POST: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['ban'] } });

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid user id');

	const body = await request.json().catch(() => ({}));
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid ban payload');

	const ctx = await auth.$context;
	const updated = await ctx.internalAdapter.updateUser(id, {
		banned: true,
		banReason: parsed.data.reason ?? null,
		banExpires: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
	});

	return json({ user: updated });
};
