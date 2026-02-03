import { error } from '@sveltejs/kit';
import { auth } from '$lib/auth';

export type ApiKeyPermissions = Record<string, string[]>;

export type OrgApiKeyMetadata = {
	orgId: string;
	allowedSiteIds: string[];
	label?: string;
	createdByUserId: string;
};

export type AdminApiKeyMetadata = {
	kind: 'admin';
	label?: string;
	createdByUserId: string;
};

export type VerifiedOrgApiKey = {
	apiKeyId: string;
	userId: string;
	permissions: ApiKeyPermissions | null;
	metadata: OrgApiKeyMetadata;
};

export type VerifiedAdminApiKey = {
	apiKeyId: string;
	userId: string;
	permissions: ApiKeyPermissions | null;
	metadata: AdminApiKeyMetadata;
};

export function parseApiKeyMetadata(value: unknown): OrgApiKeyMetadata | null {
	if (!value) return null;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as OrgApiKeyMetadata;
		} catch {
			return null;
		}
	}
	if (typeof value === 'object') return value as OrgApiKeyMetadata;
	return null;
}

export function parseAdminApiKeyMetadata(value: unknown): AdminApiKeyMetadata | null {
	if (!value) return null;
	let parsed: unknown = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value) as AdminApiKeyMetadata;
		} catch {
			return null;
		}
	}
	if (!parsed || typeof parsed !== 'object') return null;
	const meta = parsed as AdminApiKeyMetadata;
	if (meta.kind !== 'admin') return null;
	if (!meta.createdByUserId) return null;
	return meta;
}

export async function verifyOrgApiKeyOrThrow(
	request: Request,
	{
		orgId,
		requiredPermissions,
		targetSiteId
	}: {
		orgId: string;
		requiredPermissions?: ApiKeyPermissions;
		targetSiteId?: string;
	}
): Promise<VerifiedOrgApiKey> {
	const headerKey = request.headers.get('x-api-key')?.trim();
	const authHeader = request.headers.get('authorization')?.trim();
	const bearerKey =
		authHeader && authHeader.toLowerCase().startsWith('bearer ')
			? authHeader.slice(7).trim()
			: null;
	const rawKey = headerKey || bearerKey;
	if (!rawKey) throw error(401, 'Unauthorized');

	const result = await auth.api.verifyApiKey({
		body: {
			key: rawKey,
			permissions: requiredPermissions
		}
	});

	if (!result.valid || !result.key) {
		throw error(401, result.error?.message ?? 'Unauthorized');
	}

	const metadata = parseApiKeyMetadata(result.key.metadata);
	if (!metadata?.orgId || metadata.orgId !== orgId) {
		throw error(403, 'Forbidden');
	}

	const allowedSiteIds = Array.isArray(metadata.allowedSiteIds) ? metadata.allowedSiteIds : [];

	if (targetSiteId) {
		const isAllSites = allowedSiteIds.length === 1 && allowedSiteIds[0] === '*';
		if (!isAllSites && !allowedSiteIds.includes(targetSiteId)) {
			throw error(403, 'Forbidden');
		}
	}

	return {
		apiKeyId: result.key.id,
		userId: result.key.userId,
		permissions: result.key.permissions ?? null,
		metadata
	};
}

export async function verifyAdminApiKeyOrThrow(
	request: Request,
	{ requiredPermissions }: { requiredPermissions?: ApiKeyPermissions } = {}
): Promise<VerifiedAdminApiKey> {
	const headerKey = request.headers.get('x-api-key')?.trim();
	const authHeader = request.headers.get('authorization')?.trim();
	const bearerKey =
		authHeader && authHeader.toLowerCase().startsWith('bearer ')
			? authHeader.slice(7).trim()
			: null;
	const rawKey = headerKey || bearerKey;
	if (!rawKey) throw error(401, 'Unauthorized');

	const result = await auth.api.verifyApiKey({
		body: {
			key: rawKey,
			permissions: requiredPermissions
		}
	});

	if (!result.valid || !result.key) {
		throw error(401, result.error?.message ?? 'Unauthorized');
	}

	const metadata = parseAdminApiKeyMetadata(result.key.metadata);
	if (!metadata) {
		throw error(403, 'Forbidden');
	}

	return {
		apiKeyId: result.key.id,
		userId: result.key.userId,
		permissions: result.key.permissions ?? null,
		metadata
	};
}
