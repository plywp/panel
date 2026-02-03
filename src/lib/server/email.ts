import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

type EmailPayload = {
	to: string;
	subject: string;
	html: string;
	text?: string;
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
	if (transporter) return transporter;

	if (!env.SMTP_HOST) {
		throw new Error('SMTP_HOST is not set');
	}

	const port = Number(env.SMTP_PORT ?? '587');
	const secure = env.SMTP_SECURE === 'true' || port === 465;
	const auth = env.SMTP_USER
		? {
				user: env.SMTP_USER,
				pass: env.SMTP_PASS ?? ''
			}
		: undefined;

	if (env.SMTP_USER && !env.SMTP_PASS) {
		throw new Error('SMTP_PASS is not set');
	}

	transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port,
		secure,
		auth
	});

	return transporter;
};

const getFromAddress = () => {
	const from = env.SMTP_FROM || env.SMTP_USER;
	if (!from) {
		throw new Error('SMTP_FROM is not set');
	}
	return from;
};

export const sendEmail = async ({ to, subject, html, text }: EmailPayload) => {
	if (env.SMTP_ENABLED === 'false' || env.SMTP_ENABLED === '0') {
		return;
	}

	const mailer = getTransporter();
	await mailer.sendMail({
		from: getFromAddress(),
		to,
		subject,
		html,
		text
	});
};
