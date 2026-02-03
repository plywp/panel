import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { connectorFileManagerEntriesUrl } from '$lib/connector-url';
import { eq } from 'drizzle-orm';
import type { FileEntry } from '$lib/components/file-manager/types.js';
import axios, { AxiosError } from 'axios';
import FormDataNode from 'form-data';

// ---------- Types ----------
type SessionBundle = NonNullable<App.Locals['session']>;

type ConnectorEntriesResponse = {
	entries: FileEntry[];
	error?: string;
};

type ConnectorReadResponse = {
	content: string;
	error?: string;
};

type ReadPayload = {
	kind: 'text' | 'base64';
	content: string;
};

type CopyResult = {
	ok: { source: string; dest: string }[];
	failed: { source: string; error: string }[];
};

// ---------- Auth / Access ----------
function requireSession(locals: App.Locals): SessionBundle {
	const session = locals.session;
	if (!session?.user?.id) throw error(401, 'Unauthorized');
	if (session.user.banned) throw error(403, 'Banned');
	return session;
}

function canAccessSite(session: SessionBundle, siteOrgId: string): boolean {
	if (session.user.role === 'admin') return true;
	return session.session.activeOrganizationId === siteOrgId;
}

// ---------- Helpers ----------
function normalizePath(input: string): string {
	const p = (input ?? '').trim().replace(/\\/g, '/');
	const cleaned = p.replace(/^\/+|\/+$/g, '');

	if (cleaned.includes('..')) {
		throw error(400, 'Invalid path');
	}

	return cleaned;
}

function assertWithinRoot(path: string, allowedRoot: string) {
	if (!allowedRoot) return;
	if (path === allowedRoot || path.startsWith(`${allowedRoot}/`)) return;
	throw error(400, `Path must stay within ${allowedRoot}`);
}

function splitName(name: string) {
	const idx = name.lastIndexOf('.');
	if (idx <= 0) return { base: name, ext: '' };
	return { base: name.slice(0, idx), ext: name.slice(idx) };
}

function buildName(original: string, n: number) {
	if (n === 0) return original;
	const { base, ext } = splitName(original);
	return `${base} (${n})${ext}`;
}

function toBuffer(data: unknown): Buffer {
	if (Buffer.isBuffer(data)) return data;
	if (data instanceof ArrayBuffer) return Buffer.from(data);
	if (ArrayBuffer.isView(data)) {
		return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
	}
	if (typeof data === 'string') return Buffer.from(data, 'utf8');
	return Buffer.from(String(data ?? ''), 'utf8');
}

function parseJsonBuffer(buf: Buffer) {
	try {
		return JSON.parse(buf.toString('utf8'));
	} catch {
		return null;
	}
}

function getHeader(headers: Record<string, string | string[] | undefined>, name: string) {
	const key = name.toLowerCase();
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() === key) {
			return Array.isArray(v) ? v.join(', ') : (v ?? '');
		}
	}
	return '';
}

function isBase64Encoded(data: any, headers: Record<string, string | string[] | undefined>) {
	const headerEnc =
		getHeader(headers, 'content-transfer-encoding') ||
		getHeader(headers, 'x-content-encoding') ||
		getHeader(headers, 'content-encoding');
	const encoding = String(data?.encoding ?? data?.contentEncoding ?? '').toLowerCase();
	return (
		encoding === 'base64' ||
		data?.isBase64 === true ||
		data?.base64 === true ||
		headerEnc.toLowerCase().includes('base64')
	);
}

function detectReadPayload(data: unknown, headers: Record<string, string | string[] | undefined>) {
	const contentType = getHeader(headers, 'content-type').toLowerCase();

	if (typeof data === 'string') {
		const kind = isBase64Encoded({ content: data }, headers) ? 'base64' : 'text';
		return { kind, content: data } satisfies ReadPayload;
	}

	const buf = toBuffer(data);
	if (contentType.includes('application/json')) {
		const parsed = parseJsonBuffer(buf);
		if (parsed && typeof parsed.content === 'string') {
			const kind = isBase64Encoded(parsed, headers) ? 'base64' : 'text';
			return { kind, content: parsed.content } satisfies ReadPayload;
		}
	}

	const isText =
		contentType.startsWith('text/') ||
		contentType.includes('application/xml') ||
		contentType.includes('application/json') ||
		contentType.includes('application/javascript');

	if (isText) {
		return { kind: 'text', content: buf.toString('utf8') } satisfies ReadPayload;
	}

	return { kind: 'base64', content: buf.toString('base64') } satisfies ReadPayload;
}

