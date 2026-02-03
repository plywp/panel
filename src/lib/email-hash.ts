async function hashEmail(email: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(email);

	const buffer = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(buffer);

	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getGravatar(email: string): Promise<string> {
	const hash = await hashEmail(email);
	return `https://www.gravatar.com/avatar/${hash}`;
}

export { getGravatar as hashEmail, hashEmail as rawHash };
