import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email simulated] to=${to}\nsubject: ${subject}\n${text}\n`);
    return { status: 'simulated' };
  }
  await t.sendMail({ from: env.smtp.from, to, subject, text });
  return { status: 'sent' };
}

export async function sendSms({ to, body }) {
  const { sid, token, from } = env.twilio;
  if (!sid || !token || !from) {
    console.log(`[sms simulated] to=${to}\n${body}\n`);
    return { status: 'simulated' };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `SMS provider returned ${res.status}`);
  }
  return { status: 'sent' };
}
