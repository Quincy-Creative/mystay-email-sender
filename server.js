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

// HTML email builder - Works for payments, refunds, and all transaction types
function buildHtml({ recipientName = '', paymentTitle, mpesaReceipt, amount, bookingId, extraMessage }) {
	// Detect if this is a refund based on the title
	const isRefund = paymentTitle && (
		paymentTitle.toLowerCase().includes('refund') ||
		paymentTitle.toLowerCase().includes('reversal') ||
		paymentTitle.toLowerCase().includes('reimbursement')
	);
	
	// Determine transaction label
	const transactionLabel = isRefund ? 'Transaction Details' : 'Payment Details';
	const amountLabel = isRefund ? '💵 Refund Amount' : '💰 Amount Paid';
	const bannerText = isRefund ? '✓ Refund Processed' : '✓ Transaction Successful';
	
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
				background-color: #e8f4f8;
				font-family: 'Sono', Arial, sans-serif;
			}
		</style>
	</head>
	<body style="margin: 0; padding: 0; background-color: #e8f4f8; font-family: 'Sono', Arial, sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #e8f4f8; padding: 40px 20px;">
			<tr>
				<td align="center">
					<!-- Main container with dark blue border -->
					<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; border-radius: 20px; overflow: hidden; border: 4px solid #0437F2; box-shadow: 0 8px 32px rgba(4, 55, 242, 0.15);">
						
						<!-- Header with light blue to green gradient and icons -->
						<tr>
							<td align="center" style="background: linear-gradient(135deg, #d4ebf7 0%, #c8e6d5 100%); padding: 40px 30px 30px 30px;">
								<!-- Success Checkmark Circle -->
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px;">
									<tr>
										<td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 100px; height: 100px; border-radius: 50%; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);">
											<img src="cid:checkmark-icon" alt="Success" style="width: 60px; height: 60px; margin-top: 20px;"/>
										</td>
									</tr>
								</table>
								
								<!-- MyStay Branding -->
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
									<tr>
										<td align="center">
											<img src="cid:mystay-icon" alt="MyStay App Icon" style="width: 48px; height: 48px; border-radius: 10px; vertical-align: middle; margin-right: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);"/>
											<span style="font-size: 26px; font-weight: 700; color: #0437F2; font-family: 'Sono', Arial, sans-serif; vertical-align: middle;">MyStay App</span>
										</td>
									</tr>
								</table>
							</td>
						</tr>
						
						<!-- Success Message Banner -->
						<tr>
							<td align="center" style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); padding: 16px 30px;">
								<h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; font-family: 'Sono', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${bannerText}</h2>
							</td>
						</tr>
						
						<!-- Main content with light blue-green gradient -->
						<tr>
							<td style="background: linear-gradient(180deg, #e0f2fe 0%, #d1fae5 100%); padding: 40px 30px;">
								<h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #0437F2; font-family: 'Sono', Arial, sans-serif; text-align: center;">${escapeHtml(paymentTitle)}</h3>
								
								<p style="margin: 0 0 16px 0; font-size: 15px; color: #1e40af; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
									Hi <strong>${escapeHtml(recipientName || 'there')}</strong>,
								</p>
								<p style="margin: 0 0 32px 0; font-size: 14px; color: #166534; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									Thank you for using MyStay App. Your transaction has been processed successfully. Below are the details:
								</p>
								
								<!-- Transaction details card with white background -->
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 2px solid #0437F2; box-shadow: 0 4px 12px rgba(4, 55, 242, 0.1);">
									<tr>
										<td style="padding: 0;">
											<!-- Details header -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
												<tr>
													<td style="background: linear-gradient(90deg, #0437F2 0%, #0284c7 100%); padding: 14px 24px;">
														<span style="font-size: 14px; font-weight: 700; color: #ffffff; font-family: 'Sono', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${transactionLabel}</span>
													</td>
												</tr>
											</table>
											
											<!-- Details content -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
												<tr>
													<td style="padding: 16px 24px; border-bottom: 1px solid #e0f2fe;">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #1e40af; font-family: 'Sono', Arial, sans-serif; margin-bottom: 4px;">${amountLabel}</span>
														<span style="display: block; font-size: 22px; font-weight: 700; color: #10b981; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(String(amount))}</span>
													</td>
												</tr>
												${mpesaReceipt ? `
												<tr>
													<td style="padding: 16px 24px; ${bookingId ? 'border-bottom: 1px solid #e0f2fe;' : ''}">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #1e40af; font-family: 'Sono', Arial, sans-serif; margin-bottom: 4px;">📱 M-Pesa Receipt</span>
														<span style="display: block; font-size: 15px; font-weight: 600; color: #0437F2; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(mpesaReceipt)}</span>
													</td>
												</tr>
												` : ''}
												${bookingId ? `
												<tr>
													<td style="padding: 16px 24px;">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #1e40af; font-family: 'Sono', Arial, sans-serif; margin-bottom: 4px;">🏠 Booking Reference</span>
														<span style="display: block; font-size: 15px; font-weight: 600; color: #0437F2; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(bookingId)}</span>
													</td>
												</tr>
												` : ''}
											</table>
										</td>
									</tr>
								</table>
								
								${extraMessage ? `
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; background: linear-gradient(135deg, #dbeafe 0%, #fef3c7 100%); border-radius: 10px; border: 2px solid #0437F2; border-left: 6px solid #10b981;">
									<tr>
										<td style="padding: 18px 24px;">
											<p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
												<strong style="color: #0437F2; font-size: 14px;">📌 Important Note:</strong><br/>
												<span style="margin-top: 6px; display: inline-block; font-size: 13px;">${escapeHtml(extraMessage)}</span>
											</p>
										</td>
									</tr>
								</table>
								` : ''}
								
								<!-- Call to action -->
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 32px;">
									<tr>
										<td align="center" style="padding: 18px 24px; background: linear-gradient(135deg, #0437F2 0%, #0284c7 100%); border-radius: 10px; box-shadow: 0 4px 12px rgba(4, 55, 242, 0.3);">
											<p style="margin: 0; font-size: 13px; color: #ffffff; line-height: 1.6; font-family: 'Sono', Arial, sans-serif; font-weight: 500;">
												${isRefund ? '💙 Thank you for your understanding. We look forward to serving you again!' : '🎉 You\'re all set! Happy hosting.'}
											</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
						
						<!-- Footer -->
						<tr>
							<td style="background-color: #f0f9ff; padding: 28px 30px; text-align: center; border-top: 2px solid #bfdbfe;">
								<p style="margin: 0 0 8px 0; font-size: 12px; color: #1e40af; line-height: 1.6; font-family: 'Sono', Arial, sans-serif; font-weight: 500;">
									This is an automated confirmation from MyStay App.<br/>
									Need help? Contact our support team anytime.
								</p>
								<p style="margin: 8px 0 0 0; font-size: 11px; color: #0437F2; font-family: 'Sono', Arial, sans-serif; font-weight: 600;">
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

