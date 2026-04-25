import type { LayoutServerLoad } from './$types';
import { getValue } from '$lib/server/db/kv';

export const load: LayoutServerLoad = async ({ request }) => {
	const meta = {
		title: await getValue('title'),
		description: await getValue('description'),
		favicon: await getValue('favicon')
	};

	return { meta };
};