function buildWriteRequest(payload: ReadPayload) {
	if (payload.kind === 'base64') {
		return {
			data: { content: payload.content, encoding: 'base64' },
			headers: { 'Content-Type': 'application/json' }
		};
	}
	return {
		data: payload.content,
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	};
}

function getErrorMessage(err: unknown) {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	return 'Unknown error';
}

function isExistsError(err: unknown) {
	if (err && typeof err === 'object' && 'response' in err) {
		const e = err as AxiosError<any>;
		const status = e.response?.status;
		const message =
			e.response?.data?.error ?? e.response?.data?.message ?? e.response?.statusText ?? e.message;
		if (status === 409) return true;
		if (status === 500 && /file exists/i.test(String(message))) return true;
		return /already exists/i.test(String(message));
	}
	return /already exists|file exists/i.test(getErrorMessage(err));
}

async function copyFiles(
	sources: string[],
	destinationDir: string,
	opts: {
		readFile: (path: string) => Promise<ReadPayload>;
		writeFile: (path: string, payload: ReadPayload) => Promise<void>;
		concurrency?: number;
		allowedRoot?: string;
		maxRenameTries?: number;
	}
): Promise<CopyResult> {
	const { readFile, writeFile } = opts;
	const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 16));
	const allowedRoot = normalizePath(opts.allowedRoot ?? '');
	const maxRenameTries = Math.max(1, Math.min(opts.maxRenameTries ?? 50, 200));

	let destDir: string;
	try {
		destDir = normalizePath(destinationDir ?? '');
		assertWithinRoot(destDir, allowedRoot);
	} catch (err) {
		const message = getErrorMessage(err);
		return {
			ok: [],
			failed: sources.map((source) => ({ source, error: message }))
		};
	}

	const ok: CopyResult['ok'] = [];
	const failed: CopyResult['failed'] = [];

	let i = 0;

	const worker = async () => {
		while (true) {
			const idx = i++;
			if (idx >= sources.length) return;
			const rawSource = sources[idx];
			let source = '';
			try {
				source = normalizePath(rawSource);
			} catch (err) {
				failed.push({ source: rawSource, error: getErrorMessage(err) });
				continue;
			}

			const filename = source.split('/').pop() ?? source;
			if (!filename) {
				failed.push({ source, error: 'Invalid source filename' });
				continue;
			}

			try {
				const payload = await readFile(source);

				for (let attempt = 0; attempt <= maxRenameTries; attempt++) {
					const name = buildName(filename, attempt);
					const destPath = destDir ? normalizePath(`${destDir}/${name}`) : normalizePath(name);
					assertWithinRoot(destPath, allowedRoot);

					try {
						await writeFile(destPath, payload);
						ok.push({ source, dest: destPath });
						break;
					} catch (err) {
						if (isExistsError(err) && attempt < maxRenameTries) continue;
						throw err;
					}
				}
			} catch (err) {
				failed.push({ source, error: getErrorMessage(err) });
			}
		}
	};

	const workers = Array.from({ length: Math.min(concurrency, sources.length) }, () => worker());
	await Promise.all(workers);

	return { ok, failed };
}

