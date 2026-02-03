export type ManagedItemBase = {
	name: string;
	status: string;
	version: string;
	update?: string | null;
	slug?: string | null;
	stylesheet?: string | null;
	id?: string | null;
};

export type PluginItem = ManagedItemBase & {
	kind?: 'plugin';
};

export type ThemeItem = ManagedItemBase & {
	kind?: 'theme';
};
