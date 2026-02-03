import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import {
	parseAdminApiKeyMetadata,
	type AdminApiKeyMetadata,
	type ApiKeyPermissions
} from '$lib/server/auth/api-keys';

const parsePermissions = (form: FormData): ApiKeyPermissions => {
	const entries = form.getAll('perm');
	const permissions: ApiKeyPermissions = {};
	for (const entry of entries) {
		const value = String(entry);
		const [resource, action] = value.split(':');
		if (!resource || !action) continue;
		if (!permissions[resource]) permissions[resource] = [];
		permissions[resource].push(action);
	}
	for (const key of Object.keys(permissions)) {
		permissions[key] = Array.from(new Set(permissions[key]));
		if (!permissions[key].length) delete permissions[key];
	}
	delete permissions.apiKeys;
	return permissions;
};

const parseNumber = (value: FormDataEntryValue | null): number | undefined => {
	if (value === null) return undefined;
	const trimmed = String(value).trim();
	if (!trimmed) return undefined;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseExpiresInDays = (value: FormDataEntryValue | null): number | undefined => {
	const parsed = parseNumber(value);
	if (!parsed || parsed <= 0) return undefined;
	return Math.floor(parsed * 24 * 60 * 60);
};

const validateNonNegative = (value: number | undefined, field: string): string | null => {
	if (value !== undefined && value < 0) {
		return `${field} must be 0 or greater.`;
	}
	return null;
};

const validatePositive = (value: number | undefined, field: string): string | null => {
	if (value !== undefined && value <= 0) {
		return `${field} must be greater than 0.`;
	}
	return null;
};

type SessionBundle = NonNullable<App.Locals['session']>;

const requireAdminSession = (locals: App.Locals): SessionBundle => {
	const session = locals.session;
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	if (session.user.role !== 'admin') throw error(403, 'Forbidden');
	return session;
};

const toIso = (value: Date | string | null): string | null => {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
};

const parsePermissionsJson = (value: unknown): ApiKeyPermissions | null => {
	if (!value) return null;
	if (typeof value === 'object') return value as ApiKeyPermissions;
	try {
		return JSON.parse(String(value)) as ApiKeyPermissions;
	} catch {
		return null;
	}
};

const listAdminKeys = async (headers: Headers, userId: string) => {
	const keys = await auth.api.listApiKeys({ headers });
	const list = Array.isArray(keys) ? keys : [];
	return list.flatMap((key) => {
		if (key.userId !== userId) return [];
		const metadata = parseAdminApiKeyMetadata(key.metadata);
		if (!metadata) return [];
		return [
			{
				id: key.id,
				name: key.name ?? metadata.label ?? null,
				prefix: key.prefix ?? null,
				start: key.start ?? null,
				enabled: key.enabled ?? true,
				permissions: parsePermissionsJson(key.permissions ?? null),
				metadata,
				expiresAt: toIso(key.expiresAt ?? null),
				rateLimitEnabled: key.rateLimitEnabled ?? null,
				rateLimitMax: key.rateLimitMax ?? null,
				rateLimitTimeWindow: key.rateLimitTimeWindow ?? null,
				remaining: key.remaining ?? null,
				refillAmount: key.refillAmount ?? null,
				refillInterval: key.refillInterval ?? null,
				lastRefillAt: toIso(key.lastRefillAt ?? null),
				createdAt: toIso(key.createdAt) ?? '',
				updatedAt: toIso(key.updatedAt) ?? ''
			}
		];
	});
};

const getAdminKeyOrThrow = async (headers: Headers, userId: string, keyId: string) => {
	const key = await auth.api.getApiKey({
		query: { id: keyId },
		headers
	});

	if (!key || key.userId !== userId) throw error(404, 'API key not found');
	const metadata = parseAdminApiKeyMetadata(key.metadata);
	if (!metadata) throw error(404, 'API key not found');
	return {
		key: {
			...key,
			permissions: parsePermissionsJson(key.permissions ?? null),
			expiresAt: toIso(key.expiresAt ?? null),
			lastRefillAt: toIso(key.lastRefillAt ?? null),
			createdAt: toIso(key.createdAt),
			updatedAt: toIso(key.updatedAt)
		},
		metadata
	};
};

export const load: PageServerLoad = async ({ locals, request }) => {
	const session = requireAdminSession(locals);
	return {
		keys: await listAdminKeys(request.headers, session.user.id)
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const session = requireAdminSession(locals);

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();

		const permissions = parsePermissions(form);
		if (!Object.keys(permissions).length) return fail(400, { error: 'Select permissions.' });

		const expiresIn = parseExpiresInDays(form.get('expiresInDays'));
		const remaining = parseNumber(form.get('remaining'));
		const refillAmount = parseNumber(form.get('refillAmount'));
		const refillInterval = parseNumber(form.get('refillInterval'));
		const rateLimitEnabled = form.get('rateLimitEnabled') === 'true' ? true : undefined;
		const rateLimitMax = parseNumber(form.get('rateLimitMax'));
		const rateLimitTimeWindow = parseNumber(form.get('rateLimitTimeWindow'));

		const createValidationError =
			validateNonNegative(remaining, 'Remaining requests') ??
			validateNonNegative(refillAmount, 'Refill amount') ??
			validateNonNegative(refillInterval, 'Refill interval');
		if (createValidationError) return fail(400, { error: createValidationError });

		if (rateLimitEnabled) {
			if (rateLimitMax === undefined || rateLimitTimeWindow === undefined) {
				return fail(400, { error: 'Rate limit requires both max requests and window values.' });
			}
			const rateValidationError =
				validatePositive(rateLimitMax, 'Rate limit max') ??
				validatePositive(rateLimitTimeWindow, 'Rate limit window');
			if (rateValidationError) return fail(400, { error: rateValidationError });
		}

		const created = await auth.api.createApiKey({
			body: {
				name: name || undefined,
				userId: session.user.id,
				expiresIn: expiresIn ?? undefined,
				permissions,
				metadata: {
					kind: 'admin',
					label: name || undefined,
					createdByUserId: session.user.id
				} satisfies AdminApiKeyMetadata,
				remaining: remaining ?? undefined,
				refillAmount: refillAmount ?? undefined,
				refillInterval: refillInterval ?? undefined,
				rateLimitEnabled,
				rateLimitTimeWindow: rateLimitTimeWindow ?? undefined,
				rateLimitMax: rateLimitMax ?? undefined
			}
		});

		return {
			success: true,
			fullKey: created.key,
			keyId: created.id,
			keys: await listAdminKeys(request.headers, session.user.id)
		};
	},
	update: async ({ locals, request }) => {
		const session = requireAdminSession(locals);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		const { metadata: existingMetadata } = await getAdminKeyOrThrow(
			request.headers,
			session.user.id,
			keyId
		);

		const name = String(form.get('name') ?? '').trim();

		const permissions = parsePermissions(form);
		if (!Object.keys(permissions).length) return fail(400, { error: 'Select permissions.' });

		const expiresIn = parseExpiresInDays(form.get('expiresInDays'));
		const remaining = parseNumber(form.get('remaining'));
		const refillAmount = parseNumber(form.get('refillAmount'));
		const refillInterval = parseNumber(form.get('refillInterval'));
		const rateLimitEnabled = form.get('rateLimitEnabled') === 'true';
		const rateLimitMax = parseNumber(form.get('rateLimitMax'));
		const rateLimitTimeWindow = parseNumber(form.get('rateLimitTimeWindow'));
		const enabled = form.get('enabled') === 'true';

		const updateValidationError =
			validateNonNegative(remaining, 'Remaining requests') ??
			validateNonNegative(refillAmount, 'Refill amount') ??
			validateNonNegative(refillInterval, 'Refill interval');
		if (updateValidationError) return fail(400, { error: updateValidationError });

		if (rateLimitEnabled) {
			if (rateLimitMax === undefined || rateLimitTimeWindow === undefined) {
				return fail(400, { error: 'Rate limit requires both max requests and window values.' });
			}
			const rateValidationError =
				validatePositive(rateLimitMax, 'Rate limit max') ??
				validatePositive(rateLimitTimeWindow, 'Rate limit window');
			if (rateValidationError) return fail(400, { error: rateValidationError });
		}

		await auth.api.updateApiKey({
			body: {
				keyId,
				userId: session.user.id,
				name: name || undefined,
				enabled,
				permissions,
				expiresIn: expiresIn ?? null,
				metadata: {
					...existingMetadata,
					label: name || undefined
				} satisfies AdminApiKeyMetadata,
				remaining: remaining ?? undefined,
				refillAmount: refillAmount ?? undefined,
				refillInterval: refillInterval ?? undefined,
				rateLimitEnabled,
				rateLimitTimeWindow: rateLimitTimeWindow ?? undefined,
				rateLimitMax: rateLimitMax ?? undefined
			}
		});

		return { success: true, keys: await listAdminKeys(request.headers, session.user.id) };
	},
	toggle: async ({ locals, request }) => {
		const session = requireAdminSession(locals);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		const enabled = form.get('enabled') === 'true';
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		await getAdminKeyOrThrow(request.headers, session.user.id, keyId);
		await auth.api.updateApiKey({
			body: { keyId, enabled, userId: session.user.id }
		});

		return { success: true, keys: await listAdminKeys(request.headers, session.user.id) };
	},
	delete: async ({ locals, request }) => {
		const session = requireAdminSession(locals);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		await getAdminKeyOrThrow(request.headers, session.user.id, keyId);
		await auth.api.deleteApiKey({
			body: { keyId },
			headers: request.headers
		});

		return { success: true, keys: await listAdminKeys(request.headers, session.user.id) };
	},
	rotate: async ({ locals, request }) => {
		const session = requireAdminSession(locals);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		const { key, metadata } = await getAdminKeyOrThrow(request.headers, session.user.id, keyId);
		const expiresIn =
			key.expiresAt && !Number.isNaN(new Date(key.expiresAt).getTime())
				? Math.floor((new Date(key.expiresAt).getTime() - Date.now()) / 1000)
				: undefined;

		const created = await auth.api.createApiKey({
			body: {
				name: key.name ?? metadata.label ?? undefined,
				userId: session.user.id,
				permissions: key.permissions ?? undefined,
				expiresIn: expiresIn && expiresIn > 0 ? expiresIn : undefined,
				metadata: {
					...metadata,
					createdByUserId: session.user.id
				} satisfies AdminApiKeyMetadata,
				remaining: key.remaining ?? undefined,
				refillAmount: key.refillAmount ?? undefined,
				refillInterval: key.refillInterval ?? undefined,
				rateLimitEnabled: key.rateLimitEnabled ?? undefined,
				rateLimitTimeWindow: key.rateLimitTimeWindow ?? undefined,
				rateLimitMax: key.rateLimitMax ?? undefined
			}
		});

		await auth.api.deleteApiKey({
			body: { keyId },
			headers: request.headers
		});

		return {
			success: true,
			fullKey: created.key,
			keyId: created.id,
			keys: await listAdminKeys(request.headers, session.user.id)
		};
	},
	refresh: async ({ locals, request }) => {
		const session = requireAdminSession(locals);
		return { success: true, keys: await listAdminKeys(request.headers, session.user.id) };
	}
};