async function getSiteConnector(locals: App.Locals, siteId: string) {
	const session = requireSession(locals);

	const rows = await db
		.select({
			id: wp_site.id,
			organizationId: wp_site.organizationId,
			connectorFqdn: connector.fqdn,
			connectorToken: connector.token,
			connectorDaemonSslEnabled: connector.daemonSslEnabled
		})
		.from(wp_site)
		.leftJoin(connector, eq(wp_site.connectorId, connector.id))
		.where(eq(wp_site.id, siteId))
		.limit(1);

	const site = rows[0];
	if (!site) throw error(404, 'Site not found');
	if (!canAccessSite(session, site.organizationId)) throw error(403, 'Forbidden');

	if (!site.connectorFqdn || !site.connectorToken) {
		throw error(500, 'Missing connector information');
	}

	return site;
}

// ---------- Business: List ----------
async function listEntriesForSite(locals: App.Locals, siteId: string, path: string) {
	const site = await getSiteConnector(locals, siteId);

	const url = connectorFileManagerEntriesUrl(
		{
			fqdn: site.connectorFqdn,
			daemonSslEnabled: site.connectorDaemonSslEnabled
		},
		site.id,
		path || '/'
	);

	if (!url) return { entries: [] as FileEntry[], entriesError: 'Invalid connector URL', path };

	try {
		const res = await axios.get<ConnectorEntriesResponse>(url, {
			headers: {
				Authorization: `Bearer ${site.connectorToken}`,
				Accept: 'application/json'
			},
			timeout: 10_000
		});

		const data = res.data;
		if (!data || !Array.isArray(data.entries)) {
			return { entries: [] as FileEntry[], entriesError: 'Unexpected file manager response', path };
		}

		return { entries: data.entries, entriesError: null as string | null, path };
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		return { entries: [] as FileEntry[], entriesError: String(message), path };
	}
}

async function readEntryForSite(locals: App.Locals, siteId: string, path: string) {
	const site = await getSiteConnector(locals, siteId);

	const url =
		`${site.connectorFqdn}/api/filemanager/${site.id}/read` +
		`?path=${encodeURIComponent(path || '/')}`;

	//console.log(url);

	try {
		const res = await axios.get<ConnectorReadResponse>(url, {
			headers: {
				Authorization: `Bearer ${site.connectorToken}`
			},
			timeout: 10_000
		});

		const data = res.data;

		return data;
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		return { content: '', readError: String(message), path };
	}
}

async function createFileForSite(locals: App.Locals, id: string, path: string) {
	const site = await getSiteConnector(locals, id);

	const url =
		`${site.connectorFqdn}/api/filemanager/${site.id}/write` + `?path=${encodeURIComponent(path)}`;

	try {
		const res = await axios.post(url, '', {
			headers: {
				Authorization: `Bearer ${site.connectorToken}`
			},
			timeout: 10_000
		});

		const data = res.data;

		return data;
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		return { createError: String(message), path };
	}
}

async function createFolderForSite(locals: App.Locals, id: string, path: string) {
	const site = await getSiteConnector(locals, id);

	//console.log(path)

	const url = `${site.connectorFqdn}/api/filemanager/${site.id}/mkdir`;

	try {
		const res = await axios.post(
			url,
			{
				path
			},
			{
				headers: {
					Authorization: `Bearer ${site.connectorToken}`
				},
				timeout: 10_000
			}
		);

		const data = res.data;

		return data;
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		return { createError: String(message), path };
	}
}

async function moveEntryForSite(locals: App.Locals, id: string, from: string, to: string) {
	const site = await getSiteConnector(locals, id);
	const base = site.connectorFqdn;

	const url = `${base}/api/filemanager/${site.id}/move`;

	try {
		const res = await axios.post(
			url,
			{
				from,
				to
			},
			{
				headers: {
					Authorization: `Bearer ${site.connectorToken}`,
					Accept: 'application/json'
				},
				timeout: 10_000
			}
		);

		return res.data;
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		throw new Error(String(message));
	}
}
async function deleteFileForSite(locals: App.Locals, id: string, path: string) {
	const site = await getSiteConnector(locals, id);
	const base = site.connectorFqdn;

	const url = `${base}/api/filemanager/${site.id}/delete` + `?path=${encodeURIComponent(path)}`;

	try {
		const res = await axios.delete(url, {
			headers: {
				Authorization: `Bearer ${site.connectorToken}`,
				Accept: 'application/json'
			},
			timeout: 10_000
		});

		return res.data;
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		throw new Error(String(message));
	}
}

