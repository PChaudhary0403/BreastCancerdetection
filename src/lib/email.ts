import nodemailer from "nodemailer"

export async function sendVerificationEmail(to: string, token: string) {
    const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`

    // If SMTP vars aren't provided, log the email link for development purposes.
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("\n=============================================")
        console.warn("⚠️ SMTP credentials not found in environment!")
        console.warn(`Simulating Email to: ${to}`)
        console.warn(`Click this link to verify: ${verificationUrl}`)
        console.warn("=============================================\n")
        return true
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        })

        const mailOptions = {
            from: process.env.EMAIL_FROM || "noreply@breastscreen.ai",
            to,
            subject: "Verify Your Email - BreastScreenAI",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(to right, #2563eb, #4f46e5); padding: 24px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">BreastScreenAI</h1>
                    </div>
                    <div style="padding: 32px; background-color: #ffffff;">
                        <h2 style="color: #1e293b; margin-top: 0;">Confirm your email address</h2>
                        <p style="color: #475569; line-height: 1.6;">
                            Thank you for registering. Please click the button below to verify your email address and activate your account.
                        </p>
                        <div style="text-align: center; margin: 32px 0;">
                            <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                                Verify Email
                            </a>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">
                            Or copy and paste this link into your browser:<br/>
                            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
                        </p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                        <p style="margin: 0;">If you didn't create an account, you can safely ignore this email.</p>
                    </div>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)
        return true
    } catch (error) {
        console.error("Failed to send verification email:", error)
        // Throwing error allows the API route to handle it gracefully if needed
        throw new Error("Failed to send verification email")
    }
}

export async function sendOTPEmail(to: string, otp: string) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("\n=============================================")
        console.warn("⚠️ SMTP credentials not found in environment!")
        console.warn(`Simulating OTP Email to: ${to}`)
        console.warn(`Your OTP code is: ${otp}`)
        console.warn("=============================================\n")
        return true
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        })

        const mailOptions = {
            from: process.env.EMAIL_FROM || "noreply@breastscreen.ai",
            to,
            subject: "Your Registration OTP - BreastScreenAI",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(to right, #2563eb, #4f46e5); padding: 24px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">BreastScreenAI</h1>
                    </div>
                    <div style="padding: 32px; background-color: #ffffff;">
                        <h2 style="color: #1e293b; margin-top: 0;">Verify your email address</h2>
                        <p style="color: #475569; line-height: 1.6;">
                            Please use the following One-Time Password (OTP) to complete your registration. This code is valid for 10 minutes.
                        </p>
                        <div style="text-align: center; margin: 32px 0;">
                            <div style="background-color: #f1f5f9; padding: 16px 24px; border-radius: 8px; display: inline-block;">
                                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e293b;">${otp}</span>
                            </div>
                        </div>
                    </div>
                    <div style="background-color: #f8fafc; padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                        <p style="margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
                    </div>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)
        return true
    } catch (error) {
        console.error("Failed to send OTP email:", error)
        throw new Error("Failed to send OTP email")
    }
}

export async function sendResultEmail(
    to: string,
    patientName: string,
    summaryText: string,
    recommendationText: string,
    doctorName: string,
    biradsClassification?: number,
    clinicalNotes?: string
) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("\n=============================================")
        console.warn("⚠️ SMTP credentials not found in environment!")
        console.warn(`Simulating Result Email to: ${to}`)
        console.warn(`Summary: ${summaryText}`)
        console.warn(`Recommendation: ${recommendationText}`)
        if (biradsClassification !== undefined) console.warn(`BI-RADS: ${biradsClassification}`)
        if (clinicalNotes) console.warn(`Clinical Notes: ${clinicalNotes}`)
        console.warn("=============================================\n")
        return true
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        })

        // Build optional sections as separate strings to avoid nested template literal issues
        const biradsSection = biradsClassification !== undefined
            ? `<div style="margin: 32px 0;">
                    <h3 style="color: #1e293b; margin-bottom: 8px;">BI-RADS Classification</h3>
                    <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; color: #334155; font-weight: bold;">
                        Category ${biradsClassification}
                    </div>
                </div>`
            : ''

        const clinicalNotesSection = clinicalNotes
            ? `<div style="margin: 32px 0;">
                    <h3 style="color: #1e293b; margin-bottom: 8px;">Clinical Notes</h3>
                    <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; color: #334155;">
                        ${clinicalNotes}
                    </div>
                </div>`
            : ''

        const mailOptions = {
            from: process.env.EMAIL_FROM || "noreply@breastscreen.ai",
            to,
            subject: "Your Mammography Screening Results - BreastScreenAI",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(to right, #2563eb, #4f46e5); padding: 24px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">BreastScreenAI</h1>
                    </div>
                    <div style="padding: 32px; background-color: #ffffff;">
                        <h2 style="color: #1e293b; margin-top: 0;">Hello ${patientName},</h2>
                        <p style="color: #475569; line-height: 1.6;">
                            Your recent mammography screening results have been reviewed by Dr. ${doctorName}.
                        </p>
                        
                        <div style="margin: 32px 0;">
                            <h3 style="color: #1e293b; margin-bottom: 8px;">Analysis Summary</h3>
                            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; color: #334155;">
                                ${summaryText}
                            </div>
                        </div>

                        ${biradsSection}

                        ${clinicalNotesSection}

                        <div style="margin: 32px 0;">
                            <h3 style="color: #1e293b; margin-bottom: 8px;">Recommendation</h3>
                            <div style="background-color: #eff6ff; padding: 16px; border-left: 4px solid #3b82f6; color: #1e40af;">
                                ${recommendationText}
                            </div>
                        </div>

                        <p style="color: #475569; line-height: 1.6; margin-top: 24px;">
                            If you have any questions or concerns regarding these results, please do not hesitate to contact your healthcare provider.
                        </p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                        <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
                        <p style="margin: 4px 0 0 0;">BreastScreenAI &copy; ${new Date().getFullYear()}</p>
                    </div>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)
        return true
    } catch (error) {
        console.error("Failed to send result email:", error)
        throw new Error("Failed to send result email")
    }
}

