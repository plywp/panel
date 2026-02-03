import type { PageServerLoad } from './$types';
import { auth } from '$lib/auth';

export const load: PageServerLoad = async ({ params, request }) => {
	const users = await auth.api.listUsers({
		query: {
			limit: 1,
			filterField: 'id',
			filterValue: params.id,
			filterOperator: 'eq'
		},
		headers: request.headers
	});

	//console.log(users.users[0]);

	if (!users || users?.total === 0) {
		return { user: null, error: 'User not found' };
	}

	return { user: users?.users[0], error: null };
};