async function writeFile(locals: App.Locals, id: string, path: string, content: string) {
	const site = await getSiteConnector(locals, id);
	const base = site.connectorFqdn;

	const url = `${base}/api/filemanager/${site.id}/write` + `?path=${encodeURIComponent(path)}`;

	try {
		const res = await axios.post(url, content, {
			headers: {
				Authorization: `Bearer ${site.connectorToken}`,
				Accept: 'application/json'
			},
			timeout: 10_000
		});

		return res.data;
	} catch (err) {
		const e = err as AxiosError<any>;
		const message =
			e.response?.data?.error ?? e.response?.statusText ?? 'Failed to reach connector';

		throw new Error(String(message));
	}
}

async function extractArchiveForSite(
	locals: App.Locals,
	id: string,
	source: string,
	target: string,
	format?: string
) {
	const site = await getSiteConnector(locals, id);
	const base = site.connectorFqdn;

	const url = `${base}/api/filemanager/${site.id}/decompress`;

	const payload: { source: string; target: string; format?: string } = { source, target };
	if (format) payload.format = format;

	const res = await axios.post(url, payload, {
		headers: {
			Authorization: `Bearer ${site.connectorToken}`,
			Accept: 'application/json',
			'Content-Type': 'application/json'
		},
		timeout: 60_000,
		validateStatus: () => true
	});

	return res;
}

// ---------- Load ----------
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const id = params.id?.trim();
	if (!id) throw error(400, 'Invalid site ID');

	const path = normalizePath(url.searchParams.get('path') ?? '');

	const result = await listEntriesForSite(locals, id, path);

	return {
		...result,
		siteId: id
	};
};

