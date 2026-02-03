import { error, json, type RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

const baseUsers = (base: string, siteId: string) => `${base}/api/sites/${siteId}/users`;

export const GET: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const ctx = await requireApiKeySiteAccess(request, siteId, { users: ['read'] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	const { data } = await axios.get(baseUsers(base, ctx.siteId), {
		headers: { Authorization: `Bearer ${ctx.connectorToken}` }
	});

	return json(data ?? {});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const body = await request.json();
	const action = String(body?.action ?? '').trim();
	if (!action) throw error(400, 'Missing action');

	const permissionAction = action === 'listRoles' ? 'roles' : action;
	const ctx = await requireApiKeySiteAccess(request, siteId, { users: [permissionAction] });
	const base = normalizeConnectorBase(ctx.connectorFqdn);

	switch (action) {
		case 'create': {
			const { username, email, password, role } = body ?? {};
			if (!username || !email) throw error(400, 'Missing username or email');
			const payload = {
				username,
				email,
				password: password || undefined,
				role: role || undefined
			};
			const { data } = await axios.post(baseUsers(base, ctx.siteId), payload, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		case 'update': {
			const { user_login, display_name, email } = body ?? {};
			if (!user_login) throw error(400, 'Missing user_login');
			const payload = {
				display_name: display_name || undefined,
				email: email || undefined
			};
			const { data } = await axios.post(`${baseUsers(base, ctx.siteId)}/${user_login}`, payload, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? { ok: true });
		}
		case 'roles': {
			const { user_login, role } = body ?? {};
			if (!user_login || !role) throw error(400, 'Missing user_login or role');
			const payload = { role };
			const { data } = await axios.post(
				`${baseUsers(base, ctx.siteId)}/${user_login}/role`,
				payload,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` } }
			);
			return json(data ?? { ok: true });
		}
		case 'resetPassword': {
			const { user_login, password } = body ?? {};
			if (!user_login || !password) throw error(400, 'Missing user_login or password');
			const payload = { user_login, password };
			const { data } = await axios.post(
				`${baseUsers(base, ctx.siteId)}/${user_login}/password`,
				payload,
				{ headers: { Authorization: `Bearer ${ctx.connectorToken}` } }
			);
			return json(data ?? { ok: true });
		}
		case 'delete': {
			const { user_login, reassign } = body ?? {};
			if (!user_login) throw error(400, 'Missing user_login');
			const payload = { user_login, reassign: reassign || undefined };
			const { data } = await axios.delete(`${baseUsers(base, ctx.siteId)}/${user_login}`, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` },
				data: payload
			});
			return json(data ?? { ok: true });
		}
		case 'listRoles': {
			const { data } = await axios.get(`${base}/api/sites/${ctx.siteId}/roles`, {
				headers: { Authorization: `Bearer ${ctx.connectorToken}` }
			});
			return json(data ?? {});
		}
		default:
			throw error(400, 'Unsupported action');
	}
};
