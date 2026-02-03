import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import axios from 'axios';
import { requireSiteCtx } from '$lib/site-context';
import { connectorClient } from '$lib/connector-client';

export type PluginInfo = {
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

function mergeByName<T extends { name: string }>(lists: T[][]): T[] {
	const map = new Map<string, T>();
	for (const list of lists) {
		for (const item of list) {
			if (!item?.name) continue;
			map.set(item.name, item);
		}
	}
	return Array.from(map.values());
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

	let plugins: PluginInfo[] = [];
	let pluginsError: string | null = null;

	try {
		const [activeRes, inactiveRes] = await Promise.all([
			api.get(`/api/sites/${ctx.site.id}/plugins`, { params: { status: 'active' } }),
			api.get(`/api/sites/${ctx.site.id}/plugins`, { params: { status: 'inactive' } })
		]);

		const active = asList<PluginInfo>(activeRes.data, 'plugins');
		const inactive = asList<PluginInfo>(inactiveRes.data, 'plugins');
		plugins = mergeByName([active, inactive]);
	} catch (err) {
		pluginsError = extractError(err, 'Failed to load plugins');
		plugins = [];
	}

	return {
		plugins,
		pluginsError
	};
};

export const actions: Actions = {
	installPlugin: async ({ params, locals, request }) => {
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

			await api.post(`/api/sites/${ctx.site.id}/plugins/install`, payload);

			return {
				type: 'success',
				message: `Plugin install started for ${source}`
			} satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to install plugin');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	activatePlugin: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const plugin = mustStr(fd.get('plugin'), 'plugin');

			await api.post(`/api/sites/${ctx.site.id}/plugins/${encodeURIComponent(plugin)}/activate`);

			return { type: 'success', message: `Activated ${plugin}` } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to activate plugin');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	deactivatePlugin: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const plugin = mustStr(fd.get('plugin'), 'plugin');

			await api.post(`/api/sites/${ctx.site.id}/plugins/${encodeURIComponent(plugin)}/deactivate`);

			return { type: 'success', message: `Deactivated ${plugin}` } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to deactivate plugin');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	deletePlugin: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const plugin = mustStr(fd.get('plugin'), 'plugin');

			await api.delete(`/api/sites/${ctx.site.id}/plugins/${encodeURIComponent(plugin)}`);

			return { type: 'success', message: `Deleted ${plugin}` } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to delete plugin');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	},

	updatePlugins: async ({ params, locals, request }) => {
		try {
			const ctx = await requireSiteCtx(params, locals);
			const api = connectorClient(ctx.base, ctx.connectorToken);

			const fd = await request.formData();
			const plugin = optStr(fd.get('plugin')) || 'all';
			const version = optStr(fd.get('version'));
			const exclude = fd
				.getAll('exclude')
				.map((v) => (typeof v === 'string' ? v.trim() : ''))
				.filter(Boolean);

			const payload = {
				plugin,
				exclude: exclude.length ? exclude : undefined,
				version: version || undefined
			};

			await api.post(`/api/sites/${ctx.site.id}/plugins/update`, payload);

			const message = plugin === 'all' ? 'Plugin updates started' : `Updating ${plugin}`;

			return { type: 'success', message } satisfies ActionResult;
		} catch (err) {
			const message = extractError(err, 'Failed to update plugins');
			return fail(400, { type: 'failure', message } satisfies ActionResult);
		}
	}
};
