import type { FileManagerAction, FileManagerActionInput } from './types.js';
import FilePlusIcon from '@lucide/svelte/icons/file-plus';
import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
import UploadIcon from '@lucide/svelte/icons/upload';
import DownloadIcon from '@lucide/svelte/icons/download';
import PencilIcon from '@lucide/svelte/icons/pencil';
import Trash2Icon from '@lucide/svelte/icons/trash-2';
import ArchiveIcon from '@lucide/svelte/icons/archive';
import FolderInputIcon from '@lucide/svelte/icons/folder-input';
import FolderOutputIcon from '@lucide/svelte/icons/folder-output';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import CopyIcon from '@lucide/svelte/icons/copy';

export const defaultActions: FileManagerAction[] = [
	{
		id: 'create-file',
		label: 'New file',
		icon: FilePlusIcon,
		shortcut: ['Mod+N'],
		group: 'create',
		primary: true
	},
	{
		id: 'create-folder',
		label: 'New folder',
		icon: FolderPlusIcon,
		shortcut: ['Mod+Shift+N'],
		group: 'create',
		primary: true
	},
	{
		id: 'upload',
		label: 'Upload',
		icon: UploadIcon,
		shortcut: ['Mod+U'],
		group: 'transfer',
		primary: true
	},
	{
		id: 'download',
		label: 'Download',
		icon: DownloadIcon,
		shortcut: ['Mod+D'],
		group: 'transfer',
		requiresSelection: true,
		allowFiles: true
	},
	{
		id: 'open',
		label: 'Open',
		icon: FolderOutputIcon,
		shortcut: ['Enter'],
		group: 'edit',
		requiresSelection: true,
		single: true,
		allowFiles: true,
		allowFolders: true
	},
	{
		id: 'edit',
		label: 'Edit',
		icon: FileTextIcon,
		shortcut: ['Mod+E'],
		group: 'edit',
		requiresSelection: true,
		single: true,
		allowFiles: true
	},
	{
		id: 'rename',
		label: 'Rename',
		icon: PencilIcon,
		shortcut: ['F2'],
		group: 'edit',
		requiresSelection: true,
		single: true,
		allowFiles: true,
		allowFolders: true
	},
	{
		id: 'move',
		label: 'Move',
		icon: FolderInputIcon,
		shortcut: ['Mod+M'],
		group: 'edit',
		requiresSelection: true,
		allowFiles: true,
		allowFolders: true
	},
	{
		id: 'copy',
		label: 'Copy',
		icon: CopyIcon,
		shortcut: ['Mod+C'],
		group: 'edit',
		requiresSelection: true,
		allowFiles: true,
		allowFolders: true
	},
	{
		id: 'archive',
		label: 'Archive',
		icon: ArchiveIcon,
		shortcut: ['Mod+Shift+Z'],
		group: 'archive',
		requiresSelection: true,
		allowFiles: true,
		allowFolders: true
	},
	{
		id: 'extract',
		label: 'Extract',
		icon: FolderOutputIcon,
		shortcut: ['Mod+Shift+E'],
		group: 'archive',
		requiresSelection: true,
		single: true,
		allowFiles: true
	},
	{
		id: 'delete',
		label: 'Delete',
		icon: Trash2Icon,
		shortcut: ['Delete', 'Backspace'],
		group: 'system',
		variant: 'destructive',
		requiresSelection: true,
		allowFiles: true,
		allowFolders: true
	}
];

export const resolveActions = (customActions?: FileManagerActionInput[]) => {
	if (!customActions?.length) return defaultActions;
	const byId = new Map(defaultActions.map((action) => [action.id, action]));
	for (const action of customActions) {
		const fallback = byId.get(action.id) ?? { id: action.id, label: action.id };
		const merged = { ...fallback, ...action };
		if (!merged.label) merged.label = action.id;
		byId.set(action.id, merged);
	}
	return Array.from(byId.values());
};
