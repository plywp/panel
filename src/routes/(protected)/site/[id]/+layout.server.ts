import type { LayoutServerLoad } from './$types';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

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

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const session = requireSession(locals);

	const site = await db.query.wp_site.findFirst({
		where: eq(wp_site.id, params.id)
	});

	if (!site) throw error(404, 'Site not found');
	if (!canAccessSite(session, site.organizationId)) throw error(403, 'Forbidden');

	const { adminPassword, dbPassword, ...safeSite } = site;

	return {
		site: safeSite
	};
};
