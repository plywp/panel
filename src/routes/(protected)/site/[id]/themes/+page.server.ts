import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import axios from 'axios';
import { requireSiteCtx } from '$lib/site-context';
import { connectorClient } from '$lib/connector-client';

export type ThemeInfo = {
	name: string;
	status: string;
	version: string;
	update?: string | null;
};

type ActionResult = {
	type: 'success' | 'failure';
	message: string;
	data?: unknown;
};

function asList<T>(data: unknown, key: string): T[] {
	if (Array.isArray(data)) return data as T[];
	if (data && typeof data === 'object' && key in data) {
		const value = (data as Record<string, unknown>)[key];
		if (Array.isArray(value)) return value as T[];
	}
	return [];
}

function optStr(v: FormDataEntryValue | null) {
	return typeof v === 'string' ? v.trim() : '';
}

function mustStr(v: FormDataEntryValue | null, field: string) {
	const value = optStr(v);
	if (!value) throw new Error(`${field} is required`);
	return value;
}

function asBool(v: FormDataEntryValue | null) {
	if (v == null) return false;
	if (typeof v !== 'string') return true;
	const s = v.trim().toLowerCase();
	return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

function extractError(err: unknown, fallback: string) {
	if (axios.isAxiosError(err)) {
		return (
			(err.response?.data as any)?.message ??
			(err.response?.data as any)?.error ??
			err.message ??
			fallback
		);
	}
	if (err instanceof Error) return err.message || fallback;
	if (typeof err === 'string') return err;
	return fallback;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const ctx = await requireSiteCtx(params, locals);
	const api = connectorClient(ctx.base, ctx.connectorToken);

	let themes: ThemeInfo[] = [];
	let themesError: string | null = null;
	let isMultisite = false;

	try {
		const res = await api.get(`/api/sites/${ctx.site.id}/themes`);
		themes = asList<ThemeInfo>(res.data, 'themes');
		if (res.data && typeof res.data === 'object') {
			const raw = res.data as Record<string, unknown>;
			if (typeof raw.multisite === 'boolean') isMultisite = raw.multisite;
			if (typeof raw.isMultisite === 'boolean') isMultisite = raw.isMultisite;
		}
	} catch (err) {
		themesError = extractError(err, 'Failed to load themes');
		themes = [];
	}

	if (!isMultisite) {
		isMultisite = themes.some((theme) => /network|multisite/i.test(theme.status));
	}

	return {
		themes,
		themesError,
		isMultisite
	};
};

export const actions: Actions = {
	installTheme: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const source = mustStr(fd.get('source'), 'source');
			const version = optStr(fd.get('version'));
			const activate = asBool(fd.get('activate'));
			const force = asBool(fd.get('force'));

			const payload = {
				source,
				activate: activate || undefined,
				force: force || undefined,
				version: version || undefined
			};

			await api.post(`/api/sites/${ctx.site.id}/themes/install`, payload);

			return {
				type: 'success',
				message: `Theme install started for ${source}`
			} satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to install theme');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	activateTheme: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const theme = mustStr(fd.get('theme'), 'theme');

			await api.post(`/api/sites/${ctx.site.id}/themes/${encodeURIComponent(theme)}/activate`);

			return { type: 'success', message: `Activated ${theme}` } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to activate theme');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	deleteTheme: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const theme = mustStr(fd.get('theme'), 'theme');

			await api.delete(`/api/sites/${ctx.site.id}/themes/${encodeURIComponent(theme)}`);

			return { type: 'success', message: `Deleted ${theme}` } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to delete theme');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	updateThemes: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const theme = optStr(fd.get('theme')) || 'all';
			const version = optStr(fd.get('version'));
			const exclude = fd
				.getAll('exclude')
				.map((v) => (typeof v === 'string' ? v.trim() : ''))
				.filter(Boolean);

			const payload = {
				theme,
				exclude: exclude.length ? exclude : undefined,
				version: version || undefined
			};

			await api.post(`/api/sites/${ctx.site.id}/themes/update`, payload);

			const message = theme === 'all' ? 'Theme updates started' : `Updating ${theme}`;

			return { type: 'success', message } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to update themes');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	enableTheme: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const theme = mustStr(fd.get('theme'), 'theme');
			const network = asBool(fd.get('network'));
			const activate = asBool(fd.get('activate'));

			const payload = {
				network: network || undefined,
				activate: activate || undefined
			};

			await api.post(
				`/api/sites/${ctx.site.id}/themes/${encodeURIComponent(theme)}/enable`,
				payload
			);

			return { type: 'success', message: `Network-enabled ${theme}` } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to enable theme');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	}
};
