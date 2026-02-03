import { createAuthClient } from 'better-auth/svelte';

import { adminClient, organizationClient, apiKeyClient  } from 'better-auth/client/plugins';

export const client = createAuthClient({
	plugins: [adminClient(), organizationClient(), apiKeyClient()]
});
export const { signIn, signUp, useSession, signOut } = client;
