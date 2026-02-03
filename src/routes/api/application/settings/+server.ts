import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { getValue, setValue } from '$lib/server/db/kv';
import { verifyAdminApiKeyOrThrow } from '$lib/server/auth/api-keys';

const updateSchema = z.object({
	title: z.string().max(100).optional(),
	description: z.string().max(200).optional(),
	favicon: z.string().max(500).optional()
});

export const GET: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { settings: ['read'] } });

	const settings = {
		title: (await getValue('title')) ?? '',
		description: (await getValue('description')) ?? '',
		favicon: (await getValue('favicon')) ?? ''
	};

	return json({ settings });
};

export const PATCH: RequestHandler = async ({ request }) => {
	await verifyAdminApiKeyOrThrow(request, { requiredPermissions: { settings: ['update'] } });

	const body = await request.json().catch(() => ({}));
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid settings payload');

	const updated: Record<string, string> = {};
	if (parsed.data.title !== undefined) {
		await setValue('title', parsed.data.title.trim());
		updated.title = parsed.data.title.trim();
	}
	if (parsed.data.description !== undefined) {
		await setValue('description', parsed.data.description.trim());
		updated.description = parsed.data.description.trim();
	}
	if (parsed.data.favicon !== undefined) {
		await setValue('favicon', parsed.data.favicon.trim());
		updated.favicon = parsed.data.favicon.trim();
	}

	return json({ ok: true, updated });
};
