import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { member } from '$lib/server/db/schema/auth-schema';

export type OrgRole = 'owner' | 'admin' | 'member';

type SessionBundle = NonNullable<App.Locals['session']>;

export async function requireOrgAdminFromSession(
	session: App.Locals['session'],
	orgId: string
): Promise<OrgRole> {
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	if (session.user.role === 'admin') return 'admin';

	const rows = await db
		.select({ role: member.role })
		.from(member)
		.where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)))
		.limit(1);

	const role = rows[0]?.role as OrgRole | undefined;
	if (!role) throw error(403, 'Forbidden');
	if (role !== 'owner' && role !== 'admin') throw error(403, 'Forbidden');
	return role;
}

export function requireSessionFromLocals(locals: App.Locals): SessionBundle {
	const session = locals.session;
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	return session;
}
