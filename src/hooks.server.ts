import { auth } from '$lib/auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	const isProtected = event.route.id?.startsWith('/(protected)/');

	if (isProtected) {
		const session = await auth.api.getSession({
			headers: event.request.headers
		});

		if (!session) {
			throw redirect(307, '/sign-in');
		}

		event.locals.session = session;
		event.locals.user = session.user;

		const isAdminRoute = event.route.id?.includes('/admin/');
		const isAdmin = session.user?.role === 'admin';

		if (isAdminRoute && !isAdmin) {
			throw redirect(303, '/dashboard');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
