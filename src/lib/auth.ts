import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$lib/server/db';
import { admin, organization, apiKey } from 'better-auth/plugins';
import * as schema from '$lib/server/db/schema';
import { createAuthEndpoint } from 'better-auth/api';
import { createAuthMiddleware } from 'better-auth/plugins';
import { sessionMiddleware } from 'better-auth/api';
import { sendEmail } from '$lib/server/email';

const schemaPlugin = () => {
	return {
		id: 'schema',
		schema: {
			wp_site: {
				fields: {
					organizationId: {
						type: 'string',
						required: true,
						input: true,
						references: {
							model: 'organization',
							field: 'id'
						}
					},
					connectorId: { type: 'number', required: false, input: true },
					internalId: { type: 'string', required: true, input: true },
					name: { type: 'string', required: true, input: true },
					description: { type: 'string', required: false, input: true },
					domain: { type: 'string', required: true, input: true },
					docroot: { type: 'string', required: true, input: true },

					adminUsername: { type: 'string', required: true, input: true },
					adminPassword: { type: 'string', required: true, input: true },
					adminEmail: { type: 'string', required: true, input: true },

					diskLimitMb: { type: 'number', required: true, input: true, defaultValue: 1024 },

					dbHost: { type: 'string', required: true, input: true, defaultValue: '127.0.0.1' },
					dbName: { type: 'string', required: true, input: true },
					dbUser: { type: 'string', required: true, input: true },
					dbPassword: { type: 'string', required: true, input: true },
					tablePrefix: { type: 'string', required: true, input: true, defaultValue: 'wp_' },
					phpVersion: { type: 'string', required: false, input: true },
					status: { type: 'string', required: true, input: true, defaultValue: 'provisioning' }
				}
			}
		},
		hooks: {
			before: [
				{
					matcher: (context) => {
						return context.headers?.get('x-my-header') === 'my-value';
					},
					handler: createAuthMiddleware(async (ctx) => {
						const session = await getSessionFromCtx(ctx);
						return {
							context: ctx
						};
					})
				}
			]
		},
		endpoints: {
			listServices: createAuthEndpoint(
				'/wp-site/list',
				{
					method: 'GET',
					use: [sessionMiddleware]
				},
				async (ctx) => {
					const session = ctx.context.session;
					if (!session) {
						throw new Error('Unauthorized');
					}

					const activeOrganizationId = session.session.activeOrganizationId;

					if (!activeOrganizationId) {
						return ctx.json(
							{
								error: 'No active organization selected'
							},
							{ status: 400 }
						);
					}
					const sites = await ctx.context.adapter.findMany({
						model: 'wp_site',
						where: [
							{
								field: 'organizationId',
								value: activeOrganizationId
							}
						]
					});

					return ctx.json({
						organizationId: activeOrganizationId,
						sites: sites
					});
				}
			)
		}
	} satisfies BetterAuthPlugin;
};

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'mysql'
	}),
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: 'Verify your email',
				html: `<p>Verify your email address by clicking the link below:</p><p><a href="${url}">Verify email</a></p>`,
				text: `Verify your email: ${url}`
			});
		}
	},
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: 'Reset your password',
				html: `<p>Reset your password by clicking the link below:</p><p><a href="${url}">Reset password</a></p>`,
				text: `Reset your password: ${url}`
			});
		}
	},
	user: {
		additionalFields: {
			lang: {
				type: 'string',
				required: true,
				defaultValue: 'en_US',
				input: true
			}
		}
	},
	plugins: [
		admin(),
		organization({
			schema: {
				organization: {
					additionalFields: {
						wpSites: {
							type: 'string',
							required: false,
							input: false,
							references: {
								model: 'wp_site',
								field: 'id'
							}
						}
					}
				}
			}
		}),
		schemaPlugin(),
		apiKey({
			defaultPrefix: 'ply_',
			enableMetadata: true
		})
	]
});
