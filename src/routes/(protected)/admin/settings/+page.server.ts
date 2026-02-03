import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { setValue, getValue } from '$lib/server/db/kv';

export const load: PageServerLoad = async () => {
	const meta = {
		title: (await getValue('title')) ?? '',
		description: (await getValue('description')) ?? '',
		favicon: (await getValue('favicon')) ?? ''
	};

	return { meta };
};

const UPLOAD_DIR = path.resolve('static', 'uploads');
const PUBLIC_PREFIX = '/uploads/';

async function ensureUploadDir() {
	await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function safeExt(mime: string): 'png' | 'jpg' | 'svg' | null {
	if (mime === 'image/png') return 'png';
	if (mime === 'image/jpeg') return 'jpg';
	if (mime === 'image/svg+xml') return 'svg';
	return null;
}

async function deleteOldUploadIfAny(oldUrl?: string) {
	if (!oldUrl || !oldUrl.startsWith(PUBLIC_PREFIX)) return;

	const filename = oldUrl.slice(PUBLIC_PREFIX.length);
	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;

	try {
		await fs.unlink(path.join(UPLOAD_DIR, filename));
	} catch {
		// ignore missing file
	}
}

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();

		const nextTitleRaw = String(form.get('title') ?? '');
		const nextDescRaw = String(form.get('description') ?? '');
		const file = form.get('favicon');

		const nextTitle = nextTitleRaw.trim();
		const nextDescription = nextDescRaw.trim();

		if (nextTitle.length > 100) return fail(400, { error: 'Title too long' });
		if (nextDescription.length > 200) return fail(400, { error: 'Description too long' });

		const current = {
			title: (await getValue('title')) ?? '',
			description: (await getValue('description')) ?? '',
			favicon: (await getValue('favicon')) ?? ''
		};

		const updated: Partial<typeof current> = {};

		if (nextTitle !== '' && nextTitle !== current.title) {
			await setValue('title', nextTitle);
			updated.title = nextTitle;
		}

		if (nextDescription !== '' && nextDescription !== current.description) {
			await setValue('description', nextDescription);
			updated.description = nextDescription;
		}

		if (file instanceof File && file.size > 0) {
			if (file.size > 2 * 1024 * 1024) return fail(400, { error: 'Favicon max 2MB' });

			const ext = safeExt(file.type);
			if (!ext) return fail(400, { error: 'Only PNG/JPEG/SVG allowed' });

			await ensureUploadDir();

			await deleteOldUploadIfAny(current.favicon);

			const filename = `favicon-${randomUUID()}.${ext}`;
			const diskPath = path.join(UPLOAD_DIR, filename);

			const buf = Buffer.from(await file.arrayBuffer());
			await fs.writeFile(diskPath, buf);

			const newFaviconPath = `${PUBLIC_PREFIX}${filename}`;

			if (newFaviconPath !== current.favicon) {
				await setValue('favicon', newFaviconPath);
				updated.favicon = newFaviconPath;
			}
		}

		const changed = Object.keys(updated).length > 0;

		return {
			success: true,
			changed,
			updated,
			meta: {
				title: updated.title ?? current.title,
				description: updated.description ?? current.description,
				favicon: updated.favicon ?? current.favicon
			}
		};
	}
};
