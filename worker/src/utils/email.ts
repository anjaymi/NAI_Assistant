
export class EmailService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async sendEmail(to: string, subject: string, html: string) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'NAI Assistant <noreply@miaoneco.abrdns.com>',
                    to: [to],
                    subject: subject,
                    html: html
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Email send failed:', res.status, errorText);
                throw new Error(`Resend API Error: ${res.status} ${errorText}`);
            }

            const data = await res.json();
            return { success: true, data };
        } catch (error) {
            console.error('Email service error:', error);
            // Don't throw, return success false so we don't crash the worker, 
            // but the caller might want to know for debugging. 
            // Actually, in the caller we just want to know if it worked.
            return { success: false, error };
        }
    }

    async sendVerificationEmail(to: string, code: string) {
        return this.sendEmail(to, '【NAI Assistant】验证你的邮箱', `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>邮箱验证</h2>
                <p>你好，</p>
                <p>你的验证码是：</p>
                <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #18181b;">${code}</span>
                </div>
                <p style="color: #71717a; font-size: 14px;">此验证码将在 10 分钟后过期。如果你并没有请求此验证码，请忽略此邮件。</p>
            </div>
        `);
    }

    async sendPasswordResetEmail(to: string, code: string) {
        return this.sendEmail(to, '【NAI Assistant】重置密码', `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>重置密码</h2>
                <p>你好，</p>
                <p>我们收到了重置你密码的请求。你的重置验证码是：</p>
                <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #18181b;">${code}</span>
                </div>
                <p style="color: #71717a; font-size: 14px;">如果你并没有请求重置密码，请忽略此邮件。</p>
            </div>
        `);
    }
}
