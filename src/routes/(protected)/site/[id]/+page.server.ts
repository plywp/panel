import type { Actions, PageServerLoad } from './$types';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import axios from 'axios';

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

function normalizeConnectorBase(fqdn: string) {
	const v = fqdn.trim();
	if (!v) return v;
	return v.startsWith('http://') || v.startsWith('https://') ? v : `http://${v}`;
}

type InstallStatusResponse = unknown;

async function fetchInstallStatus(site: {
	id: string;
	connectorFqdn: string | null;
	connectorToken: string | null;
}): Promise<InstallStatusResponse | null> {
	const fqdn = site.connectorFqdn?.trim();
	const token = site.connectorToken?.trim();

	if (!fqdn || !token) return null;

	const base = normalizeConnectorBase(fqdn);

	try {
		const { data } = await axios.get(`${base}/api/sites/${site.id}/status`, {
			headers: { Authorization: `Bearer ${token}` },
			timeout: 10_000
		});

		return data ?? null;
	} catch (err) {
		if (axios.isAxiosError(err) && err.response?.status === 404) return null;
		throw err;
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = requireSession(locals);

	const site = await db.query.wp_site.findFirst({
		where: eq(wp_site.id, params.id)
	});

	if (!site) throw error(404, 'Site not found');
	if (!canAccessSite(session, site.organizationId)) throw error(403, 'Forbidden');

	let installStatus: InstallStatusResponse | null = null;

	try {
		installStatus = await fetchInstallStatus(site);
	} catch (err) {
		console.log(err);
		installStatus = null;
	}

	const { adminPassword, dbPassword, status = installStatus, ...safeSite } = site;

	return { site: safeSite };
};

export const actions: Actions = {
	showPassword: async ({ params, locals, setHeaders }) => {
		setHeaders({ 'Cache-Control': 'no-store' });

		const session = requireSession(locals);

		const site = await db.query.wp_site.findFirst({
			where: eq(wp_site.id, params.id)
		});

		if (!site) return fail(404, { message: 'Site not found' });
		if (!canAccessSite(session, site.organizationId)) return fail(403, { message: 'Forbidden' });

		return { success: true, adminPassword: site.adminPassword };
	}
};

export const prerender = false;
