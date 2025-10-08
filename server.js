// server.js - Improved Node/Express implementation for MyStay Email Service
// Handles both guest and host emails with proper name lookup
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

// Create supabase client using service role key (server-side)
const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '');

// HTML email builder
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
													<span style="font-size: 16px; font-weight: 600; color: ${mpesaReceipt ? '#2d3748' : '#cbd5e0'}; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(mpesaReceipt || 'Processing...')}</span>
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
							<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #667eea;">
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
	return nodemailer.createTransporter({
		host: SMTP_HOST,
		port,
		secure,
		auth: { user: SMTP_USER, pass: SMTP_PASS },
	});
}

/**
 * Lookup recipient from database
 * Returns email and name from profiles/guest_profiles or profiles/host_profiles
 */
async function lookupRecipient(recipientId) {
	if (!recipientId) return { email: null, name: null };

	try {
		// Get email from profiles table
		const { data: profile, error: profileErr } = await supabase
			.from('profiles')
			.select('id, email, role')
			.eq('id', recipientId)
			.limit(1)
			.maybeSingle();

		if (profileErr) {
			console.error('Supabase profiles lookup error:', profileErr);
			return { email: null, name: null };
		}

		const email = profile?.email ?? null;
		const role = profile?.role;
		let name = null;

		// Lookup name based on role
		if (role === 'guest') {
			const { data: guest, error: guestErr } = await supabase
				.from('guest_profiles')
				.select('user_id, full_name')
				.eq('user_id', recipientId)
				.limit(1)
				.maybeSingle();

			if (guestErr && guestErr.code !== 'PGRST116') {
				console.warn('guest_profiles lookup warning:', guestErr);
			}
			name = guest?.full_name ?? null;

		} else if (role === 'host') {
			const { data: host, error: hostErr } = await supabase
				.from('host_profiles')
				.select('user_id, first_name, last_name')
				.eq('user_id', recipientId)
				.limit(1)
				.maybeSingle();

			if (hostErr && hostErr.code !== 'PGRST116') {
				console.warn('host_profiles lookup warning:', hostErr);
			}

			if (host) {
				name = `${host.first_name || ''} ${host.last_name || ''}`.trim();
			}
		}

		return { email, name };
	} catch (err) {
		console.error('lookupRecipient unexpected error:', err);
		return { email: null, name: null };
	}
}

/**
 * POST /api/v1/email/send
 *
 * Body:
 * {
 *   mpesa_receipt,              // optional - M-Pesa transaction code
 *   payment_title,              // required - email subject
 *   amount,                     // required - formatted amount string
 *   booking_id,                 // optional - booking reference
 *   email,                      // optional (if provided, used directly)
 *   recipient_id,               // optional (uuid to lookup in profiles)
 *   recipient_name,             // optional (if provided, used; otherwise looked up)
 *   extra_message               // optional - additional info
 * }
 */
