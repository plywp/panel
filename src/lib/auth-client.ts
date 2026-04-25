import { createAuthClient } from 'better-auth/svelte';

import { adminClient, organizationClient } from 'better-auth/client/plugins';
import { apiKeyClient } from "@better-auth/api-key/client"

export const client = createAuthClient({
	plugins: [adminClient(), organizationClient(), apiKeyClient()]
});
export const { signIn, signUp, useSession, signOut } = client;
