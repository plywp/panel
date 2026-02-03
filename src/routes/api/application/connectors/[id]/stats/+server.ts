import { error, json, type RequestHandler } from '@sveltejs/kit';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

export const GET: RequestHandler = async ({ params, request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { connectors: ['stats'] } });

	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid connector id');

	return json({ ok: true, stats: null });
};