app.post('/api/v1/email/send', async (req, res) => {
	try {
		const body = req.body || {};
		const {
			mpesa_receipt,
			payment_title,
			amount,
			booking_id,
			email,
			recipient_id,
			recipient_name,
			extra_message
		} = body;

		// Validate required fields
		if (!payment_title || amount === undefined || amount === null) {
			return res.status(400).json({
				success: false,
				error: 'Missing required fields: payment_title and amount'
			});
		}

		let targetEmail = email ?? null;
		let finalRecipientName = recipient_name ?? '';

		// If email not provided, lookup using recipient_id
		if (!targetEmail) {
			if (!recipient_id) {
				return res.status(400).json({
					success: false,
					error: 'Provide either email or recipient_id'
				});
			}

			const { email: lookedUpEmail, name: lookedUpName } = await lookupRecipient(String(recipient_id));

			if (!lookedUpEmail) {
				return res.status(404).json({
					success: false,
					error: 'Recipient email not found in database'
				});
			}

			targetEmail = lookedUpEmail;

			// Use looked up name only if recipient_name wasn't provided
			if (!finalRecipientName && lookedUpName) {
				finalRecipientName = lookedUpName;
			}
		}

		console.log('Sending email to:', {
			email: targetEmail,
			name: finalRecipientName || '(no name)',
			mpesa_receipt: mpesa_receipt || '(not provided)',
			booking_id: booking_id || '(none)'
		});

		// Build HTML email
		const html = buildHtml({
			recipientName: finalRecipientName,
			paymentTitle: payment_title,
			mpesaReceipt: mpesa_receipt ?? null,
			amount,
			bookingId: booking_id ?? null,
			extraMessage: extra_message ?? null
		});

		// Build plain text version
		const text = `${payment_title}\n\nHi ${finalRecipientName || 'there'},\n\nPayment received.\nAmount: ${amount}\nM-Pesa Receipt: ${mpesa_receipt || 'Processing...'}\n${booking_id ? `Booking ID: ${booking_id}\n` : ''}\n${extra_message ? `\n${extra_message}` : ''}`;

		// Create transporter
		const transporter = createTransporter();

		// Verify SMTP connection (optional but recommended)
		try {
			await transporter.verify();
			console.log('SMTP connection verified successfully');
		} catch (verifyErr) {
			console.warn('SMTP verify warning:', verifyErr?.message || verifyErr);
		}

		// Prepare mail options
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

		// Send email
		const info = await transporter.sendMail(mailOptions);

		console.log('Email sent successfully:', {
			to: targetEmail,
			messageId: info?.messageId,
			response: info?.response
		});

		return res.status(200).json({
			success: true,
			message: 'Email sent successfully',
			to: targetEmail,
			messageId: info?.messageId ?? null
		});

	} catch (err) {
		console.error('Email service error:', err);
		return res.status(500).json({
			success: false,
			error: 'Server error sending email',
			details: err?.message ?? String(err)
		});
	}
});

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({
		ok: true,
		service: 'MyStay Email Service',
		timestamp: new Date().toISOString()
	});
});

// API info endpoint
app.get('/api/v1/info', (req, res) => {
	res.json({
		service: 'MyStay Email Service',
		version: '2.0',
		endpoints: {
			send: 'POST /api/v1/email/send',
			health: 'GET /health'
		},
		features: [
			'Guest and Host email support',
			'Automatic name lookup from database',
			'M-Pesa receipt display',
			'Booking reference tracking',
			'Custom messages support'
		]
	});
});

// 404 handler
app.use((req, res) => {
	res.status(404).json({
		error: 'Route not found',
		availableRoutes: [
			'POST /api/v1/email/send',
			'GET /health',
			'GET /api/v1/info'
		]
	});
});

// Start server
const server = app.listen(Number(PORT), () => {
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`  MyStay Email Service Started Successfully`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`  Port: ${PORT}`);
	console.log(`  SMTP Host: ${SMTP_HOST || '(not configured)'}`);
	console.log(`  From Email: ${FROM_EMAIL || SMTP_USER}`);
	console.log(`  Supabase: ${SUPABASE_URL ? '✓ Connected' : '✗ Not configured'}`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\nShutting down gracefully...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});

process.on('SIGTERM', () => {
	console.log('\nSIGTERM received, shutting down...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEY IMPROVEMENTS IN THIS VERSION:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// 1. ✅ Supports both guest_profiles (full_name) and host_profiles (first_name + last_name)
// 2. ✅ Accepts recipient_name from frontend to avoid lookup delays
// 3. ✅ M-Pesa receipt shows "Processing..." instead of "-" when not available yet
// 4. ✅ Better error logging and debugging
// 5. ✅ Role-based name lookup (guest vs host)
// 6. ✅ Info endpoint for API documentation
// 7. ✅ Improved HTML template with better styling
// 8. ✅ Graceful shutdown handlers
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

