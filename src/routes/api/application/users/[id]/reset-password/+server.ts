import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '$lib/auth';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const bodySchema = z.object({
	newPassword: z.string().min(8).max(128)
});

export const POST: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['resetPassword'] } });

	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid user id');

	const body = await request.json().catch(() => ({}));
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid password payload');

	const ctx = await auth.$context;
	const hashed = await ctx.password.hash(parsed.data.newPassword);

	const accounts = await ctx.internalAdapter.findAccounts(id);
	const credentialAccount = accounts.find((ac) => ac.providerId === 'credential');
	if (!credentialAccount) {
		await ctx.internalAdapter.createAccount({
			userId: id,
			providerId: 'credential',
			password: hashed,
			accountId: id
		});
	} else {
		await ctx.internalAdapter.updatePassword(id, hashed);
	}

	return json({ ok: true });
};
