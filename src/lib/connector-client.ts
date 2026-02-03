import axios from 'axios';

export function connectorClient(base: string, token: string) {
	const http = axios.create({
		baseURL: base,
		headers: { Authorization: `Bearer ${token}` }
	});

	return {
		get: http.get.bind(http),
		post: http.post.bind(http),
		put: http.put.bind(http),
		delete: http.delete.bind(http)
	};
}
