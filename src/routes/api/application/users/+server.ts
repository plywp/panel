import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '$lib/auth';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const createSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1).max(255),
	password: z.string().min(8).max(128),
	role: z.string().optional()
});

const listSchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).optional(),
	offset: z.coerce.number().int().min(0).optional()
});

export const GET: RequestHandler = async ({ request, url }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['read'] } });

	const parsed = listSchema.safeParse({
		limit: url.searchParams.get('limit') ?? undefined,
		offset: url.searchParams.get('offset') ?? undefined
	});
	if (!parsed.success) throw error(400, 'Invalid query');

	const ctx = await auth.$context;
	const users = await ctx.internalAdapter.listUsers(parsed.data.limit, parsed.data.offset);
	const total = await ctx.internalAdapter.countTotalUsers();

	return json({ users, total, limit: parsed.data.limit, offset: parsed.data.offset });
};

export const POST: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { users: ['create'] } });

	const body = await request.json().catch(() => ({}));
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid user payload');

	const ctx = await auth.$context;
	const existing = await ctx.internalAdapter.findUserByEmail(parsed.data.email.toLowerCase());
	if (existing) throw error(409, 'User already exists');

	const user = await ctx.internalAdapter.createUser({
		email: parsed.data.email.toLowerCase(),
		name: parsed.data.name,
		role: parsed.data.role ?? 'user'
	});

	const hashed = await ctx.password.hash(parsed.data.password);
	await ctx.internalAdapter.createAccount({
		accountId: user.id,
		providerId: 'credential',
		password: hashed,
		userId: user.id
	});

	return json({ user });
};
