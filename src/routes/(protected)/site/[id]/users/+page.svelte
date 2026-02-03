<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Plus, Pen, Trash2 } from 'lucide-svelte';
	import { hashEmail } from '$lib/email-hash';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { fly, fade } from 'svelte/transition';

	type ApiUser = {
		ID: number;
		user_login: string;
		user_email: string;
		roles: string[];
		display_name: string;
	};

	type User = {
		id: string;
		login: string;
		displayName: string;
		email: string;
		avatar: Promise<string>;
		initials: string;
		roles: string[];
	};

	type Role = {
		id: string;
		name: string;
	};

	const { data }: { data: PageData } = $props();

	let search = $state('');
	let isModalOpen = $state(false);

	let editingUser = $state<User | null>(null);
	let isEditModalOpen = $state(false);

	let isForgotPasswd = $state(false);

	const prefersReducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
		const newtonIterations = 8;
		const newtonMinSlope = 0.001;
		const subdivisionPrecision = 0.0000001;
		const subdivisionMaxIterations = 10;

		const kSplineTableSize = 11;
		const kSampleStepSize = 1 / (kSplineTableSize - 1);

		const float32ArraySupported = typeof Float32Array === 'function';

		const sampleValues = float32ArraySupported
			? new Float32Array(kSplineTableSize)
			: new Array(kSplineTableSize);

		const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
		const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
		const c = (a1: number) => 3 * a1;

		const calcBezier = (t: number, a1: number, a2: number) =>
			((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
		const getSlope = (t: number, a1: number, a2: number) =>
			3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);

		for (let i = 0; i < kSplineTableSize; ++i) {
			sampleValues[i] = calcBezier(i * kSampleStepSize, x1, x2);
		}

		const binarySubdivide = (x: number, a1: number, a2: number) => {
			let currentX = 0;
			let currentT = 0;
			let i = 0;
			let t0 = 0;
			let t1 = 1;

			do {
				currentT = t0 + (t1 - t0) / 2;
				currentX = calcBezier(currentT, a1, a2) - x;
				if (currentX > 0) {
					t1 = currentT;
				} else {
					t0 = currentT;
				}
			} while (Math.abs(currentX) > subdivisionPrecision && ++i < subdivisionMaxIterations);

			return currentT;
		};

		const newtonRaphsonIterate = (x: number, guessT: number, a1: number, a2: number) => {
			for (let i = 0; i < newtonIterations; ++i) {
				const currentSlope = getSlope(guessT, a1, a2);
				if (currentSlope === 0) return guessT;
				const currentX = calcBezier(guessT, a1, a2) - x;
				guessT -= currentX / currentSlope;
			}
			return guessT;
		};

		const getTForX = (x: number) => {
			let intervalStart = 0;
			let currentSample = 1;
			const lastSample = kSplineTableSize - 1;

			for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
				intervalStart += kSampleStepSize;
			}
			--currentSample;

			const dist =
				(x - sampleValues[currentSample]) /
				(sampleValues[currentSample + 1] - sampleValues[currentSample]);
			const guessForT = intervalStart + dist * kSampleStepSize;

			const initialSlope = getSlope(guessForT, x1, x2);
			if (initialSlope >= newtonMinSlope) {
				return newtonRaphsonIterate(x, guessForT, x1, x2);
			}
			if (initialSlope === 0) return guessForT;
			return binarySubdivide(x, x1, x2);
		};

		return (x: number) => {
			if (x === 0 || x === 1) return x;
			return calcBezier(getTForX(x), y1, y2);
		};
	};

	const easeStandard = cubicBezier(0.4, 0, 0.2, 1);

	$effect(() => {
		isEditModalOpen = !!editingUser;
	});

	$effect(() => {
		if (!isEditModalOpen && !isForgotPasswd) {
			editingUser = null;
		}
	});

	let roles = $state<Role[]>([]);
	let rolesError = $state<string | null>(null);
	let rolesLoading = $state(false);

	let formData = $state({
		user_login: '',
		user_email: '',
		display_name: '',
		user_pass: '',
		role: '',
		send_email: false
	});

	function getInitials(name: string) {
		const n = (name || '').trim();
		if (!n) return '?';
		return n
			.split(/\s+/)
			.map((p) => p[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function formatRole(role: string) {
		return role.replace(/_/g, ' ');
	}

	async function listRoles() {
		try {
			rolesLoading = true;
			rolesError = null;

			const res = await fetch('?/listRoles', {
				method: 'POST',
				body: new FormData()
			});

			if (!res.ok) {
				rolesError = `Failed to load roles: ${res.statusText}`;
				roles = [];
				return;
			}

			const payload = await res.json();

			if (payload.type === 'success' && typeof payload.data === 'string') {
				const parsed = JSON.parse(payload.data);

				if (Array.isArray(parsed)) {
					const strings = parsed.filter((item) => typeof item === 'string');
					const pairs = strings.slice(1);

					const newRoles: Role[] = [];
					for (let i = 0; i < pairs.length; i += 2) {
						const name = pairs[i];
						const id = pairs[i + 1];
						if (typeof name === 'string' && typeof id === 'string') {
							newRoles.push({ name, id });
						}
					}
					roles = newRoles;
				} else {
					rolesError = 'Failed to load roles: invalid response';
					roles = [];
				}
			} else if (payload.type === 'success' && payload.data?.roles) {
				roles = Object.entries(payload.data.roles).map(([id, name]) => ({
					id,
					name: String(name)
				}));
			} else {
				rolesError = 'Failed to load roles: invalid response';
				roles = [];
			}
		} catch (err) {
			console.error(err);
			rolesError = 'Failed to load roles';
			roles = [];
		} finally {
			rolesLoading = false;
		}
	}

	const refreshUsers = async () => {
		await invalidateAll();
	};

	onMount(() => {
		listRoles();
		$effect(() => {
			if (!formData.role && roles.length) {
				formData = { ...formData, role: roles[0]!.id };
			}
		});
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;

		const response = await fetch(form.action, {
			method: 'POST',
			body: new FormData(form)
		});

		if (response.ok) {
			isModalOpen = false;
			formData = {
				user_login: '',
				user_email: '',
				display_name: '',
				user_pass: '',
				role: roles[0]?.id ?? '',
				send_email: false
			};
			await refreshUsers();
		}
	}

	async function handleEditSubmit(e: Event) {
		e.preventDefault();
		if (!editingUser) return;

		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);

		const updatePayload = new FormData();
		updatePayload.set('user_login', editingUser.login);
		updatePayload.set('display_name', String(fd.get('display_name') ?? ''));
		updatePayload.set('user_email', String(fd.get('user_email') ?? ''));

		const rolesPayload = new FormData();
		rolesPayload.set('user_login', editingUser.login);
		rolesPayload.set('roles', String(fd.get('roles') ?? ''));

		const [updateRes, rolesRes] = await Promise.all([
			fetch('?/update', { method: 'POST', body: updatePayload }),
			fetch('?/setRoles', { method: 'POST', body: rolesPayload })
		]);

		if (updateRes.ok && rolesRes.ok) {
			isEditModalOpen = false;
			await refreshUsers();
		}
	}

	const apiUsers = $derived(Array.isArray(data.users) ? (data.users as ApiUser[]) : []);

	const users = $derived(
		apiUsers.map((u) => {
			const displayName = u.display_name || u.user_login;
			return {
				id: String(u.ID),
				login: u.user_login,
				displayName,
				email: u.user_email,
				avatar: hashEmail(u.user_email),
				initials: getInitials(displayName),
				roles: u.roles ?? []
			} satisfies User;
		})
	);

	const filteredUsers = $derived(
		(() => {
			const q = search.trim().toLowerCase();
			if (!q) return users;
			return users.filter((u) =>
				`${u.displayName} ${u.login} ${u.email} ${(u.roles ?? []).join(' ')}`
					.toLowerCase()
					.includes(q)
			);
		})()
	);
</script>

<div
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Card.Root class="motion-card">
		<Card.Header>
			<Card.Title>Users</Card.Title>
		</Card.Header>

		<Card.Content>
			<div class="flex flex-col gap-4">
				<div class="flex gap-2">
					<Input bind:value={search} type="text" placeholder="Search users..." class="w-full" />
					<Button class="motion-action whitespace-nowrap" onclick={() => (isModalOpen = true)}>
						<Plus class="mr-1 h-4 w-4" />
						Add User
					</Button>
				</div>

				<div class="flex flex-col gap-2">
					{#each filteredUsers as user, index (user.id)}
						<div
							class="motion-item flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
							in:fly={{
								y: prefersReducedMotion ? 0 : 8,
								duration: prefersReducedMotion ? 0 : 180,
								delay: prefersReducedMotion ? 0 : 80 + index * 30,
								easing: easeStandard
							}}
							animate:flip={{ duration: prefersReducedMotion ? 0 : 150, easing: easeStandard }}
						>
							<div class="flex min-w-0 items-center gap-3">
								<Avatar.Root class="shrink-0">
									{#await user.avatar then avatarUrl}
										<Avatar.Image src={avatarUrl} alt={user.displayName} />
									{/await}
									<Avatar.Fallback>{user.initials}</Avatar.Fallback>
								</Avatar.Root>

								<div class="flex min-w-0 flex-col leading-tight">
									<span class="truncate text-sm font-medium">{user.displayName}</span>
									<span class="truncate text-xs text-muted-foreground">{user.email}</span>
									<span class="truncate text-[11px] text-muted-foreground/80">@{user.login}</span>
								</div>
							</div>

							{#if user.roles?.length}
								<Badge variant="secondary" class="shrink-0 capitalize">
									{formatRole(user.roles[0])}
								</Badge>
							{/if}

							<Button
								class="motion-action"
								variant="ghost"
								size="icon"
								onclick={() => (editingUser = user)}
							>
								<Pen class="h-4 w-4" />
							</Button>
							<form action="?/delete" method="POST" use:enhance>
								<input type="hidden" name="user_login" value={user.login} />
								<Button class="motion-action" variant="destructive" size="icon" type="submit">
									<Trash2 class="h-4 w-4" />
								</Button>
							</form>
						</div>
					{/each}

					{#if filteredUsers.length === 0}
						<div
							class="py-4 text-center text-sm text-muted-foreground"
							in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
						>
							No users found
						</div>
					{/if}
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- CREATE USER -->
<Dialog.Root bind:open={isModalOpen}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add New User</Dialog.Title>
			<Dialog.Description>
				Create a new user account. Fill in the required information below.
			</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/create" use:enhance onsubmit={handleSubmit}>
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="user_login">Username *</Label>
					<Input
						id="user_login"
						name="user_login"
						bind:value={formData.user_login}
						placeholder="johndoe"
						required
					/>
				</div>

				<div class="grid gap-2">
					<Label for="user_email">Email *</Label>
					<Input
						id="user_email"
						name="user_email"
						type="email"
						bind:value={formData.user_email}
						placeholder="john@example.com"
						required
					/>
				</div>

				<div class="grid gap-2">
					<Label for="display_name">Display Name</Label>
					<Input
						id="display_name"
						name="display_name"
						bind:value={formData.display_name}
						placeholder="John Doe"
					/>
				</div>

				<div class="grid gap-2">
					<Label for="user_pass">Password</Label>
					<Input
						id="user_pass"
						name="user_pass"
						type="password"
						bind:value={formData.user_pass}
						placeholder="Password for the user"
						required
					/>
				</div>

				<div class="grid gap-2">
					<Label for="role">Role</Label>

					<select
						id="role"
						name="role"
						class="h-10 rounded-md border bg-background px-3 text-sm"
						bind:value={formData.role}
						disabled={rolesLoading}
					>
						<option value="" disabled>Select a role</option>
						{#each roles as r (r.id)}
							<option value={r.id}>{r.name}</option>
						{/each}
					</select>

					{#if rolesLoading}
						<p class="text-xs text-muted-foreground">Loading roles…</p>
					{/if}
					{#if rolesError}
						<p class="text-xs text-destructive">{rolesError}</p>
					{/if}
				</div>
			</div>

			<Dialog.Footer>
				<Button
					class="motion-action"
					type="button"
					variant="outline"
					onclick={() => (isModalOpen = false)}
				>
					Cancel
				</Button>
				<Button class="motion-action" type="submit">Create User</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- EDIT USER -->
{#if editingUser}
	<Dialog.Root bind:open={isEditModalOpen}>
		<Dialog.Content class="sm:max-w-[500px]">
			<Dialog.Header>
				<Dialog.Title>Edit User</Dialog.Title>
				<Dialog.Description>Update the user's information below.</Dialog.Description>
			</Dialog.Header>

			<form method="POST" action="?/update" use:enhance onsubmit={handleEditSubmit}>
				<div class="grid gap-4 py-4">
					<input type="hidden" name="user_login" value={editingUser.login} />

					<div class="grid gap-2">
						<Label for="edit_display_name">Display Name</Label>
						<Input
							id="edit_display_name"
							name="display_name"
							bind:value={editingUser.displayName}
							placeholder="John Doe"
						/>
					</div>

					<div class="grid gap-2">
						<Label for="edit_user_email">Email</Label>
						<Input
							id="edit_user_email"
							name="user_email"
							type="email"
							bind:value={editingUser.email}
							placeholder="john@example.com"
							required
						/>
					</div>

					<div class="grid gap-2">
						<Label for="edit_role">Role</Label>
						<select
							id="edit_role"
							name="roles"
							class="h-10 rounded-md border bg-background px-3 text-sm"
							bind:value={editingUser.roles[0]}
							disabled={rolesLoading}
						>
							<option value="" disabled>Select a role</option>
							{#each roles as r (r.id)}
								<option value={r.id}>{r.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<Dialog.Footer>
					<Button
						class="motion-action"
						type="button"
						variant="outline"
						onclick={() => (isEditModalOpen = false)}
					>
						Cancel
					</Button>
					<Button class="motion-action" type="submit">Save Changes</Button>
				</Dialog.Footer>
			</form>

			<div class="mt-3 flex justify-end">
				<Button
					class="motion-action"
					variant="destructive"
					onclick={() => {
						isForgotPasswd = true;
						isEditModalOpen = false;
					}}
				>
					Forgot Password
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- FORGOT PASSWORD -->
{#if editingUser}
	<Dialog.Root bind:open={isForgotPasswd}>
		<Dialog.Content class="sm:max-w-[420px]">
			<Dialog.Header>
				<Dialog.Title>Forgot Password</Dialog.Title>
				<Dialog.Description>Enter the password you want to set.</Dialog.Description>
			</Dialog.Header>

			<form method="POST" action="?/resetPassword" use:enhance>
				<input type="hidden" name="user_login" value={editingUser.login} />

				<div class="grid gap-4 py-4">
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="Enter new password"
						autocomplete="new-password"
						required
					/>
				</div>

				<Dialog.Footer>
					<Button
						class="motion-action"
						type="button"
						variant="outline"
						onclick={() => (isForgotPasswd = false)}
					>
						Cancel
					</Button>
					<Button class="motion-action" type="submit">Reset Password</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<style>
	.motion-card,
	.motion-item,
	.motion-action {
		transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
	}

	.motion-card:where(:hover, :focus-within),
	.motion-item:where(:hover, :focus-within),
	.motion-action:where(:hover, :focus-visible) {
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.motion-card,
		.motion-item,
		.motion-action {
			transition: none;
			will-change: auto;
		}

		.motion-card:where(:hover, :focus-within),
		.motion-item:where(:hover, :focus-within),
		.motion-action:where(:hover, :focus-visible) {
			transform: none;
		}
	}
</style>
