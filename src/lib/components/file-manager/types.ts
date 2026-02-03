import type { ComponentType } from 'svelte';

export type FileKind = 'file' | 'folder';

export type FileEntry = {
	id: string;
	name: string;
	kind: FileKind;
	parentId: string | null;
	size: number;
	modifiedAt: string;
	extension?: string;
	content?: string;
	isArchive?: boolean;
};

export type FileActionGroup = 'create' | 'edit' | 'transfer' | 'archive' | 'system';

export type FileManagerAction = {
	id: string;
	label: string;
	icon?: ComponentType;
	shortcut?: string[];
	group?: FileActionGroup;
	variant?: 'default' | 'destructive';
	requiresSelection?: boolean;
	single?: boolean;
	allowFiles?: boolean;
	allowFolders?: boolean;
	primary?: boolean;
};

export type FileManagerActionInput = Partial<Omit<FileManagerAction, 'id'>> & {
	id: string;
};

export type FileManagerActionPayload = {
	name?: string;
	id?: string;
	ids?: string[];
	parentId?: string | null;
	destinationId?: string | null;
	entries?: FileEntry[];
	files?: File[];
	content?: string;
};

export type ShortcutMap = Record<string, string[]>;

export type FileManagerActionEvent = {
	actionId: string;
	selection: FileEntry[];
	cwdId: string | null;
	entry?: FileEntry;
	payload?: FileManagerActionPayload;
};

export type FileManagerActionHandler = (event: FileManagerActionEvent) => void | Promise<void>;

export type FileManagerActionDefinition = Partial<Omit<FileManagerAction, 'id'>> & {
	id?: string;
	handler?: FileManagerActionHandler;
};

export type FileManagerActionMap = Record<
	string,
	FileManagerActionHandler | FileManagerActionDefinition
>;

export type FileManagerActions = FileManagerActionInput[] | FileManagerActionMap;

export type FileManagerSelectionEvent = {
	selection: FileEntry[];
	ids: string[];
};

export type FileManagerEntriesEvent = {
	entries: FileEntry[];
};
