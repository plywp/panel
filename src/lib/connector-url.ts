type ConnectorUrlInput = {
	fqdn: string;
	daemonSslEnabled?: boolean | null;
};

export function connectorBaseUrl(connector: ConnectorUrlInput): string | null {
	const raw = connector.fqdn?.trim();
	if (!raw) {
		return null;
	}

	const hasScheme = /^https?:\/\//i.test(raw);
	const scheme = connector.daemonSslEnabled ? 'https://' : 'http://';
	const base = hasScheme ? raw : `${scheme}${raw}`;

	let url: URL;
	try {
		url = new URL(base);
	} catch {
		return null;
	}

	if (!hasScheme && !url.port) {
		url.port = '8080';
	}

	const path = url.pathname.replace(/\/+$/, '');
	const suffix = path && path !== '/' ? path : '';
	return `${url.origin}${suffix}`;
}

export function connectorHealthUrl(connector: ConnectorUrlInput): string | null {
	const base = connectorBaseUrl(connector);
	if (!base) return null;
	return `${base}/api/health`;
}

export function connectorSiteHealthUrl(
	connector: ConnectorUrlInput,
	siteId: string
): string | null {
	const base = connectorBaseUrl(connector);
	if (!base) return null;
	const encodedId = encodeURIComponent(siteId);
	return `${base}/api/sites/${encodedId}/health`;
}

export function connectorSiteStatusUrl(
	connector: ConnectorUrlInput,
	siteId: string
): string | null {
	const base = connectorBaseUrl(connector);
	if (!base) return null;
	const encodedId = encodeURIComponent(siteId);
	return `${base}/api/sites/${encodedId}/status`;
}

export function connectorFileManagerEntriesUrl(
	connector: ConnectorUrlInput,
	siteId: string,
	path = '/'
): string | null {
	const base = connectorBaseUrl(connector);
	if (!base) return null;
	const encodedId = encodeURIComponent(siteId);
	return `${base}/api/filemanager/${encodedId}/list?path=${encodeURIComponent(path)}`;
}
