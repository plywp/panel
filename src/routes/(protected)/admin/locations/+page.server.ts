import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { location } from '$lib/server/db/schema/location';

import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const locations = await db.select().from(location).orderBy(location.id);
	return { locations };
};

const createSchema = z.object({
	name: z.string().min(2).max(191),
	country: z.string().min(2).max(191)
});

export const actions: Actions = {
	create: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = createSchema.safeParse(form);

		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors, values: form });
		}

		await db.insert(location).values(parsed.data);
		throw redirect(303, '/admin/locations');
	},

	delete: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const id = Number(form.id);

		if (!Number.isInteger(id) || id <= 0) return fail(400, { message: 'Invalid id' });

		await db.delete(location).where(eq(location.id, id));
		throw redirect(303, '/admin/locations');
	},
	edit: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const id = Number(form.id);

		if (!Number.isInteger(id) || id <= 0) return fail(400, { message: 'Invalid id' });

		const parsed = createSchema.safeParse(form);

		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors, values: form });
		}

		await db.update(location).set(parsed.data).where(eq(location.id, id));
		throw redirect(303, '/admin/locations');
	}
};
