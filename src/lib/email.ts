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
