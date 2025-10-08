// server.js - Node/Express implementation using Nodemailer + Supabase
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

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
				<head>
					<meta charset="utf-8"/>
					<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
					<link href="https://fonts.googleapis.com/css2?family=Sono:wght@400;500;600;700&display=swap" rel="stylesheet">
					<style>
						body {
							margin: 0;
							padding: 0;
							background-color: #f4f7fc;
							font-family: 'Sono', Arial, sans-serif;
						}
					</style>
				</head>
				<body style="margin: 0; padding: 0; background-color: #f4f7fc; font-family: 'Sono', Arial, sans-serif;">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f7fc; padding: 40px 20px;">
						<tr>
							<td align="center">
								<!-- Main container -->
								<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden;">
									<!-- Header with icon and branding -->
									<tr>
										<td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px;">
											<img src="cid:mystay-icon" alt="MyStay App Icon" style="width: 80px; height: 80px; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);"/>
											<h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; font-family: 'Sono', Arial, sans-serif;">MyStay App</h1>
										</td>
									</tr>
									
									<!-- Main content -->
									<tr>
										<td style="padding: 40px 30px;">
											<h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1a202c; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(paymentTitle)}</h2>
											<p style="margin: 0 0 24px 0; font-size: 16px; color: #4a5568; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
												Hi <strong>${escapeHtml(recipientName || 'there')}</strong>,
											</p>
											<p style="margin: 0 0 32px 0; font-size: 16px; color: #4a5568; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
												Thank you! We've successfully received your payment. Here are your payment details:
											</p>
											
											<!-- Payment details card -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f7fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
												<tr>
													<td style="padding: 20px 24px;">
														<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
															<tr>
																<td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
																	<span style="font-size: 14px; font-weight: 600; color: #718096; font-family: 'Sono', Arial, sans-serif;">Amount</span>
																</td>
																<td align="right" style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
																	<span style="font-size: 18px; font-weight: 700; color: #2d3748; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(String(amount))}</span>
																</td>
															</tr>
															<tr>
																<td style="padding: 12px 0; ${bookingId ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
																	<span style="font-size: 14px; font-weight: 600; color: #718096; font-family: 'Sono', Arial, sans-serif;">M-Pesa Receipt</span>
																</td>
																<td align="right" style="padding: 12px 0; ${bookingId ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
																	<span style="font-size: 16px; font-weight: 600; color: #2d3748; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(mpesaReceipt ?? '-')}</span>
																</td>
															</tr>
															${bookingId ? `
															<tr>
																<td style="padding: 12px 0;">
																	<span style="font-size: 14px; font-weight: 600; color: #718096; font-family: 'Sono', Arial, sans-serif;">Booking ID</span>
																</td>
																<td align="right" style="padding: 12px 0;">
																	<span style="font-size: 16px; font-weight: 600; color: #2d3748; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(bookingId)}</span>
																</td>
															</tr>
															` : ''}
														</table>
													</td>
												</tr>
											</table>
											
											${extraMessage ? `
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; background-color: #fff5f5; border-radius: 8px; border-left: 4px solid #667eea;">
												<tr>
													<td style="padding: 16px 20px;">
														<p style="margin: 0; font-size: 14px; color: #2d3748; line-height: 1.5; font-family: 'Sono', Arial, sans-serif;">
															<strong style="color: #667eea;">Note:</strong> ${escapeHtml(extraMessage)}
														</p>
													</td>
												</tr>
											</table>
											` : ''}
										</td>
									</tr>
									
									<!-- Footer -->
									<tr>
										<td style="background-color: #f7fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
											<p style="margin: 0; font-size: 13px; color: #718096; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
												This is an automated message from MyStay App.<br/>
												If you have any questions, please contact our support team.
											</p>
											<p style="margin: 12px 0 0 0; font-size: 12px; color: #a0aec0; font-family: 'Sono', Arial, sans-serif;">
												© ${new Date().getFullYear()} MyStay. All rights reserved.
											</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
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
			html,
			attachments: [{
				filename: 'mystay-icon.png',
				path: path.join(__dirname, 'mystay-icon.png'),
				cid: 'mystay-icon' // Content-ID for embedding in HTML
			}]
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
