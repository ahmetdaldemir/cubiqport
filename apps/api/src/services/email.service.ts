import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

function getTransporter() {
  const host = (config as Record<string, unknown>).SMTP_HOST as string | undefined;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt((config as Record<string, unknown>).SMTP_PORT as string ?? '587'),
    secure: ((config as Record<string, unknown>).SMTP_SECURE as string) === 'true',
    auth: {
      user: (config as Record<string, unknown>).SMTP_USER as string,
      pass: (config as Record<string, unknown>).SMTP_PASS as string,
    },
  });
}

const FROM = (config as Record<string, unknown>).SMTP_FROM as string ?? 'noreply@cubiqport.com';

interface WelcomeMailOpts {
  to: string;
  password: string;
  loginUrl: string;
}

export async function sendWelcomeEmail({ to, password, loginUrl }: WelcomeMailOpts) {
  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px; }
    .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,.8); margin: 6px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .cred-box { background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .cred-box p { margin: 0 0 8px; font-size: 13px; color: #6b7280; }
    .cred-box strong { font-size: 15px; color: #111827; }
    .btn { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CubiqPort'a Hoş Geldiniz</h1>
      <p>Hesabınız oluşturuldu</p>
    </div>
    <div class="body">
      <p style="color:#374151;font-size:15px;">Merhaba,</p>
      <p style="color:#6b7280;font-size:14px;">CubiqPort hesabınız sistem yöneticisi tarafından oluşturuldu. Aşağıdaki bilgilerle giriş yapabilirsiniz:</p>
      <div class="cred-box">
        <p>E-posta</p>
        <strong>${to}</strong><br><br>
        <p>Şifre</p>
        <strong>${password}</strong>
      </div>
      <p style="color:#6b7280;font-size:13px;">Güvenliğiniz için ilk girişten sonra şifrenizi değiştirmenizi öneririz.</p>
      <p style="margin-top:24px;">
        <a href="${loginUrl}" class="btn">Giriş Yap</a>
      </p>
    </div>
    <div class="footer">
      CubiqPort — Sunucu Yönetim Paneli<br>
      Bu e-postayı beklenmiyorsa lütfen dikkate almayın.
    </div>
  </div>
</body>
</html>`;

  if (!transporter) {
    logger.warn({ to, password }, '[Email] SMTP yapılandırılmamış — hoşgeldin maili gönderilmedi (kimlik bilgileri loglandı)');
    return;
  }

  await transporter.sendMail({ from: FROM, to, subject: 'CubiqPort Hesabınız Hazır', html });
  logger.info({ to }, '[Email] Hoşgeldin maili gönderildi');
}

export async function sendSuspendEmail(to: string, reason?: string) {
  const transporter = getTransporter();
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:20px;">
  <div style="max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="background:#ef4444;padding:24px;text-align:center;">
      <h2 style="color:#fff;margin:0;">Hesabınız Askıya Alındı</h2>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;">Hesabınız sistem yöneticisi tarafından askıya alınmıştır.</p>
      ${reason ? `<p style="color:#6b7280;font-size:13px;"><strong>Sebep:</strong> ${reason}</p>` : ''}
      <p style="color:#6b7280;font-size:13px;">Daha fazla bilgi için <a href="mailto:info@cubiqport.com">info@cubiqport.com</a> adresine başvurun.</p>
    </div>
  </div>
</body>
</html>`;

  if (!transporter) {
    logger.warn({ to }, '[Email] SMTP yapılandırılmamış — askıya alma maili gönderilemedi');
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject: 'CubiqPort Hesabınız Askıya Alındı', html });
}

export interface TestDatabaseCreatedMailOpts {
  to: string;
  dbName: string;
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
  storageLimitMb: number;
}

export async function sendTestDatabaseCreatedEmail(opts: TestDatabaseCreatedMailOpts) {
  const transporter = getTransporter();
  const { to, dbName, type, host, port, username, password, databaseName, storageLimitMb } = opts;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0ea5e9, #06b6d4); padding: 28px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .header p { color: rgba(255,255,255,.9); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 28px; }
    .cred-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; }
    .cred-box p { margin: 0 0 6px; color: #0c4a6e; }
    .cred-box strong, .cred-box code { color: #0369a1; word-break: break-all; }
    .footer { padding: 16px 28px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Demo veritabanı oluşturuldu</h1>
      <p>${dbName} — ${type === 'postgres' ? 'PostgreSQL' : 'MySQL'} (${storageLimitMb} MB)</p>
    </div>
    <div class="body">
      <p style="color:#374151;font-size:14px;">Bağlantı bilgileriniz aşağıdadır. Bu bilgileri güvenli saklayın.</p>
      <div class="cred-box">
        <p><strong>Host</strong></p>
        <code>${host}</code>
        <p style="margin-top:10px;"><strong>Port</strong></p>
        <code>${port}</code>
        <p style="margin-top:10px;"><strong>Kullanıcı</strong></p>
        <code>${username}</code>
        <p style="margin-top:10px;"><strong>Şifre</strong></p>
        <code>${password}</code>
        <p style="margin-top:10px;"><strong>Veritabanı adı</strong></p>
        <code>${databaseName}</code>
      </div>
      <p style="color:#6b7280;font-size:13px;">Örnek bağlantı: <code>${type}://${username}:****@${host}:${port}/${databaseName}</code></p>
    </div>
    <div class="footer">
      CubiqPort — Demo veritabanı bilgileri. Bu e-postayı kimseyle paylaşmayın.
    </div>
  </div>
</body>
</html>`;

  if (!transporter) {
    logger.warn({ to, dbName }, '[Email] SMTP yapılandırılmamış — test DB bilgileri maili gönderilmedi');
    return;
  }
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `CubiqPort — Demo veritabanı: ${dbName}`,
    html,
  });
  logger.info({ to, dbName }, '[Email] Test DB bilgileri maili gönderildi');
}
