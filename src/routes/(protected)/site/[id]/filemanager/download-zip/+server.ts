import { error, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { wp_site } from '$lib/server/db/schema/auth-schema';
import { connector } from '$lib/server/db/schema/connector';
import { eq } from 'drizzle-orm';
import axios, { AxiosError } from 'axios';

import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';

// ---------- Types ----------
type SessionBundle = NonNullable<App.Locals['session']>;

type SiteConnectorRow = {
	id: string;
	organizationId: string;
	connectorFqdn: string | null;
	connectorToken: string | null;
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

	if (cleaned.includes('..')) throw error(400, 'Invalid path');

	return cleaned;
}

function sanitizeZipEntryName(path: string): string {
	const cleaned = path.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!cleaned || cleaned.includes('..')) return 'file';
	return cleaned;
}

function zipFilename(name: string | null): string {
	const base = (name ?? '').trim();
	if (!base) return 'download.zip';
	return base.toLowerCase().endsWith('.zip') ? base : `${base}.zip`;
}

async function getSiteConnector(locals: App.Locals, siteId: string): Promise<SiteConnectorRow> {
	const session = requireSession(locals);

	const rows = await db
		.select({
			id: wp_site.id,
			organizationId: wp_site.organizationId,
			connectorFqdn: connector.fqdn,
			connectorToken: connector.token
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

function joinUrl(base: string, path: string): string {
	return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

async function fetchFileStream(params: {
	baseUrl: string;
	token: string;
	siteId: string;
	path: string;
}) {
	const url = joinUrl(
		params.baseUrl,
		`api/filemanager/${encodeURIComponent(params.siteId)}/download?path=${encodeURIComponent(
			params.path || '/'
		)}`
	);

	const res = await axios.get(url, {
		headers: { Authorization: `Bearer ${params.token}` },
		responseType: 'stream',
		timeout: 0,
		validateStatus: () => true
	});

	if (res.status < 200 || res.status >= 300) {
		const msg = await streamToText(res.data).catch(() => '');
		throw new Error(msg || `Connector download failed (${res.status})`);
	}

	return {
		stream: res.data as NodeJS.ReadableStream,
		contentLength: res.headers['content-length']
	};
}

async function streamToText(stream: any): Promise<string> {
	const chunks: Buffer[] = [];
	await new Promise<void>((resolve, reject) => {
		stream.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
		stream.on('end', resolve);
		stream.on('error', reject);
	});
	return Buffer.concat(chunks).toString('utf-8');
}

// ---------- Endpoint ----------
export const POST: RequestHandler = async ({ params, locals, request, setHeaders }) => {
	const siteId = params.id?.trim();
	if (!siteId) throw error(400, 'Invalid site ID');

	const site = await getSiteConnector(locals, siteId);

	const form = await request.formData();
	const rawPaths = form.getAll('paths').map((v) => String(v));
	const name = zipFilename(String(form.get('name') ?? ''));

	const paths = rawPaths.map(normalizePath).filter(Boolean);
	if (!paths.length) throw error(400, 'No files selected');

	const MAX_FILES = 200;
	if (paths.length > MAX_FILES) throw error(400, `Too many files (max ${MAX_FILES})`);

	setHeaders({
		'cache-control': 'no-store',
		pragma: 'no-cache',
		'x-content-type-options': 'nosniff'
	});

	const pass = new PassThrough();

	const archive = archiver('zip', {
		zlib: { level: 9 }
	});

	archive.on('warning', (err) => {
		console.warn('zip warning', err);
	});

	archive.on('error', (err) => {
		pass.destroy(err);
	});

	archive.pipe(pass);

	(async () => {
		try {
			for (const p of paths) {
				const entryName = sanitizeZipEntryName(p);

				const { stream } = await fetchFileStream({
					baseUrl: site.connectorFqdn!,
					token: site.connectorToken!,
					siteId: site.id,
					path: p
				});

				archive.append(stream as any, { name: entryName });
			}

			await archive.finalize();
		} catch (e) {
			archive.abort();
			pass.destroy(e as Error);
		}
	})();

	const body = Readable.toWeb(pass as any);

	const headers = new Headers();
	headers.set('content-type', 'application/zip');
	headers.set('content-disposition', `attachment; filename="${name}"`);
	headers.set('cache-control', 'no-store');
	headers.set('x-accel-buffering', 'no');

	return new Response(body as any, { status: 200, headers });
};
