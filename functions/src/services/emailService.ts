// functions/src/services/emailService.ts
import nodemailer from 'nodemailer';
import { logger } from 'firebase-functions';
import { getEnvVar } from '../utils/getEnv';

/**
 * Crea el transporter de Nodemailer con las credenciales SMTP configuradas.
 * Soporta Gmail (SMTP_SERVICE=gmail) o cualquier SMTP genérico.
 */
function createTransporter() {
  let smtpUser: string;
  let smtpPass: string;

  try {
    smtpUser = getEnvVar('SMTP_USER');
    smtpPass = getEnvVar('SMTP_PASS');
  } catch {
    return null; // credenciales no configuradas → email deshabilitado
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Envía el email de confirmación post-pago con el link de descarga.
 */
export async function sendDocumentReadyEmail(params: {
  toEmail: string;
  tipoDocumento: string;
  downloadUrl: string;
  option: 'pdf' | 'pdf-word';
}): Promise<void> {
  const { toEmail, tipoDocumento, downloadUrl, option } = params;

  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('[emailService] SMTP no configurado — email no enviado. Configure SMTP_USER y SMTP_PASS en Firebase Secrets.');
    return;
  }

  const formatLabel = option === 'pdf-word' ? 'PDF + Word (.zip)' : 'PDF';
  const expiryHours = 24;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu documento LexaGen está listo</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%); padding: 32px 40px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
        ⚖️ LexaGen
      </h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">
        Documentos legales generados con inteligencia artificial
      </p>
    </div>

    <!-- Body -->
    <div style="padding: 40px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; background: #ecfdf5; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
          <span style="font-size: 40px;">✅</span>
        </div>
        <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 8px; font-weight: 700;">
          ¡Tu documento está listo!
        </h2>
        <p style="color: #64748b; font-size: 15px; margin: 0;">
          Tu <strong>${tipoDocumento}</strong> ha sido generado y está disponible para descarga.
        </p>
      </div>

      <!-- Documento info -->
      <div style="background: #f8fafc; border-radius: 10px; padding: 20px; margin-bottom: 28px; border-left: 4px solid #4F46E5;">
        <p style="margin: 0 0 6px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo de documento</p>
        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${tipoDocumento}</p>
        <p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">Formato: ${formatLabel}</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${downloadUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
          ⬇ Descargar mi documento
        </a>
      </div>

      <!-- Warning -->
      <div style="background: #fff7ed; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          ⚠️ <strong>Este enlace expira en ${expiryHours} horas.</strong> 
          Descarga y guarda tu documento en un lugar seguro.
        </p>
      </div>

      <!-- Steps -->
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
        <p style="color: #475569; font-size: 14px; margin: 0 0 12px; font-weight: 600;">¿Qué hacer ahora?</p>
        <ol style="color: #64748b; font-size: 14px; padding-left: 20px; margin: 0; line-height: 1.8;">
          <li>Descarga el documento usando el botón de arriba</li>
          <li>Revisa que todos los datos estén correctos</li>
          <li>Imprime o envía el documento a la entidad correspondiente</li>
          <li>Guarda el comprobante de entrega (radicado)</li>
        </ol>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 4px;">
        Este email fue enviado porque realizaste una compra en LexaGen.
      </p>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">
        ¿Tienes dudas? Contáctanos en <a href="mailto:soporte@lexagen.co" style="color: #4F46E5;">soporte@lexagen.co</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"LexaGen" <${getEnvVar('SMTP_USER')}>`,
    to: toEmail,
    subject: `✅ Tu ${tipoDocumento} está listo para descargar — LexaGen`,
    html,
    text: `Tu ${tipoDocumento} está listo. Descárgalo aquí (válido por ${expiryHours}h): ${downloadUrl}`,
  });

  logger.info('[emailService] Email enviado correctamente a:', toEmail.slice(0, 4) + '***');
}
