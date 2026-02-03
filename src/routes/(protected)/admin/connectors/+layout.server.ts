import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { location } from '$lib/server/db/schema/location';

export const load: LayoutServerLoad = async () => {
	const locations = await db.select().from(location).orderBy(location.name);
	return { locations };
};
