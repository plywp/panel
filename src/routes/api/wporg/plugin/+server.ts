import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import axios from 'axios';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/i;
const WP_API_TIMEOUT = 45_000;
const CACHE_MAX_AGE = 300;

interface WPPluginInfo {
	name: string;
	slug: string;
	short_description?: string;
	description?: string;
}

function wpPluginInfoUrl(slug: string): string {
	const params = new URLSearchParams({
		action: 'query_plugins',
		'request[slug]': slug,
		'request[fields][name]': 'true',
		'request[fields][slug]': 'true',
		'request[fields][short_description]': 'true',
		'request[fields][description]': 'true'
	});
	return `https://api.wordpress.org/plugins/info/1.2/?${params.toString()}`;
}

function isValidPluginResponse(data: unknown): data is WPPluginInfo {
	return (
		typeof data === 'object' &&
		data !== null &&
		'slug' in data &&
		'name' in data &&
		typeof (data as { slug: unknown }).slug === 'string' &&
		typeof (data as { name: unknown }).name === 'string'
	);
}

export const GET: RequestHandler = async ({ url, setHeaders, fetch }) => {
	const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase();
	
	if (!slug) {
		throw error(400, 'Missing slug parameter');
	}
	
	if (!SLUG_RE.test(slug)) {
		throw error(400, 'Invalid slug format');
	}

	try {
		const wpUrl = wpPluginInfoUrl(slug);
		
		console.log(`Fetching plugin info from ${wpUrl}`);
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), WP_API_TIMEOUT);
		
		const res = await axios.get(wpUrl)

		if (!res.ok) {
			if (res.status === 404) {
				throw error(404, `Plugin "${slug}" not found`);
			}
			throw error(502, `WordPress.org returned ${res.status}`);
		}

		const data = await res.json();

		if (!isValidPluginResponse(data)) {
			throw error(502, 'Invalid response from WordPress.org');
		}

		const filtered = {
			name: data.name,
			slug: data.slug,
			short_description: data.short_description || '',
			description: data.description || ''
		};

		setHeaders({
			'cache-control': `public, max-age=${CACHE_MAX_AGE}`,
			'content-type': 'application/json'
		});

		return json(filtered);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		
		if (e instanceof DOMException && e.name === 'AbortError') {
			throw error(504, 'Request timed out');
		}

		if (e instanceof TypeError && e.message === 'fetch failed') {
			throw error(504, 'Unable to reach WordPress.org');
		}
		
		console.log('Failed to fetch plugin info:', e);
		
		throw error(502, 'Failed to fetch plugin info');
	}
};