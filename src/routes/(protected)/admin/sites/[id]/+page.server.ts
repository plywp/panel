import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { eq } from 'drizzle-orm';

type SessionBundle = NonNullable<App.Locals['session']>;

function requireSession(locals: App.Locals): SessionBundle {
	const session = locals.session;
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	return session;
}

function canAccessSite(session: SessionBundle, siteOrgId: string): boolean {
	const role = session.user.role;
	const activeOrgId = session.session.activeOrganizationId;

	if (role === 'admin') return true;
	if (!activeOrgId) return false;
	return activeOrgId === siteOrgId;
}

function toSafeSession(session: SessionBundle) {
	return {
		session: {
			activeOrganizationId: session.session.activeOrganizationId
		},
		user: {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			role: session.user.role,
			banned: session.user.banned
		}
	};
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = requireSession(locals);

	const site = await db.query.wp_site.findFirst({
		where: eq(wp_site.id, params.id)
	});

	if (!site) throw error(404, 'Site not found');
	if (!canAccessSite(session, site.organizationId)) throw error(403, 'Forbidden');

	const { adminPassword, dbPassword, ...safeSite } = site;

	return {
		site: safeSite,
		session: toSafeSession(session)
	};
};

export const actions: Actions = {
	showPassword: async ({ params, locals, setHeaders }) => {
		setHeaders({
			'Cache-Control': 'no-store'
		});

		const session = requireSession(locals);

		const site = await db.query.wp_site.findFirst({
			where: eq(wp_site.id, params.id)
		});

		if (!site) return fail(404, { message: 'Site not found' });
		if (!canAccessSite(session, site.organizationId)) return fail(403, { message: 'Forbidden' });

		return {
			success: true,
			adminPassword: site.adminPassword
		};
	}
};

export const prerender = false;