// HTML email builder for host notifications (listing submission/published/rejected/verified/verification_rejected)
function buildHostHtml({ hostName = '', listingName, emailType = 'submitted', rejectionReason = null, verificationRejectionReason = null }) {
	const isPublished = emailType === 'published';
	const isRejected = emailType === 'rejected';
	const isSubmitted = emailType === 'submitted';
	const isVerified = emailType === 'verified';
	const isVerificationRejected = emailType === 'verification_rejected';
	
	// Determine banner text and styling based on email type
	let bannerText, bannerColor, iconEmoji, iconBgColor, iconShadow;
	
	if (isVerified) {
		bannerText = '✓ Host Verified';
		bannerColor = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
		iconEmoji = '✅';
		iconBgColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
		iconShadow = 'rgba(16, 185, 129, 0.4)';
	} else if (isVerificationRejected) {
		bannerText = '⚠ Verification Not Approved';
		bannerColor = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
		iconEmoji = '❌';
		iconBgColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
		iconShadow = 'rgba(239, 68, 68, 0.4)';
	} else if (isPublished) {
		bannerText = '✓ Listing Published';
		bannerColor = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
		iconEmoji = '🎉';
		iconBgColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
		iconShadow = 'rgba(16, 185, 129, 0.4)';
	} else if (isRejected) {
		bannerText = '⚠ Listing Not Approved';
		bannerColor = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
		iconEmoji = '❌';
		iconBgColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
		iconShadow = 'rgba(239, 68, 68, 0.4)';
	} else {
		bannerText = '✓ Listing Submitted';
		bannerColor = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
		iconEmoji = '📝';
		iconBgColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
		iconShadow = 'rgba(16, 185, 129, 0.4)';
	}
	
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
				background-color: #e8f4f8;
				font-family: 'Sono', Arial, sans-serif;
			}
		</style>
	</head>
	<body style="margin: 0; padding: 0; background-color: #e8f4f8; font-family: 'Sono', Arial, sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #e8f4f8; padding: 40px 20px;">
			<tr>
				<td align="center">
					<!-- Main container with dark blue border -->
					<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; border-radius: 20px; overflow: hidden; border: 4px solid #0437F2; box-shadow: 0 8px 32px rgba(4, 55, 242, 0.15);">
						
						<!-- Header with light blue to green gradient and icons -->
						<tr>
							<td align="center" style="background: linear-gradient(135deg, #d4ebf7 0%, #c8e6d5 100%); padding: 40px 30px 30px 30px;">
								<!-- Status Icon Circle -->
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px;">
									<tr>
										<td align="center" style="background: ${iconBgColor}; width: 100px; height: 100px; border-radius: 50%; box-shadow: 0 6px 20px ${iconShadow};">
											${isRejected || isVerificationRejected ? `
											<span style="display: inline-block; font-size: 50px; margin-top: 25px;">❌</span>
											` : isVerified ? `
											<span style="display: inline-block; font-size: 50px; margin-top: 25px;">✅</span>
											` : `
											<img src="cid:checkmark-icon" alt="Success" style="width: 60px; height: 60px; margin-top: 20px;"/>
											`}
										</td>
									</tr>
								</table>
								
								<!-- MyStay Branding -->
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
									<tr>
										<td align="center">
											<img src="cid:mystay-icon" alt="MyStay App Icon" style="width: 48px; height: 48px; border-radius: 10px; vertical-align: middle; margin-right: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);"/>
											<span style="font-size: 26px; font-weight: 700; color: #0437F2; font-family: 'Sono', Arial, sans-serif; vertical-align: middle;">MyStay App</span>
										</td>
									</tr>
								</table>
							</td>
						</tr>
						
						<!-- Status Message Banner -->
						<tr>
							<td align="center" style="background: ${bannerColor}; padding: 16px 30px;">
								<h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; font-family: 'Sono', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${bannerText}</h2>
							</td>
						</tr>
						
						<!-- Main content with light blue-green gradient -->
						<tr>
							<td style="background: linear-gradient(180deg, #e0f2fe 0%, #d1fae5 100%); padding: 40px 30px;">
								<p style="margin: 0 0 20px 0; font-size: 15px; color: #1e40af; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
									Hi <strong>${escapeHtml(hostName || 'there')}</strong>,
								</p>
								
								${isVerified ? `
								<p style="margin: 0 0 32px 0; font-size: 14px; color: #166534; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									Congratulations! Your host account has been <strong style="color: #0437F2;">successfully verified</strong>. You can now start creating and managing your listings on MyStay App.
								</p>
								<p style="margin: 0 0 32px 0; font-size: 14px; color: #166534; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									Welcome to the MyStay community! We're excited to have you as part of our platform.
								</p>
								` : isVerificationRejected ? `
								<p style="margin: 0 0 24px 0; font-size: 14px; color: #991b1b; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									We're sorry to inform you that your <strong style="color: #0437F2;">host verification request</strong> was not approved after review.
								</p>
								` : isPublished ? `
								<p style="margin: 0 0 32px 0; font-size: 14px; color: #166534; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									We are pleased to inform you that your submission <strong style="color: #0437F2;">'${escapeHtml(listingName)}'</strong> was just published on our app. Thank you.
								</p>
								` : isRejected ? `
								<p style="margin: 0 0 24px 0; font-size: 14px; color: #991b1b; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									We're sorry to inform you that your listing <strong style="color: #0437F2;">'${escapeHtml(listingName)}'</strong> was not approved after review.
								</p>
								` : `
								<p style="margin: 0 0 32px 0; font-size: 14px; color: #166534; line-height: 1.7; font-family: 'Sono', Arial, sans-serif;">
									Thank you for submitting your listing <strong style="color: #0437F2;">'${escapeHtml(listingName)}'</strong>.
								</p>
								`}
								
								${isVerified || isVerificationRejected ? `
								<!-- Verification details card -->
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 2px solid #0437F2; box-shadow: 0 4px 12px rgba(4, 55, 242, 0.1);">
									<tr>
										<td style="padding: 0;">
											<!-- Details header -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
												<tr>
													<td style="background: linear-gradient(90deg, #0437F2 0%, #0284c7 100%); padding: 14px 24px;">
														<span style="font-size: 14px; font-weight: 700; color: #ffffff; font-family: 'Sono', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${isVerified ? 'Verification Status' : 'Verification Information'}</span>
													</td>
												</tr>
											</table>
											
											<!-- Details content -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
												${isVerified ? `
												<tr>
													<td style="padding: 20px 24px;">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #1e40af; font-family: 'Sono', Arial, sans-serif; margin-bottom: 8px;">✅ Account Status</span>
														<span style="display: block; font-size: 18px; font-weight: 700; color: #10b981; font-family: 'Sono', Arial, sans-serif;">Verified</span>
													</td>
												</tr>
												` : ''}
												${isVerificationRejected && verificationRejectionReason ? `
												<tr>
													<td style="padding: 20px 24px;">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #991b1b; font-family: 'Sono', Arial, sans-serif; margin-bottom: 8px;">📋 Rejection Reason</span>
														<span style="display: block; font-size: 14px; color: #7f1d1d; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(verificationRejectionReason)}</span>
													</td>
												</tr>
												` : ''}
											</table>
										</td>
									</tr>
								</table>
								` : `
								<!-- Listing details card -->
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 2px solid #0437F2; box-shadow: 0 4px 12px rgba(4, 55, 242, 0.1);">
									<tr>
										<td style="padding: 0;">
											<!-- Details header -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
												<tr>
													<td style="background: linear-gradient(90deg, #0437F2 0%, #0284c7 100%); padding: 14px 24px;">
														<span style="font-size: 14px; font-weight: 700; color: #ffffff; font-family: 'Sono', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Listing Information</span>
													</td>
												</tr>
											</table>
											
											<!-- Details content -->
											<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
												<tr>
													<td style="padding: 20px 24px; ${isRejected ? 'border-bottom: 1px solid #fee2e2;' : ''}">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #1e40af; font-family: 'Sono', Arial, sans-serif; margin-bottom: 8px;">${iconEmoji} Listing Name</span>
														<span style="display: block; font-size: 18px; font-weight: 700; color: #0437F2; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(listingName)}</span>
													</td>
												</tr>
												${isRejected && rejectionReason ? `
												<tr>
													<td style="padding: 20px 24px;">
														<span style="display: block; font-size: 13px; font-weight: 600; color: #991b1b; font-family: 'Sono', Arial, sans-serif; margin-bottom: 8px;">📋 Rejection Reason</span>
														<span style="display: block; font-size: 14px; color: #7f1d1d; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">${escapeHtml(rejectionReason)}</span>
													</td>
												</tr>
												` : ''}
											</table>
										</td>
									</tr>
								</table>
								`}
								
								${isRejected || isVerificationRejected ? `
								<!-- Rejection notice box -->
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 10px; border: 2px solid #ef4444; border-left: 6px solid #dc2626;">
									<tr>
										<td style="padding: 18px 24px;">
											<p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.6; font-family: 'Sono', Arial, sans-serif;">
												<strong style="color: #dc2626; font-size: 14px;">💡 Next Steps:</strong><br/>
												<span style="margin-top: 6px; display: inline-block; font-size: 13px;">${isVerificationRejected ? 'If you\'d like more information or wish to resubmit your verification request with corrections, please contact our support team. We\'re here to help!' : 'If you\'d like more information or wish to resubmit your listing with corrections, please contact our support team. We\'re here to help!'}</span>
											</p>
										</td>
									</tr>
								</table>
								` : ''}
								
								<!-- Call to action -->
								<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 32px;">
									<tr>
										<td align="center" style="padding: 18px 24px; background: ${isRejected || isVerificationRejected ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #0437F2 0%, #0284c7 100%)'}; border-radius: 10px; box-shadow: 0 4px 12px ${isRejected || isVerificationRejected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(4, 55, 242, 0.3)'};">
											<p style="margin: 0; font-size: 13px; color: #ffffff; line-height: 1.6; font-family: 'Sono', Arial, sans-serif; font-weight: 500;">
												${isVerified ? '🎉 Welcome to MyStay! You can now start creating your first listing and begin hosting guests.' : isVerificationRejected ? '💙 We appreciate your understanding. Please contact support if you have any questions.' : isPublished ? '🎊 Congratulations! Your listing is now live and visible to guests.' : isRejected ? '💙 We appreciate your understanding. Please contact support if you have any questions.' : '⏳ Your listing is under review. We\'ll notify you once it\'s published.'}
											</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
						
						<!-- Footer -->
						<tr>
							<td style="background-color: #f0f9ff; padding: 28px 30px; text-align: center; border-top: 2px solid #bfdbfe;">
								<p style="margin: 0 0 8px 0; font-size: 12px; color: #1e40af; line-height: 1.6; font-family: 'Sono', Arial, sans-serif; font-weight: 500;">
									This is an automated notification from MyStay App.<br/>
									Need help? Contact our support team anytime.
								</p>
								<p style="margin: 8px 0 0 0; font-size: 11px; color: #0437F2; font-family: 'Sono', Arial, sans-serif; font-weight: 600;">
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
			attachments: [
				{
					filename: 'mystay-icon.png',
					path: path.join(__dirname, 'mystay-icon.png'),
					cid: 'mystay-icon' // Content-ID for embedding in HTML
				},
				{
					filename: 'checkmark.png',
					path: path.join(__dirname, 'checkmark.png'),
					cid: 'checkmark-icon' // Content-ID for embedding in HTML
				}
			]
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

