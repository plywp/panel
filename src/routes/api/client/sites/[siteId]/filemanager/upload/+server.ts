import { error, json, type RequestHandler } from '@sveltejs/kit';
import axios from 'axios';
import { requireApiKeySiteAccess } from '$lib/server/auth/site-api';

const normalizeConnectorBase = (fqdn: string) =>
	fqdn.startsWith('http://') || fqdn.startsWith('https://') ? fqdn : `http://${fqdn}`;

const normalizePath = (input: string) => {
	const p = (input ?? '').trim().replace(/\\/g, '/');
	const cleaned = p.replace(/^\/+|\/+$/g, '');
	if (cleaned.includes('..')) throw error(400, 'Invalid path');
	return cleaned;
};

export const POST: RequestHandler = async ({ params, request }) => {
	const siteId = params.siteId?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const ctx = await requireApiKeySiteAccess(request, siteId, { filemanager: ['upload'] });
	const form = await request.formData();
	const dir = normalizePath(String(form.get('path') ?? '') || '/');
	const files = form.getAll('file').filter((v): v is File => v instanceof File);
	if (!files.length) throw error(400, 'No files uploaded');

	const base = normalizeConnectorBase(ctx.connectorFqdn);

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

		const MAX_RENAME_TRIES = 25;
		for (let attempt = 0; attempt <= MAX_RENAME_TRIES; attempt++) {
			const filename = buildName(file.name, attempt);
			const destPath = makeDestPath(dir, filename);
			const url =
				`${base.replace(/\/+$/, '')}/api/filemanager/${encodeURIComponent(ctx.siteId)}/upload` +
				`?path=${encodeURIComponent(destPath)}`;

			const fd = new FormDataNode();
			fd.append('file', buf, {
				filename,
				contentType: file.type || 'application/octet-stream',
				knownLength: buf.length
			});

			const res = await axios.post(url, fd, {
				headers: {
					Authorization: `Bearer ${ctx.connectorToken}`,
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

	for (const file of files) {
		results.push(await uploadOne(file));
	}

	const failed = results.filter((r) => !r.ok);
	if (failed.length) {
		return json({ ok: false, uploaded: results.length - failed.length, failedCount: failed.length, results });
	}

	return json({ ok: true, uploaded: results.length, results });
};
