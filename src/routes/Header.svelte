<!--<script lang="ts">
	import { locale, locales } from 'svelte-i18n';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';

	function label(code: string): string {
		switch (code) {
			case 'en_US':
				return 'English (US)';
			case 'es_ES':
				return 'Español (España)';
			case 'bn_BD':
				return 'বাংলা (বাংলাদেশ)';
			case 'fr_FR':
				return 'Français (France)';
			case 'de_DE':
				return 'Deutsch (Deutschland)';
			case 'pt_BR':
				return 'Português (Brasil)';
			case 'it_IT':
				return 'Italiano (Italia)';
			case 'nl_NL':
				return 'Nederlands (Nederland)';
			case 'ru_RU':
				return 'Русский (Россия)';
			case 'ar_SA':
				return 'العربية (السعودية)';
			case 'tr_TR':
				return 'Türkçe (Türkiye)';
			case 'id_ID':
				return 'Bahasa Indonesia';
			case 'vi_VN':
				return 'Tiếng Việt';
			case 'th_TH':
				return 'ไทย';
			case 'zh_CN':
				return '中文（简体）';
			case 'zh_TW':
				return '中文（繁體）';
			case 'ja_JP':
				return '日本語';
			case 'ko_KR':
				return '한국어';
			case 'hi_IN':
				return 'हिन्दी';
			case 'ur_PK':
				return 'اردو';
			case 'mr_IN':
				return 'मराठी';
			case 'ftl_urixen':
				return 'fuck the lang - urixen - include rude words';
			default:
				return code;
		}
	}
	//console.log($locales)
</script>

<NativeSelect.Root bind:value={$locale}>
	{#each $locales as locale}
		<NativeSelect.Option value={locale} key={locale}>{label(locale)}</NativeSelect.Option>
	{/each}
</NativeSelect.Root>
-->