/**
 * POST /api/v1/email/host/send
 *
 * Body:
 * {
 *   host_id,                      // optional (uuid to lookup host email and name)
 *   host_email,                   // optional (if provided, used directly)
 *   host_name,                    // optional (if provided, used; otherwise looked up)
 *   listing_name,                // required for listing emails, optional for verification emails
 *   email_type,                   // required - 'submitted', 'published', 'rejected', 'verified', or 'verification_rejected'
 *   rejection_reason,             // optional - required if email_type is 'rejected'
 *   verification_rejection_reason // optional - required if email_type is 'verification_rejected'
 * }
 */
app.post('/api/v1/email/host/send', async (req, res) => {
	try {
		const body = req.body || {};
		const {
			host_id,
			host_email,
			host_name,
			listing_name,
			email_type,
			rejection_reason,
			verification_rejection_reason
		} = body;

		// Validate required fields
		const isVerificationEmail = email_type === 'verified' || email_type === 'verification_rejected';
		const isListingEmail = email_type === 'submitted' || email_type === 'published' || email_type === 'rejected';
		
		if (!email_type) {
			return res.status(400).json({
				success: false,
				error: 'Missing required field: email_type'
			});
		}

		if (isListingEmail && !listing_name) {
			return res.status(400).json({
				success: false,
				error: 'Missing required field: listing_name (required for listing emails)'
			});
		}

		// Validate email_type
		const validEmailTypes = ['submitted', 'published', 'rejected', 'verified', 'verification_rejected'];
		if (!validEmailTypes.includes(email_type)) {
			return res.status(400).json({
				success: false,
				error: `email_type must be one of: ${validEmailTypes.join(', ')}`
			});
		}

		// Validate rejection_reason if email_type is 'rejected'
		if (email_type === 'rejected' && !rejection_reason) {
			return res.status(400).json({
				success: false,
				error: 'rejection_reason is required when email_type is "rejected"'
			});
		}

		// Validate verification_rejection_reason if email_type is 'verification_rejected'
		if (email_type === 'verification_rejected' && !verification_rejection_reason) {
			return res.status(400).json({
				success: false,
				error: 'verification_rejection_reason is required when email_type is "verification_rejected"'
			});
		}

		let targetEmail = host_email ?? null;
		let finalHostName = host_name ?? '';

		// If email not provided, lookup using host_id
		if (!targetEmail) {
			if (!host_id) {
				return res.status(400).json({
					success: false,
					error: 'Provide either host_email or host_id'
				});
			}

			const { email: lookedUpEmail, name: lookedUpName } = await lookupRecipient(String(host_id));

			if (!lookedUpEmail) {
				return res.status(404).json({
					success: false,
					error: 'Host email not found in database'
				});
			}

			targetEmail = lookedUpEmail;

			// Use looked up name only if host_name wasn't provided
			if (!finalHostName && lookedUpName) {
				finalHostName = lookedUpName;
			}
		}

		console.log('Sending host email to:', {
			email: targetEmail,
			name: finalHostName || '(no name)',
			listing_name: listing_name || '(N/A - verification email)',
			email_type: email_type,
			rejection_reason: email_type === 'rejected' ? (rejection_reason || '(not provided)') : '(N/A)',
			verification_rejection_reason: email_type === 'verification_rejected' ? (verification_rejection_reason || '(not provided)') : '(N/A)'
		});

		// Build HTML email
		const html = buildHostHtml({
			hostName: finalHostName,
			listingName: listing_name || '',
			emailType: email_type,
			rejectionReason: rejection_reason || null,
			verificationRejectionReason: verification_rejection_reason || null
		});

		// Build plain text version for all email types
		let subject, text;

		if (email_type === 'published') {
			subject = `Your listing '${listing_name}' has been published`;
			text = `Hi ${finalHostName || 'there'},\n\nWe are pleased to inform you that your submission '${listing_name}' was just published on our app. Thank you.`;
		} else if (email_type === 'submitted') {
			subject = `Your listing '${listing_name}' has been submitted`;
			text = `Hi ${finalHostName || 'there'},\n\nThank you for submitting your listing '${listing_name}'.`;
		} else if (email_type === 'rejected') {
			subject = `Your listing '${listing_name}' was not approved`;
			text = `Hi ${finalHostName || 'there'},\n\nWe're sorry to inform you that your listing '${listing_name}' was not approved after review.\n\nReason: ${rejection_reason}\n\nIf you'd like more information or wish to try again, please contact our support team.`;
		} else if (email_type === 'verified') {
			subject = `Your host account has been verified`;
			text = `Hi ${finalHostName || 'there'},\n\nCongratulations! Your host account has been successfully verified. You can now start creating and managing your listings on MyStay App.\n\nWelcome to the MyStay community!`;
		} else if (email_type === 'verification_rejected') {
			subject = `Host verification not approved`;
			text = `Hi ${finalHostName || 'there'},\n\nWe're sorry to inform you that your host verification request was not approved.\n\nReason: ${verification_rejection_reason}\n\nIf you'd like more information or wish to resubmit your verification, please contact our support team.`;
		}

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
			subject: subject,
			text,
			html,
			attachments: [
				{
					filename: 'mystay-icon.png',
					path: path.join(__dirname, 'mystay-icon.png'),
					cid: 'mystay-icon'
				},
				{
					filename: 'checkmark.png',
					path: path.join(__dirname, 'checkmark.png'),
					cid: 'checkmark-icon'
				}
			]
		};

		// Send email
		const info = await transporter.sendMail(mailOptions);

		console.log('Host email sent successfully:', {
			to: targetEmail,
			messageId: info?.messageId,
			response: info?.response
		});

		return res.status(200).json({
			success: true,
			message: 'Host email sent successfully',
			to: targetEmail,
			messageId: info?.messageId ?? null
		});

	} catch (err) {
		console.error('Host email service error:', err);
		return res.status(500).json({
			success: false,
			error: 'Server error sending host email',
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
		version: '2.1',
		endpoints: {
			send: 'POST /api/v1/email/send',
			hostSend: 'POST /api/v1/email/host/send',
			health: 'GET /health'
		},
		features: [
			'Guest and Host email support',
			'Automatic name lookup from database',
			'M-Pesa receipt display',
			'Booking reference tracking',
			'Custom messages support',
			'Host listing submission notifications',
			'Host listing published notifications'
		]
	});
});

// 404 handler
app.use((req, res) => {
	res.status(404).json({
		error: 'Route not found',
		availableRoutes: [
			'POST /api/v1/email/send',
			'POST /api/v1/email/host/send',
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

