import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import axios from 'axios';
import { requireSiteCtx } from '$lib/site-context';
import { connectorClient } from '$lib/connector-client';
import { json } from '@sveltejs/kit';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

function wpUsersBase(siteId: string) {
	return `/api/sites/${siteId}/users`;
}

export type WPUser = {
	ID: number;
	user_login: string;
	user_email: string;
	roles: string[];
	display_name: string;
};

type UsersResponse = { users: WPUser[] };

function mustStr(v: FormDataEntryValue | null, field: string) {
	const s = typeof v === 'string' ? v.trim() : '';
	if (!s) throw error(400, `${field} is required`);
	return s;
}

function optStr(v: FormDataEntryValue | null) {
	return typeof v === 'string' ? v.trim() : '';
}

function parseRoles(fd: FormData, key = 'roles') {
	const all = fd
		.getAll(key)
		.map((v) => (typeof v === 'string' ? v.trim() : ''))
		.filter(Boolean);
	if (all.length === 0) return [];

	if (all.length === 1 && all[0].includes(',')) {
		return all[0]
			.split(',')
			.map((x) => x.trim())
			.filter(Boolean);
	}

	return all;
}

function asBool(v: FormDataEntryValue | null) {
	if (v == null) return false;
	if (typeof v !== 'string') return true;
	const s = v.trim().toLowerCase();
	return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

async function listUsers(ctx: Awaited<ReturnType<typeof requireSiteCtx>>) {
	const api = connectorClient(ctx.base, ctx.connectorToken);
	const { data } = await api.get<UsersResponse>(wpUsersBase(ctx.site.id));
	return data.users ?? [];
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const ctx = await requireSiteCtx(params, locals);

	const users = await listUsers(ctx);

	const { connectorToken: _t, ...siteSafe } = ctx.site;

	return {
		site: siteSafe,
		users
	};
};

export const actions: Actions = {
	list: async ({ params, locals }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const users = await listUsers(ctx);
			return { type: 'success', users };
		} catch (err) {
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to load users' });
		}
	},

	create: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const username = mustStr(fd.get('user_login'), 'user_login');
			const email = mustStr(fd.get('user_email'), 'user_email');
			const password = optStr(fd.get('user_pass'));
			const role = optStr(fd.get('role'));

			const payload = {
				username,
				email,
				password: password || undefined,
				role: role || undefined
			};

			const { data } = await api.post(`${wpUsersBase(ctx.site.id)}`, payload);

			return { type: 'success', data };
		} catch (err) {
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to create user' });
		}
	},

	update: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const user_login = optStr(fd.get('user_login'));
			if (!user_login) throw error(400, 'user_login is required');

			const display_name = optStr(fd.get('display_name'));
			const user_email = optStr(fd.get('user_email'));

			const payload = {
				display_name: display_name || undefined,
				email: user_email || undefined
			};

			const { data } = await api.post(`${wpUsersBase(ctx.site.id)}/${user_login}`, payload);

			return { type: 'success', data };
		} catch (err) {
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to update user' });
		}
	},

	setRoles: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const user_login = optStr(fd.get('user_login'));
			if (!user_login) throw error(400, 'user_login is required');

			const roles = parseRoles(fd, 'roles');
			if (!roles.length) throw error(400, 'roles is required');

			const payload = {
				role: roles[0]
			};

			const { data } = await api.post(`${wpUsersBase(ctx.site.id)}/${user_login}/role`, payload);

			return { type: 'success', data };
		} catch (err) {
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to update roles' });
		}
	},

	resetPassword: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const user_login = optStr(fd.get('user_login'));
			if (!user_login) throw error(400, 'user_login is required');

			const password = mustStr(fd.get('password'), 'new_password');

			const payload = {
				user_login: user_login || undefined,
				password
			};

			//console.log(payload);

			const { data } = await api.post(
				`${wpUsersBase(ctx.site.id)}/${user_login}/password`,
				payload
			);

			if (data.status == 'ok') {
				const isCurrentAdminLogin = user_login === ctx.site.adminUsername;

				if (isCurrentAdminLogin) {
					await db
						.update(wp_site)
						.set({ adminPassword: password })
						.where(eq(wp_site.id, ctx.site.id));
				} else {
					let updatedUserIsWpAdmin = false;
					try {
						const { data: userDetails } = await api.get<WPUser>(
							`${wpUsersBase(ctx.site.id)}/${user_login}`
						);
						updatedUserIsWpAdmin = userDetails?.roles?.includes('administrator');
					} catch (e) {
						console.error(`API Error: Could not fetch details for user ${user_login}`, e);
					}

					if (updatedUserIsWpAdmin) {
						let assignedAdminIsStale = false;
						if (ctx.site.adminUsername) {
							try {
								await api.get<WPUser>(`${wpUsersBase(ctx.site.id)}/${ctx.site.adminUsername}`);
							} catch (err) {
								if (axios.isAxiosError(err) && err.response?.status === 404) {
									assignedAdminIsStale = true;
								} else {
									console.error(
										`API Error: Could not verify existence of current admin ${ctx.site.adminUsername}`,
										err
									);
								}
							}
						} else {
							assignedAdminIsStale = true;
						}

						if (assignedAdminIsStale) {
							await db
								.update(wp_site)
								.set({ adminPassword: password, adminUsername: user_login })
								.where(eq(wp_site.id, ctx.site.id));
						}
					}
				}
			}

			return { type: 'success', data };
		} catch (err) {
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to reset password' });
		}
	},

	delete: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const user_login = optStr(fd.get('user_login'));
			if (!user_login) throw error(400, 'user_id or user_login is required');

			const reassign = optStr(fd.get('reassign'));

			const payload = {
				user_login: user_login || undefined,
				reassign: reassign || undefined
			};

			const { data } = await api.delete(`${wpUsersBase(ctx.site.id)}/${user_login}`, payload);

			//console.log(data, user_login);

			return { type: 'success', data };
		} catch (err) {
			if (axios.isAxiosError(err) && err.response?.status === 404) {
				return fail(404, { type: 'failure', message: 'User not found' });
			}
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to delete user' });
		}
	},
	listRoles: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const { data } = await api.get(`/api/sites/${ctx.site.id}/roles`);

			return { type: 'success', data };
		} catch (err) {
			console.log(err);
			return fail(500, { type: 'failure', message: 'Failed to list roles' });
		}
	}
};
