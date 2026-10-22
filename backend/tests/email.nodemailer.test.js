/**
 * Nodemailer 10 compatibility for the emergency-alert e-mail path (Phase 2B.6A dependency upgrade 6.10 -> 10.1.7).
 * No network, no SMTP server, no real credentials: transports are only constructed (nodemailer never connects on
 * createTransport) or use jsonTransport, which renders the message locally.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { createRequire } from 'node:module';
import { generateEmergencyAlertHTML, generateEmergencyAlertText } from '../src/utils/nodemailerHelper.js';

const require = createRequire(import.meta.url);
const user = { id: 'user-1', email: 'person@example.invalid', fullName: 'Test Person' };
const contact = { name: 'Trusted Contact', email: 'contact@example.invalid', relationship: 'friend' };

describe('nodemailer 10 with the option shapes used by src/utils/nodemailerHelper.js and src/config/mailConfig.js', () => {
  test('runs a supported major version on a supported Node runtime', () => {
    assert.equal(Number(require('nodemailer/package.json').version.split('.')[0]), 10);
    assert.ok(Number(process.versions.node.split('.')[0]) >= 20, 'nodemailer 10 requires Node >= 20 (package.json engines)');
  });

  test('well-known services still resolve (gmail, outlook) and custom SMTP / SendGrid options construct without connecting', () => {
    const auth = { user: 'u@example.invalid', pass: 'placeholder-not-a-secret' };
    const gmail = nodemailer.createTransport({ service: 'gmail', auth });
    const outlook = nodemailer.createTransport({ service: 'outlook', auth });
    const smtp = nodemailer.createTransport({ host: 'smtp.example.invalid', port: 465, secure: true, auth });
    const sendgrid = nodemailer.createTransport({ host: 'smtp.sendgrid.net', port: 587, secure: false, auth });
    assert.equal(gmail.transporter.options.host, 'smtp.gmail.com');
    assert.match(String(outlook.transporter.options.host), /outlook|office365/);
    assert.equal(smtp.transporter.options.port, 465); assert.equal(smtp.transporter.options.secure, true);
    assert.equal(sendgrid.transporter.options.host, 'smtp.sendgrid.net');
    for (const t of [gmail, outlook, smtp, sendgrid]) { assert.equal(typeof t.sendMail, 'function'); assert.equal(typeof t.verify, 'function'); t.close(); }
  });

  test('the real emergency-alert templates render into a valid message (html + text, single recipient)', async () => {
    const html = generateEmergencyAlertHTML(user, contact, 'sadness', 'I feel very low today', 'high');
    const text = generateEmergencyAlertText(user, contact, 'sadness', 'I feel very low today', 'high');
    assert.ok(html.length > 100 && text.length > 50);
    const t = nodemailer.createTransport({ jsonTransport: true });
    const info = await t.sendMail({ from: '"MantraAI Alerts" <alerts@example.invalid>', to: contact.email, subject: 'Wellbeing alert', html, text });
    const msg = JSON.parse(info.message);
    assert.deepEqual(info.envelope.to, ['contact@example.invalid']);
    assert.equal(info.envelope.from, 'alerts@example.invalid');
    assert.equal(msg.subject, 'Wellbeing alert');
    assert.equal(msg.html, html, 'html body delivered unchanged');
    assert.equal(msg.text, text, 'text body delivered unchanged');
  });

  test('security fixes are active: a crafted address cannot add a second, unintended recipient domain', async () => {
    const t = nodemailer.createTransport({ jsonTransport: true });
    const info = await t.sendMail({ from: 'alerts@example.invalid', to: '"contact@example.invalid" <contact@example.invalid>', subject: 's', text: 't' });
    assert.deepEqual(info.envelope.to, ['contact@example.invalid']);
    // CR/LF in a header value must never create extra SMTP header lines (header injection).
    const injected = await t.sendMail({ from: 'alerts@example.invalid', to: 'contact@example.invalid', subject: 'hi\r\nBcc: evil@example.invalid', text: 't' });
    assert.deepEqual(injected.envelope.to, ['contact@example.invalid']);
  });
});
