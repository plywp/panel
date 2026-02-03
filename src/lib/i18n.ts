import { register, init, getLocaleFromNavigator } from 'svelte-i18n';
import { browser } from '$app/environment';

const modules = import.meta.glob('./lang/*.json');

for (const path in modules) {
	const code = path.split('/').pop().replace('.json', '');
	register(code, modules[path]);
}

init({
	fallbackLocale: 'en_US',
	initialLocale: browser ? getLocaleFromNavigator() : 'en_US'
});
