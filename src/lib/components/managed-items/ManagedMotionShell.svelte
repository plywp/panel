<script>
	import { Root } from '$lib/components/ui/card';
</script>

<Root>
	<slot />
</Root>

<style>
	:global(.motion-card),
	:global(.motion-item),
	:global(.motion-action) {
		transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
	}

	:global(.motion-card:where(:hover, :focus-within)),
	:global(.motion-item:where(:hover, :focus-within)),
	:global(.motion-action:where(:hover, :focus-visible)) {
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.motion-card),
		:global(.motion-item),
		:global(.motion-action) {
			transition: none;
			will-change: auto;
		}

		:global(.motion-card:where(:hover, :focus-within)),
		:global(.motion-item:where(:hover, :focus-within)),
		:global(.motion-action:where(:hover, :focus-visible)) {
			transform: none;
		}
	}
</style>
