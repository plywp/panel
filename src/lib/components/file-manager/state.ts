import type { FileEntry } from './types.js';

export type SelectionRequest = {
	id: string;
	orderedIds: string[];
	metaKey: boolean;
	shiftKey: boolean;
	lastSelectedId: string | null;
	currentSelection: string[];
};

const createId = () => {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getEntryById = (entries: FileEntry[], id: string | null) => {
	if (!id) return undefined;
	return entries.find((entry) => entry.id === id);
};

export const getChildren = (entries: FileEntry[], parentId: string | null) => {
	const children = entries.filter((entry) => entry.parentId === parentId);
	return children.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
};

export const getPath = (entries: FileEntry[], cwdId: string | null) => {
	const path: FileEntry[] = [];
	let currentId = cwdId;
	while (currentId) {
		const entry = getEntryById(entries, currentId);
		if (!entry) break;
		path.unshift(entry);
		currentId = entry.parentId;
	}
	return path;
};

export const serializePath = (entries: FileEntry[], cwdId: string | null) => {
	const path = getPath(entries, cwdId);
	if (path.length === 0) return '';
	const [, ...rest] = path;
	return rest.map((entry) => entry.name).join('/');
};

export const resolvePathId = (entries: FileEntry[], pathValue: string | null) => {
	const root = entries.find((entry) => entry.parentId === null)?.id ?? null;
	if (!pathValue || pathValue === '/') return root;
	const parts = pathValue
		.split('/')
		.map((part) => part.trim())
		.filter(Boolean);
	let currentId = root;
	for (const part of parts) {
		const next = entries.find(
			(entry) => entry.parentId === currentId && entry.kind === 'folder' && entry.name === part
		);
		if (!next) break;
		currentId = next.id;
	}
	return currentId;
};

export const applySelectionRequest = (request: SelectionRequest) => {
	const { id, orderedIds, metaKey, shiftKey, lastSelectedId, currentSelection } = request;
	if (shiftKey && lastSelectedId) {
		const start = orderedIds.indexOf(lastSelectedId);
		const end = orderedIds.indexOf(id);
		if (start === -1 || end === -1) {
			return { selection: [id], lastSelectedId: id };
		}
		const [from, to] = start < end ? [start, end] : [end, start];
		const range = orderedIds.slice(from, to + 1);
		const selection = metaKey ? Array.from(new Set([...currentSelection, ...range])) : range;
		return { selection, lastSelectedId: id };
	}

	if (metaKey) {
		const exists = currentSelection.includes(id);
		const selection = exists
			? currentSelection.filter((selected) => selected !== id)
			: [...currentSelection, id];
		return { selection, lastSelectedId: id };
	}

	return { selection: [id], lastSelectedId: id };
};

export const clearSelection = () => ({ selection: [], lastSelectedId: null });

export const createFile = (entries: FileEntry[], cwdId: string | null, name: string) => {
	const safeName = getAvailableName(entries, cwdId, name);
	const extension = safeName.includes('.') ? safeName.split('.').pop() : undefined;
	const now = new Date().toISOString();
	const entry: FileEntry = {
		id: createId(),
		name: safeName,
		kind: 'file',
		parentId: cwdId,
		size: 0,
		modifiedAt: now,
		extension,
		content: ''
	};
	return [...entries, entry];
};

export const createFolder = (entries: FileEntry[], cwdId: string | null, name: string) => {
	const safeName = getAvailableName(entries, cwdId, name);
	const entry: FileEntry = {
		id: createId(),
		name: safeName,
		kind: 'folder',
		parentId: cwdId,
		size: 0,
		modifiedAt: new Date().toISOString()
	};
	return [...entries, entry];
};

export const renameEntry = (entries: FileEntry[], entryId: string, name: string) => {
	const target = getEntryById(entries, entryId);
	if (!target) return entries;
	const safeName = getAvailableName(entries, target.parentId, name, entryId);
	return entries.map((entry) =>
		entry.id === entryId
			? {
					...entry,
					name: safeName,
					modifiedAt: new Date().toISOString(),
					...(entry.kind === 'file' ? { extension: safeName.split('.').pop() } : {})
				}
			: entry
	);
};

export const deleteEntries = (entries: FileEntry[], ids: string[]) => {
	const toDelete = new Set(ids);
	const descendants = new Set(ids);
	let changed = true;
	while (changed) {
		changed = false;
		for (const entry of entries) {
			if (entry.parentId && descendants.has(entry.parentId) && !descendants.has(entry.id)) {
				descendants.add(entry.id);
				changed = true;
			}
		}
	}
	return entries.filter((entry) => !descendants.has(entry.id));
};

export const moveEntries = (entries: FileEntry[], ids: string[], destinationId: string | null) => {
	const blocked = new Set(ids);
	let validDestination = true;
	let current = destinationId;
	while (current) {
		if (blocked.has(current)) {
			validDestination = false;
			break;
		}
		const entry = getEntryById(entries, current);
		current = entry?.parentId ?? null;
	}
	if (!validDestination) return entries;

	return entries.map((entry) =>
		ids.includes(entry.id)
			? { ...entry, parentId: destinationId, modifiedAt: new Date().toISOString() }
			: entry
	);
};

export const updateFileContent = (entries: FileEntry[], entryId: string, content: string) => {
	return entries.map((entry) =>
		entry.id === entryId
			? {
					...entry,
					content,
					size: content.length,
					modifiedAt: new Date().toISOString()
				}
			: entry
	);
};

export const createArchive = (entries: FileEntry[], cwdId: string | null, ids: string[]) => {
	const now = new Date().toISOString();
	const archiveName = getAvailableName(entries, cwdId, 'archive.zip');
	const entry: FileEntry = {
		id: createId(),
		name: archiveName,
		kind: 'file',
		parentId: cwdId,
		size: ids.length * 1024,
		modifiedAt: now,
		extension: 'zip',
		content: '',
		isArchive: true
	};
	return [...entries, entry];
};

export const extractArchive = (entries: FileEntry[], cwdId: string | null, archiveId: string) => {
	const archive = getEntryById(entries, archiveId);
	if (!archive || archive.kind !== 'file') return entries;
	const baseName = archive.name.replace(/\.zip$/i, '') || 'archive';
	const folderName = getAvailableName(entries, cwdId, baseName);
	const folder: FileEntry = {
		id: createId(),
		name: folderName,
		kind: 'folder',
		parentId: cwdId,
		size: 0,
		modifiedAt: new Date().toISOString()
	};
	return [...entries, folder];
};

export const getAvailableName = (
	entries: FileEntry[],
	parentId: string | null,
	name: string,
	excludeId?: string
) => {
	const siblings = entries.filter((entry) => entry.parentId === parentId && entry.id !== excludeId);
	if (!siblings.some((entry) => entry.name === name)) return name;
	const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
	const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
	let index = 2;
	let next = `${base} (${index})${ext}`;
	while (siblings.some((entry) => entry.name === next)) {
		index += 1;
		next = `${base} (${index})${ext}`;
	}
	return next;
};

export const formatBytes = (size: number) => {
	if (size === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
	const value = size / 1024 ** exponent;
	return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};
