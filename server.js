// server.js - Node/Express implementation using Nodemailer + Supabase
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const {
	SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASS,
	FROM_EMAIL,
	FROM_NAME,
	PORT = 8001
} = process.env;

// Basic env validation
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Profile lookups will fail.');
}
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
	console.warn('Warning: SMTP_HOST/SMTP_USER/SMTP_PASS not fully configured.');
}

// create supabase client using service role key (server-side)
const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '');

// html builder
function buildHtml({ recipientName = '', paymentTitle, mpesaReceipt, amount, bookingId, extraMessage }) {
	return `<!doctype html>
  <html>
  <head><meta charset="utf-8"/></head>
  <body style="font-family: Arial, sans-serif; color: #111; line-height:1.4;">
    <h2 style="color:#1a73e8;">${escapeHtml(paymentTitle)}</h2>
    <p>Hi ${escapeHtml(recipientName || 'there')},</p>
    <p>Thanks — we've received your payment. Details below:</p>
    <table style="border-collapse:collapse; width:100%; max-width:600px;">
      <tr><td style="padding:8px; font-weight:600;">Amount</td><td style="padding:8px;">${escapeHtml(String(amount))}</td></tr>
      <tr><td style="padding:8px; font-weight:600;">Mpesa Receipt</td><td style="padding:8px;">${escapeHtml(mpesaReceipt ?? '-')}</td></tr>
      ${bookingId ? `<tr><td style="padding:8px; font-weight:600;">Booking ID</td><td style="padding:8px;">${escapeHtml(bookingId)}</td></tr>` : ''}
    </table>
    ${extraMessage ? `<p style="margin-top:16px;"><strong>Note:</strong> ${escapeHtml(extraMessage)}</p>` : ''}
    <p style="margin-top:20px;color:#666;font-size:12px;">This is an automated message from MyStay.</p>
  </body>
  </html>`;
}

function escapeHtml(s) {
	if (s === null || s === undefined) return '';
	return String(s)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

// Create nodemailer transporter
function createTransporter() {
	const port = SMTP_PORT ? Number(SMTP_PORT) : 465;
	const secure = port === 465;
	return nodemailer.createTransport({
		host: SMTP_HOST,
		port,
		secure,
		auth: { user: SMTP_USER, pass: SMTP_PASS },
		// tls: { rejectUnauthorized: false } // only if you need to relax TLS in dev
	});
}

// Lookup recipient: try profiles.email, then guest_profiles.full_name
async function lookupRecipient(recipientId) {
	if (!recipientId) return { email: null, full_name: null };

	try {
		const { data: profile, error: profileErr } = await supabase
			.from('profiles')
			.select('id, email')
			.eq('id', recipientId)
			.limit(1)
			.maybeSingle();

		if (profileErr) {
			console.error('Supabase profiles lookup error:', profileErr);
			return { email: null, full_name: null };
		}
		const email = profile?.email ?? null;

		const { data: guest, error: guestErr } = await supabase
			.from('guest_profiles')
			.select('user_id, full_name')
			.eq('user_id', recipientId)
			.limit(1)
			.maybeSingle();

		if (guestErr && guestErr.code !== 'PGRST116') { // not a real rule, but log errors
			// guest may not exist; don't fail the whole operation
			console.warn('guest_profiles lookup warning:', guestErr);
		}
		const full_name = guest?.full_name ?? null;

		return { email, full_name };
	} catch (err) {
		console.error('lookupRecipient unexpected error:', err);
		return { email: null, full_name: null };
	}
}

/**
 * POST /api/v1/email/send
 *
 * Body:
 * {
 *   mpesa_receipt,              // optional
 *   payment_title,              // required
 *   amount,                     // required
 *   booking_id,                 // optional
 *   email,                      // optional (if provided, used)
 *   recipient_id,               // optional (uuid to lookup in profiles/guest_profiles)
 *   extra_message               // optional
 * }
 */
app.post('/api/v1/email/send', async (req, res) => {
	try {
		const body = req.body || {};
		const { mpesa_receipt, payment_title, amount, booking_id, email, recipient_id, extra_message } = body;

		if (!payment_title || amount === undefined || amount === null) {
			return res.status(400).json({ success: false, error: 'Missing required fields: payment_title and amount' });
		}

		let targetEmail = email ?? null;
		let recipientName = '';

		if (!targetEmail) {
			if (!recipient_id) {
				return res.status(400).json({ success: false, error: 'Provide either email or recipient_id' });
			}
			const { email: lookedUpEmail, full_name } = await lookupRecipient(String(recipient_id));
			if (!lookedUpEmail) {
				return res.status(404).json({ success: false, error: 'Recipient email not found' });
			}
			targetEmail = lookedUpEmail;
			recipientName = full_name ?? '';
		}

		// Build message
		const html = buildHtml({
			recipientName,
			paymentTitle: payment_title,
			mpesaReceipt: mpesa_receipt ?? null,
			amount,
			bookingId: booking_id ?? null,
			extraMessage: extra_message ?? null
		});
		const text = `${payment_title}\n\nPayment received.\nAmount: ${amount}\nMpesa receipt: ${mpesa_receipt ?? '-'}\n${extra_message ?? ''}`;

		// Send via nodemailer
		const transporter = createTransporter();

		// Optional verify (will detect auth / connection issues early)
		try {
			await transporter.verify();
		} catch (verifyErr) {
			// warn but continue — sendMail will provide final error
			console.warn('SMTP verify failed (warning):', verifyErr && verifyErr.message ? verifyErr.message : verifyErr);
		}

		const mailOptions = {
			from: `${FROM_NAME || 'MyStay'} <${FROM_EMAIL || SMTP_USER}>`,
			to: targetEmail,
			subject: payment_title,
			text,
			html
		};

		const info = await transporter.sendMail(mailOptions);

		return res.status(200).json({
			success: true,
			message: 'Email sent',
			to: targetEmail,
			messageId: info?.messageId ?? null
		});
	} catch (err) {
		console.error('send-email error:', err);
		return res.status(500).json({
			success: false,
			error: 'Server error sending email',
			details: err?.message ?? String(err)
		});
	}
});

// health check
app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const server = app.listen(Number(PORT || 8001), () => {
	console.log(`MyStay email service listening on port ${PORT || 8001}`);
});

// graceful shutdown
process.on('SIGINT', () => {
	console.log('Shutting down');
	server.close(() => process.exit(0));
});
