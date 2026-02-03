import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organization, wp_site } from '$lib/server/db/schema/auth-schema';
import { requireOrgAdminFromSession, requireSessionFromLocals } from '$lib/server/orgs';
import { auth } from '$lib/auth';
import { parseApiKeyMetadata, type ApiKeyPermissions } from '$lib/server/auth/api-keys';

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
	return permissions;
};

const parseAllowedSiteIds = (form: FormData): string[] | null => {
	const scopeAll = form.get('scopeAll');
	if (scopeAll === 'true') return ['*'];
	const ids = form
		.getAll('allowedSiteIds')
		.map((entry) => String(entry))
		.filter(Boolean);
	return ids.length ? ids : null;
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

const listOrgKeys = async (headers: Headers, orgId: string) => {
	const keys = await auth.api.listApiKeys({ headers });
	return (Array.isArray(keys) ? keys : []).flatMap((key) => {
		const metadata = parseApiKeyMetadata(key.metadata);
		if (!metadata || metadata.orgId !== orgId) return [];
		return [
			{
				id: key.id,
				name: key.name ?? metadata.label ?? null,
				prefix: key.prefix ?? null,
				start: key.start ?? null,
				enabled: key.enabled ?? true,
				permissions: key.permissions ?? null,
				metadata,
				expiresAt: key.expiresAt ?? null,
				rateLimitEnabled: key.rateLimitEnabled ?? null,
				rateLimitMax: key.rateLimitMax ?? null,
				rateLimitTimeWindow: key.rateLimitTimeWindow ?? null,
				remaining: key.remaining ?? null,
				refillAmount: key.refillAmount ?? null,
				refillInterval: key.refillInterval ?? null,
				lastRefillAt: key.lastRefillAt ?? null,
				createdAt: key.createdAt,
				updatedAt: key.updatedAt
			}
		];
	});
};

const getOrgKeyOrThrow = async (headers: Headers, orgId: string, keyId: string) => {
	const key = await auth.api.getApiKey({
		query: { id: keyId },
		headers
	});
	if (!key) throw error(404, 'API key not found');
	const metadata = parseApiKeyMetadata(key.metadata);
	if (!metadata || metadata.orgId !== orgId) throw error(404, 'API key not found');
	return { key, metadata };
};

export const load: PageServerLoad = async ({ params, locals, request }) => {
	const orgId = params.orgId?.trim();
	if (!orgId) throw error(400, 'Invalid organization ID');

	const session = requireSessionFromLocals(locals);
	const role = await requireOrgAdminFromSession(session, orgId);

	const org = await db.query.organization.findFirst({
		where: eq(organization.id, orgId)
	});
	if (!org) throw error(404, 'Organization not found');

	const sites = await db
		.select({ id: wp_site.id, name: wp_site.name, domain: wp_site.domain })
		.from(wp_site)
		.where(eq(wp_site.organizationId, orgId));

	return {
		org: { id: org.id, name: org.name, slug: org.slug },
		sites,
		role,
		keys: await listOrgKeys(request.headers, orgId)
	};
};

export const actions: Actions = {
	create: async ({ params, locals, request }) => {
		const orgId = params.orgId?.trim();
		if (!orgId) throw error(400, 'Invalid organization ID');

		const session = requireSessionFromLocals(locals);
		await requireOrgAdminFromSession(session, orgId);

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const allowedSiteIds = parseAllowedSiteIds(form);
		if (!allowedSiteIds) return fail(400, { error: 'Select at least one site.' });

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
					orgId,
					allowedSiteIds,
					label: name || undefined,
					createdByUserId: session.user.id
				},
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
			keys: await listOrgKeys(request.headers, orgId)
		};
	},
	update: async ({ params, locals, request }) => {
		const orgId = params.orgId?.trim();
		if (!orgId) throw error(400, 'Invalid organization ID');

		const session = requireSessionFromLocals(locals);
		await requireOrgAdminFromSession(session, orgId);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		const { metadata: existingMetadata } = await getOrgKeyOrThrow(request.headers, orgId, keyId);

		const name = String(form.get('name') ?? '').trim();
		const allowedSiteIds = parseAllowedSiteIds(form);
		if (!allowedSiteIds) return fail(400, { error: 'Select at least one site.' });

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
					orgId,
					allowedSiteIds,
					label: name || undefined
				},
				remaining: remaining ?? undefined,
				refillAmount: refillAmount ?? undefined,
				refillInterval: refillInterval ?? undefined,
				rateLimitEnabled,
				rateLimitTimeWindow: rateLimitTimeWindow ?? undefined,
				rateLimitMax: rateLimitMax ?? undefined
			}
		});

		return { success: true, keys: await listOrgKeys(request.headers, orgId) };
	},
	toggle: async ({ params, locals, request }) => {
		const orgId = params.orgId?.trim();
		if (!orgId) throw error(400, 'Invalid organization ID');

		const session = requireSessionFromLocals(locals);
		await requireOrgAdminFromSession(session, orgId);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		const enabled = form.get('enabled') === 'true';
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		await getOrgKeyOrThrow(request.headers, orgId, keyId);
		await auth.api.updateApiKey({
			body: { keyId, enabled, userId: session.user.id }
		});

		return { success: true, keys: await listOrgKeys(request.headers, orgId) };
	},
	delete: async ({ params, locals, request }) => {
		const orgId = params.orgId?.trim();
		if (!orgId) throw error(400, 'Invalid organization ID');

		const session = requireSessionFromLocals(locals);
		await requireOrgAdminFromSession(session, orgId);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		await getOrgKeyOrThrow(request.headers, orgId, keyId);
		await auth.api.deleteApiKey({ body: { keyId }, headers: request.headers });

		return { success: true, keys: await listOrgKeys(request.headers, orgId) };
	},
	rotate: async ({ params, locals, request }) => {
		const orgId = params.orgId?.trim();
		if (!orgId) throw error(400, 'Invalid organization ID');

		const session = requireSessionFromLocals(locals);
		await requireOrgAdminFromSession(session, orgId);

		const form = await request.formData();
		const keyId = String(form.get('keyId') ?? '').trim();
		if (!keyId) return fail(400, { error: 'Missing key ID.' });

		const { key, metadata } = await getOrgKeyOrThrow(request.headers, orgId, keyId);
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
					orgId,
					createdByUserId: session.user.id
				},
				remaining: key.remaining ?? undefined,
				refillAmount: key.refillAmount ?? undefined,
				refillInterval: key.refillInterval ?? undefined,
				rateLimitEnabled: key.rateLimitEnabled ?? undefined,
				rateLimitTimeWindow: key.rateLimitTimeWindow ?? undefined,
				rateLimitMax: key.rateLimitMax ?? undefined
			}
		});

		await auth.api.deleteApiKey({ body: { keyId }, headers: request.headers });

		return {
			success: true,
			fullKey: created.key,
			keyId: created.id,
			keys: await listOrgKeys(request.headers, orgId)
		};
	},
	refresh: async ({ params, locals, request }) => {
		const orgId = params.orgId?.trim();
		if (!orgId) throw error(400, 'Invalid organization ID');

		const session = requireSessionFromLocals(locals);
		await requireOrgAdminFromSession(session, orgId);

		return { success: true, keys: await listOrgKeys(request.headers, orgId) };
	}
};