// ---------- Actions ----------
export const actions: Actions = {
	list: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { entries: [], entriesError: 'Invalid site ID', path: '' });

		const form = await request.formData();
		const path = normalizePath(String(form.get('path') ?? ''));

		return await listEntriesForSite(locals, id, path);
	},

	read: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { content: '', readError: 'Invalid site ID', path: '' });

		const form = await request.formData();
		const path = normalizePath(String(form.get('path') ?? ''));

		return await readEntryForSite(locals, id, path);
	},
	createFile: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { content: '', readError: 'Invalid site ID', path: '' });

		const form = await request.formData();
		let parentId = form.get('parentId')?.toString() ?? '';
		const name = form.get('name')?.toString() ?? '';

		if (!parentId || !name) {
			throw new Error('Invalid path input');
		}
		if (!parentId.endsWith('/')) {
			parentId = parentId + '/';
		}
		const path = normalizePath(parentId + name);

		return await createFileForSite(locals, id, path);
	},
	createFolder: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { content: '', readError: 'Invalid site ID', path: '' });

		const form = await request.formData();
		//console.log(form)
		let parentId = form.get('parentId')?.toString() ?? '';
		const name = form.get('name')?.toString() ?? '';

		if (!parentId || !name) {
			throw new Error('Invalid path input');
		}
		if (!parentId.endsWith('/')) {
			parentId = parentId + '/';
		}
		const path = normalizePath(parentId + name);

		return await createFolderForSite(locals, id, path);
	},
	rename: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { renameError: 'Invalid site ID' });

		const form = await request.formData();
		const entryId = normalizePath(String(form.get('id') ?? ''));
		const name = String(form.get('name') ?? '').trim();

		if (!entryId || !name) {
			return fail(400, { renameError: 'Invalid rename input' });
		}

		const idx = entryId.lastIndexOf('/');
		const parent = idx >= 0 ? entryId.slice(0, idx) : '';
		const to = parent ? normalizePath(`${parent}/${name}`) : normalizePath(name);

		if (!to || to === entryId) {
			return { ok: true, renamed: false };
		}

		try {
			await moveEntryForSite(locals, id, entryId, to);
			return { ok: true, renamed: true };
		} catch (err) {
			const message =
				err instanceof Error ? err.message : typeof err === 'string' ? err : 'Rename failed';
			return fail(400, { renameError: String(message) });
		}
	},
	move: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { moveError: 'Invalid site ID' });

		const form = await request.formData();
		const destinationId = normalizePath(String(form.get('destinationId') ?? ''));
		const ids = form
			.getAll('ids')
			.map((value) => normalizePath(String(value)))
			.filter(Boolean);

		if (!ids.length) {
			return fail(400, { moveError: 'No items selected' });
		}

		const failed: Array<{ from: string; to?: string; error: string }> = [];
		let moved = 0;

		for (const from of ids) {
			const name = from.split('/').pop() ?? from;
			const to = destinationId ? `${destinationId}/${name}` : name;

			if (!to || to === from) continue;

			try {
				await moveEntryForSite(locals, id, from, to);
				moved += 1;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : typeof err === 'string' ? err : 'Move failed';
				failed.push({ from, to, error: String(message) });
			}
		}

		if (failed.length) {
			return fail(400, {
				moveError: 'Some moves failed',
				failed
			});
		}

		return { ok: true, moved };
	},
	copy: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { copyError: 'Invalid site ID' });

		const form = await request.formData();
		const destinationId = normalizePath(String(form.get('destinationId') ?? ''));
		const ids = form
			.getAll('ids')
			.map((value) => normalizePath(String(value)))
			.filter(Boolean);

		if (!ids.length) {
			return fail(400, { copyError: 'No items selected' });
		}

		const site = await getSiteConnector(locals, id);
		const base =
			site.connectorFqdn.startsWith('http://') || site.connectorFqdn.startsWith('https://')
				? site.connectorFqdn
				: `http://${site.connectorFqdn}`;

		const readFile = async (path: string): Promise<ReadPayload> => {
			const url = `${base}/api/filemanager/${site.id}/read?path=${encodeURIComponent(path)}`;
			try {
				const res = await axios.get(url, {
					headers: { Authorization: `Bearer ${site.connectorToken}` },
					responseType: 'arraybuffer',
					timeout: 15_000
				});
				return detectReadPayload(res.data, res.headers);
			} catch (err) {
				const e = err as AxiosError<any>;
				const message = e.response?.data?.error ?? e.response?.statusText ?? 'Failed to read file';
				throw new Error(String(message));
			}
		};

		const writeFile = async (path: string, payload: ReadPayload): Promise<void> => {
			const url = `${base}/api/filemanager/${site.id}/write?path=${encodeURIComponent(path)}`;
			const req = buildWriteRequest(payload);
			try {
				await axios.post(url, req.data, {
					headers: {
						...req.headers,
						Authorization: `Bearer ${site.connectorToken}`
					},
					timeout: 15_000
				});
			} catch (err) {
				const e = err as AxiosError<any>;
				const message = e.response?.data?.error ?? e.response?.statusText ?? 'Failed to write file';
				throw new Error(String(message));
			}
		};

		const result = await copyFiles(ids, destinationId, {
			readFile,
			writeFile,
			concurrency: 4,
			allowedRoot: ''
		});

		if (result.failed.length > 0) {
			return fail(400, {
				copyError: 'Some files failed to copy',
				failed: result.failed
			});
		}

		return { ok: true, copied: result.ok.length };
	},
	delete: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { deleteError: 'Invalid site ID' });

		const form = await request.formData();

		const paths = form
			.getAll('files')
			.map((v) => normalizePath(String(v)))
			.filter(Boolean);

		if (paths.length === 0) {
			return fail(400, { deleteError: 'No files selected' });
		}
		const BATCH_SIZE = 10;
		const PAUSE_MS = 200;

		const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

		const failed: Array<{ path: string; error: string }> = [];

		for (let i = 0; i < paths.length; i += BATCH_SIZE) {
			const batch = paths.slice(i, i + BATCH_SIZE);

			const results = await Promise.allSettled(batch.map((p) => deleteFileForSite(locals, id, p)));

			results.forEach((r, idx) => {
				if (r.status === 'rejected') {
					const path = batch[idx];
					const msg =
						r.reason instanceof Error
							? r.reason.message
							: typeof r.reason === 'string'
								? r.reason
								: 'Delete failed';
					failed.push({ path, error: msg });
				}
			});
			if (i + BATCH_SIZE < paths.length) {
				await sleep(PAUSE_MS);
			}
		}

		if (failed.length) {
			return fail(400, {
				deleteError: 'Some deletes failed',
				failed
			});
		}

		return { ok: true, deleted: paths.length };
	},
	writeFile: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { deleteError: 'Invalid site ID' });

		const form = await request.formData();
		const path = form.get('path');
		const content = form.get('content');

		if (!path || typeof path !== 'string') {
			return fail(400, { writeError: 'Invalid path' });
		}

		if (!content || typeof content !== 'string') {
			return fail(400, { writeError: 'Invalid content' });
		}

		try {
			await writeFile(locals, id, path, content);
			return { ok: true };
		} catch (err) {
			const message =
				err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to write file';
			return fail(500, { writeError: message });
		}
	},

	upload: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { uploadError: 'Invalid site ID' });

		const site = await getSiteConnector(locals, id);
		const form = await request.formData();

		const dir = normalizePath(String(form.get('path') ?? '') || '/');

		const files = form.getAll('file').filter((v): v is File => v instanceof File);
		if (files.length === 0) return fail(400, { uploadError: 'No files uploaded' });

		const base =
			site.connectorFqdn.startsWith('http://') || site.connectorFqdn.startsWith('https://')
				? site.connectorFqdn
				: `http://${site.connectorFqdn}`;

		const MAX_RENAME_TRIES = 25;

		const splitName = (name: string) => {
			const idx = name.lastIndexOf('.');
			if (idx <= 0) return { base: name, ext: '' };
			return { base: name.slice(0, idx), ext: name.slice(idx) };
		};

		const buildName = (original: string, n: number) => {
			if (n === 0) return original;
			const { base, ext } = splitName(original);
			return `${base} (${n})${ext}`;
		};

		const makeDestPath = (directory: string, filename: string) => {
			if (!directory || directory === '/') return normalizePath(filename);
			return normalizePath(`${directory}/${filename}`);
		};

		const uploadOne = async (file: File) => {
			const buf = Buffer.from(await file.arrayBuffer());

			const FormDataNode = (await import('form-data')).default;

			for (let attempt = 0; attempt <= MAX_RENAME_TRIES; attempt++) {
				const filename = buildName(file.name, attempt);
				const destPath = makeDestPath(dir, filename);

				const url =
					`${base.replace(/\/+$/, '')}/api/filemanager/${encodeURIComponent(site.id)}/upload` +
					`?path=${encodeURIComponent(destPath)}`;

				const fd = new FormDataNode();
				fd.append('file', buf, {
					filename,
					contentType: file.type || 'application/octet-stream',
					knownLength: buf.length
				});

				const res = await axios.post(url, fd, {
					headers: {
						Authorization: `Bearer ${site.connectorToken}`,
						...fd.getHeaders()
					},
					maxBodyLength: Infinity,
					maxContentLength: Infinity,
					timeout: 0,
					validateStatus: () => true
				});

				if (res.status >= 200 && res.status < 300) {
					return { ok: true as const, name: file.name, savedAs: filename, path: destPath };
				}

				const errMsg = res.data?.error ?? (typeof res.data === 'string' ? res.data : '');
				const isExists = res.status === 500 && /file exists/i.test(errMsg);

				if (isExists && attempt < MAX_RENAME_TRIES) continue;

				return {
					ok: false as const,
					name: file.name,
					attemptedAs: filename,
					path: destPath,
					status: res.status,
					error: errMsg || `Upload failed (${res.status})`
				};
			}

			return {
				ok: false as const,
				name: file.name,
				status: 409,
				error: `Could not pick a free name for ${file.name}`
			};
		};

		const CONCURRENCY = 4;
		const results: Array<
			| { ok: true; name: string; savedAs: string; path: string }
			| {
					ok: false;
					name: string;
					status: number;
					error: string;
					attemptedAs?: string;
					path?: string;
			  }
		> = [];

		let i = 0;

		const worker = async () => {
			while (true) {
				const idx = i++;
				if (idx >= files.length) return;
				const file = files[idx];

				try {
					results[idx] = await uploadOne(file);
				} catch (e) {
					const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Upload failed';
					results[idx] = { ok: false, name: file.name, status: 500, error: msg };
				}
			}
		};

		const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker());
		await Promise.all(workers);

		const failed = results.filter((r) => !r.ok);
		if (failed.length) {
			return {
				ok: false,
				uploaded: results.length - failed.length,
				failedCount: failed.length,
				results
			};
		}

		return { ok: true, uploaded: results.length, results };
	},
	archiveFiles: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) return fail(400, { uploadError: 'Invalid site ID' });

		const site = await getSiteConnector(locals, id);
		const form = await request.formData();

		const ids = form.getAll('ids') as string[];

		let parentPath = form.get('parentId') as string;

		const archiveName = new Date().toISOString().replace(/:/g, '-') + '.zip';

		if (!parentPath.endsWith('/')) parentPath += '/';

		const archivePath = parentPath + archiveName;

		const formation = 'zip';

		const { data } = await axios.post(
			`${site.connectorFqdn}/api/filemanager/${site.id}/compress`,
			{
				sources: ids,
				target: archivePath,
				format: formation
			},
			{
				headers: {
					Authorization: `Bearer ${site.connectorToken}`
				},
				timeout: 60_000
			}
		);

		return data;
	},
	extract: async ({ params, locals, request }) => {
		const id = params.id?.trim();
		if (!id) {
			return fail(400, { message: 'Invalid site ID', code: 'invalid_site_id' });
		}

		const form = await request.formData();

		const rawSources = form
			.getAll('sources')
			.map((value) => String(value).trim())
			.filter(Boolean);
		let sources: string[] = rawSources;

		if (rawSources.length === 1 && rawSources[0].startsWith('[')) {
			try {
				const parsed = JSON.parse(rawSources[0]);
				if (Array.isArray(parsed)) {
					sources = parsed.map((value) => String(value).trim()).filter(Boolean);
				}
			} catch {
				// Ignore JSON parse errors, fall back to raw values.
			}
		}

		if (!sources.length) {
			return fail(400, { message: 'No archive selected', code: 'missing_sources' });
		}

		if (sources.length > 1) {
			return fail(400, {
				message: 'Extract supports one archive at a time',
				code: 'multiple_sources'
			});
		}

		const targetRaw = form.get('target');
		if (typeof targetRaw !== 'string') {
			return fail(400, { message: 'Missing target path', code: 'missing_target' });
		}

		let source: string;
		let target: string;

		try {
			source = normalizePath(sources[0]);
			target = normalizePath(targetRaw);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : typeof err === 'string' ? err : 'Invalid path input';
			return fail(400, { message: String(message), code: 'invalid_path' });
		}

		if (!source) {
			return fail(400, { message: 'Invalid archive path', code: 'invalid_source' });
		}

		const format = form.get('format');
		const formatValue = typeof format === 'string' ? format.trim() : undefined;

		try {
			const res = await extractArchiveForSite(locals, id, source, target, formatValue || undefined);

			if (res.status >= 200 && res.status < 300) {
				return {
					message: 'Archive extracted',
					result: res.data
				};
			}

			const connectorMessage =
				res.data?.error ??
				res.data?.message ??
				(typeof res.data === 'string' ? res.data : '') ??
				`Extract failed (${res.status})`;

			return fail(res.status, {
				message: 'Extract failed',
				code: 'connector_error',
				status: res.status,
				detail: String(connectorMessage)
			});
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: typeof err === 'string'
						? err
						: 'Failed to reach connector';
			return fail(502, {
				message: 'Failed to reach connector',
				code: 'connector_unreachable',
				detail: String(message)
			});
		}
	}
};
