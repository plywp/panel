import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import type { LayoutServerLoad } from './$types';
import { getValue } from '$lib/server/db/kv';

export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const meta = {
		title: await getValue('title'),
		description: await getValue('description'),
		favicon: await getValue('favicon')
	};

	return { session, meta };
};
