
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Resend } from 'resend';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
 
const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
const { MONGODB_URI, RESEND_API_KEY, MAIL_FROM, MAIL_TO, PORT = 3000 } = process.env;
 
for (const [key, value] of Object.entries({ MONGODB_URI, RESEND_API_KEY, MAIL_FROM, MAIL_TO })) {
  if (!value) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}
 
await mongoose.connect(MONGODB_URI);
console.log('MongoDB connected');
 
const messageSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, maxlength: 200 },
  message: { type: String, required: true, maxlength: 5000 },
  ip: String,
  emailSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);
 
const resend = new Resend(RESEND_API_KEY);
 
const escapeHtml = (str) =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 
const app = express();
app.set('trust proxy', 1); 
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
 

app.use(express.static(path.join(__dirname, 'public')));
 
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many messages, try again later.' },
});
 
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message, website } = req.body ?? {};
 
  if (website) return res.status(201).json({ ok: true });
 
  if (
    typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string' ||
    !name.trim() || !message.trim() ||
    !emailRegex.test(email.trim()) ||
    name.length > 100 || email.length > 200 || message.length > 5000
  ) {
    return res.status(400).json({ ok: false, error: 'Invalid form data.' });
  }
 
  try {
    // 1. Save in MongoDB
    const doc = await Message.create({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      ip: req.ip,
    });
 
   
    const { error } = await resend.emails.send({
      from: MAIL_FROM,
      to: MAIL_TO,
      replyTo: doc.email,
      subject: `New portfolio message from ${doc.name}`,
      html: `
        <h2>New message from your portfolio</h2>
        <p><strong>Name:</strong> ${escapeHtml(doc.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(doc.email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(doc.message).replace(/\n/g, '<br>')}</p>
      `,
    });
 
    if (error) {
      console.error('Resend error:', error);
    } else {
      doc.emailSent = true;
      await doc.save();
    }
 
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Contact error:', err);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
});
 
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));