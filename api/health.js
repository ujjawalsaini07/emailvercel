export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Email service is running',
    timestamp: new Date().toISOString()
  });
}
