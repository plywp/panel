import type { FileEntry } from './types.js';

export const mockEntries: FileEntry[] = [
	{
		id: 'root',
		name: 'Home',
		kind: 'folder',
		parentId: null,
		size: 0,
		modifiedAt: '2024-04-01T09:00:00Z'
	},
	{
		id: 'folder-docs',
		name: 'Documents',
		kind: 'folder',
		parentId: 'root',
		size: 0,
		modifiedAt: '2024-04-10T10:30:00Z'
	},
	{
		id: 'folder-src',
		name: 'src',
		kind: 'folder',
		parentId: 'root',
		size: 0,
		modifiedAt: '2024-04-12T14:12:00Z'
	},
	{
		id: 'folder-media',
		name: 'Media',
		kind: 'folder',
		parentId: 'root',
		size: 0,
		modifiedAt: '2024-04-08T08:45:00Z'
	},
	{
		id: 'file-readme',
		name: 'README.md',
		kind: 'file',
		parentId: 'root',
		size: 2048,
		modifiedAt: '2024-04-12T11:10:00Z',
		extension: 'md',
		content: '# File Manager\n\nThis is a mocked README file.\n'
	},
	{
		id: 'file-plan',
		name: 'plan.txt',
		kind: 'file',
		parentId: 'folder-docs',
		size: 1337,
		modifiedAt: '2024-04-11T09:30:00Z',
		extension: 'txt',
		content: 'Milestones:\n- Design\n- Build\n- Ship\n'
	},
	{
		id: 'file-notes',
		name: 'notes.txt',
		kind: 'file',
		parentId: 'folder-docs',
		size: 900,
		modifiedAt: '2024-04-09T18:22:00Z',
		extension: 'txt',
		content: 'Remember to add API wiring later.\n'
	},
	{
		id: 'file-index',
		name: 'index.ts',
		kind: 'file',
		parentId: 'folder-src',
		size: 512,
		modifiedAt: '2024-04-13T12:00:00Z',
		extension: 'ts',
		content: "export const hello = () => 'hello';\n"
	},
	{
		id: 'file-archive',
		name: 'assets.zip',
		kind: 'file',
		parentId: 'folder-media',
		size: 50120,
		modifiedAt: '2024-04-03T15:01:00Z',
		extension: 'zip',
		content: '',
		isArchive: true
	}
];
