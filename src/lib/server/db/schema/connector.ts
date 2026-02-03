import { mysqlTable, int, text, boolean, mysqlEnum, varchar, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { location } from './location';

export const connector = mysqlTable(
	'connector',
	{
		id: int('id').primaryKey().autoincrement(),

		token: text('token').notNull().unique(),

		fqdn: varchar('fqdn', { length: 191 }).notNull(),

		daemonSslEnabled: boolean('daemon_ssl_enabled').notNull().default(false),
		daemonSslCrt: text('daemon_ssl_crt'),
		daemonSslKey: text('daemon_ssl_key'),

		dataDir: text('data_dir').notNull(),
		webServer: text('web_server').notNull(),

		autoSsl: boolean('auto_ssl').notNull().default(false),

		sslIssuerEnabled: boolean('ssl_issuer_enabled').notNull().default(false),
		sslIssuerMode: varchar('ssl_issuer_mode', { length: 32 }),
		sslIssuerEmail: varchar('ssl_issuer_email', { length: 191 }),
		sslIssuerCaDirUrl: text('ssl_issuer_ca_dir_url'),
		sslIssuerAcceptTos: boolean('ssl_issuer_accept_tos').notNull().default(false),
		sslIssuerKeyType: varchar('ssl_issuer_key_type', { length: 32 }),
		sslIssuerAccountDir: text('ssl_issuer_account_dir'),
		sslIssuerIncludeWww: varchar('ssl_issuer_include_www', { length: 16 }),
		sslIssuerRenewEnabled: boolean('ssl_issuer_renew_enabled').notNull().default(false),
		sslIssuerRenewIntervalHours: int('ssl_issuer_renew_interval_hours'),
		sslIssuerCertPath: text('ssl_issuer_cert_path'),
		sslIssuerKeyPath: text('ssl_issuer_key_path'),
		sslIssuerWebrootPath: text('ssl_issuer_webroot_path'),
		sslIssuerTimeoutSeconds: int('ssl_issuer_timeout_seconds'),
		sslIssuerExpectedIps: text('ssl_issuer_expected_ips'),
		sslIssuerVerifyDns: boolean('ssl_issuer_verify_dns').notNull().default(true),
		sslIssuerVerifyHttp: boolean('ssl_issuer_verify_http').notNull().default(true),

		dnsServerAddress: text('dns_server_address').notNull(),
		dnsServerPort: int('dns_server_port').notNull().default(53),
		dnsServerProto: mysqlEnum('dns_server_proto', ['tcp', 'udp', 'both']).notNull().default('tcp'),

		serverIp: varchar('server_ip', { length: 191 }).notNull(),

		locationId: int('location_id')
			.notNull()
			.references(() => location.id, {
				onDelete: 'restrict',
				onUpdate: 'cascade'
			})
	},
	(t) => ({
		locationIdx: index('connector_location_id_idx').on(t.locationId)
	})
);

export const connectorRelations = relations(connector, ({ one }) => ({
	location: one(location, {
		fields: [connector.locationId],
		references: [location.id]
	})
}));
