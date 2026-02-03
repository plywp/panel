// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: {
				session: {
					expiresAt: string | Date;
					token: string;
					createdAt: string | Date;
					updatedAt: string | Date;
					ipAddress: string | null;
					userAgent: string | null;
					userId: string;
					impersonatedBy: string | null;
					activeOrganizationId: string | null;
					id: string;
				};
				user: {
					name: string;
					email: string;
					emailVerified: boolean;
					image: string | null;
					createdAt: string | Date;
					updatedAt: string | Date;
					role: string | null;
					banned: boolean | null;
					banReason: string | null;
					banExpires: string | Date | null;
					lang: string;
					id: string;
				};
			};
			user?: {
				id: string;
				role: string | null;
				banned?: boolean | null;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
