const nodemailer = require('nodemailer');
const cors = require('cors');
// CORS
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || ''
const AllowedOrigins = allowedOriginsEnv
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman, server-to-server)
    if (!origin) return callback(null, true);
    // If env is not configured, allow all origins instead of crashing the function.
    if (AllowedOrigins.length === 0) return callback(null, true);

    if (AllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ['POST', 'OPTIONS'],
});

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

// Create transporter once (better performance)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default async function handler(req, res) {
  try {
    // Run CORS middleware
    await runMiddleware(req, res, corsMiddleware);
  } catch (error) {
    return res.status(403).json({
      message: 'CORS rejected request',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, content, subject, htmlContent, replyTo } = parseBody(req);

  if (!email || (!content && !htmlContent)) {
    return res.status(400).json({
      message: 'Missing required fields: email and/or content/htmlContent',
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"No Reply" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject || 'New Message',
      text:
        content ||
        'Please view this email in an HTML compatible client.',
      html:
        htmlContent ||
        (content
          ? `<p>${content.replace(/\n/g, '<br>')}</p>`
          : ''),
      ...(replyTo && { replyTo }), // reply-to support
    });

    res.status(200).json({
      message: 'Email sent successfully',
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      message: 'Failed to send email',
      error: error.message,
    });
  }
}
