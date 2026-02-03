import { error, json, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

export const POST: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['unban'] } });

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid user id');

	const ctx = await auth.$context;
	const updated = await ctx.internalAdapter.updateUser(id, {
		banned: false,
		banReason: null,
		banExpires: null
	});

	return json({ user: updated });
};
