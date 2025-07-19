require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const ipinfo = require('ipinfo');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  pin: String,
  email: String,
  balance: { type: Number, default: 500 },
  notifications: [String],
  score: { type: Number, default: 700 },
  history: [{
    type: { type: String },
    amount: Number,
    from: String,
    to: String,
    time: String,
    location: String,
    category: String
  }],
  spendinglimits: {
    type: Map,
    of: Number,
    default: {
      Food: 2000,
      Travel: 1000,
      Shopping: 1500,
      Bills: 1500,
      Others: 1000
    }
  },
  monthlyStats: {
    added: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    lastReset: { type: String, default: new Date().toLocaleDateString() }
  }
});
const User = mongoose.model('User', userSchema);

const otpSchema = new mongoose.Schema({
  username: String,
  otp: String,
  expiresAt: Date,
  attempts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 1 },
  lockedUntil: Date,
  createdAt: { type: Date, default: Date.now }
});
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });
const Otp = mongoose.model('Otp', otpSchema);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
function sendEmail(to, subject, text) {
  transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text }, (err, info) => {
    if (err) console.error('❌ Email error:', err);
    else console.log('📧 Email sent:', info.response);
  });
}

function resetMonthlyStatsIfNeeded(user) {
  const currentMonth = new Date().getMonth();
  const lastMonth = new Date(user.monthlyStats.lastReset).getMonth();
  if (currentMonth !== lastMonth) {
    user.monthlyStats.added = 0;
    user.monthlyStats.spent = 0;
    user.monthlyStats.lastReset = new Date().toLocaleDateString();
  }
}


// ===================== Routes =====================

app.post('/api/signup', async (req, res) => {
  const { username, password, email, pin } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).send('Username already exists');
  await User.create({ username, password, email, pin });
  res.send('Signup successful');
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).send('Invalid credentials');
  const otp = await Otp.findOne({ username });
  if (otp?.lockedUntil && Date.now() < otp.lockedUntil) {
    const wait = Math.ceil((otp.lockedUntil - Date.now()) / 60000);
    return res.status(403).send(`OTP locked. Try after ${wait} min`);
  }
  res.json(user);
});

app.post('/api/send-otp', async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).send('User not found');

  const existing = await Otp.findOne({ username });
  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

  if (existing) {
    if (existing.sentCount >= 5)
      return res.status(429).send('Max OTP limit reached');
    Object.assign(existing, {
      otp: newOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      sentCount: existing.sentCount + 1,
      attempts: 0,
      createdAt: new Date(),
      lockedUntil: null
    });
    await existing.save();
  } else {
    await Otp.create({
      username,
      otp: newOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
  }

  sendEmail(user.email, 'SmartPay OTP', `Your OTP is ${newOtp} (valid for 5 min)`);
  res.send('OTP sent');
});

app.post('/api/verify-otp', async (req, res) => {
  const { username, otp } = req.body;
  const record = await Otp.findOne({ username });
  if (!record) return res.status(404).send('OTP not found');
  if (record.lockedUntil && Date.now() < record.lockedUntil)
    return res.status(429).send('Too many attempts. Locked for 15 min');
  if (Date.now() > record.expiresAt) return res.status(400).send('OTP expired');

  if (record.otp !== otp) {
    record.attempts++;
    if (record.attempts >= 3) {
      record.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await record.save();
      return res.status(403).send('Too many wrong attempts');
    }
    await record.save();
    return res.status(400).send(`Invalid OTP. Attempts: ${record.attempts}/3`);
  }

  await Otp.deleteOne({ username });
  res.send('OTP verified');
});

app.post('/api/transfer', async (req, res) => {
  const { senderUsername, receiverEmail, amount, pin, isLatePayment = false, ip, category } = req.body;

  const sender = await User.findOne({ username: senderUsername });
  const receiver = await User.findOne({ email: receiverEmail });

  if (!sender || !receiver) return res.status(404).send('User not found');
  if (sender.pin !== pin) return res.status(403).send('Incorrect PIN');
  if (sender.balance < amount) return res.status(400).send('Insufficient funds');

    ipinfo(ip, { token: process.env.IPINFO_TOKEN }, async (err, loc) => {
    const location = loc ? `${loc.city}, ${loc.region}, ${loc.country}` : 'Unknown';
    const time = new Date().toLocaleTimeString();


  resetMonthlyStatsIfNeeded(sender);
  if (sender.monthlyStats.spent + amount > 7000)
    return res.status(403).send('Monthly limit exceeded');

  if (!category || !sender.spendinglimits.has(category)) {
    return res.status(400).send('Invalid or missing category');
  }

  const spentInCategory = sender.history
    .filter(tx => tx.type === 'sent' && tx.category === category)
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (spentInCategory + amount > sender.spendinglimits.get(category)) {
    return res.status(403).send(`Category limit exceeded for ${category}`);
  }


    sender.balance -= amount;
    receiver.balance += amount;
    sender.monthlyStats.spent += amount;

    const msg = `You received ₹${amount} from ${sender.username} at ${time}`;
    receiver.notifications.push(msg);
    sender.history.push({ type: 'sent', amount, from: sender.username, to: receiver.username, time, location, category });
    receiver.history.push({ type: 'received', amount, from: sender.username, to: receiver.username, time, location, category });

    sender.score = isLatePayment ? Math.max(sender.score - 30, 0) : Math.min(sender.score + 20, 1000);

    await sender.save();
    await receiver.save();
    sendEmail(receiver.email, 'SmartPay - Payment Received', msg);
    res.send('Transfer successful');
  });
});

app.post('/api/update-limits', async (req, res) => {
  const { username, limits } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).send('User not found');

  for (const [category, value] of Object.entries(limits)) {
    if (typeof value !== 'number' || value < 0)
      return res.status(400).send(`Invalid value for ${category}`);
    user.spendinglimits.set(category, value);
  }

  await user.save();
  res.send('Spending limits updated');
});

app.post('/api/add-money', async (req, res) => {
  const { username, amount } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).send('User not found');

  resetMonthlyStatsIfNeeded(user);
  if (user.monthlyStats.added + amount > 7000)
    return res.status(403).send('Add-money limit exceeded');

  user.balance += Number(amount);
  user.monthlyStats.added += Number(amount);
  await user.save();
  res.send('Money added');
});

app.get('/api/rewards/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).send('User not found');

  let reward = '';
  if (user.score > 800) reward = '₹10–₹50 cashback';
  else if (user.score > 700) reward = 'Shopping coupons';
  else if (user.score > 600) reward = 'Free recharge/movie';
  else {
    const tips = [
      'Pay on time to avoid score drops.',
      'Keep a minimum ₹500 balance.',
      'Send to verified users for bonus.',
      'Make smaller, frequent payments.'
    ];
    reward = `💡 Tip: ${tips[Math.floor(Math.random() * tips.length)]}`;
  }

  res.json({ score: user.score, reward });
});

app.get('/api/user/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).send('User not found');
  res.json(user);
});

app.get('/api/history/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).send('User not found');
  res.json(user.history);
});

app.post('/api/clear', async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).send('User not found');
  user.notifications = [];
  await user.save();
  res.send('Notifications cleared');
});

// ========== Monthly Report ==========

const sendMonthlyEmailReport = async (user) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Monthly Report for ${user.username}`, 15, 20);

  const tableData = user.history.map((tx, i) => [
    i + 1,
    tx.type.toUpperCase(),
    `₹${tx.amount}`,
    tx.type === 'sent' ? tx.to : tx.from,
    tx.time,
    tx.location || 'N/A',
    tx.category || 'N/A'
  ]);

  doc.autoTable({
    startY: 30,
    head: [['#', 'Type', 'Amount', 'To/From', 'Time', 'Location', 'Category']],
    body: tableData
  });

  const filePath = path.join(__dirname, `${user.username}_report.pdf`);
  doc.save(filePath);

  await transporter.sendMail({
    from: `"SmartPay Report" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `📊 SmartPay Monthly Report`,
    text: `Hi ${user.username},\n\nAttached is your monthly SmartPay report.`,
    attachments: [{ filename: 'Monthly_Report.pdf', path: filePath }]
  });

  fs.unlinkSync(filePath);
  console.log(`📧 Sent report to ${user.email}`);
};

cron.schedule('0 9 1 * *', async () => {
  console.log('📅 Generating monthly reports...');
  const users = await User.find({});
  for (const user of users) {
    if (user.history.length > 0) {
      await sendMonthlyEmailReport(user);
    }
  }
});

// ========== Export PDF Report ==========
app.get('/api/export-transactions/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).send('User not found');

  const doc = new PDFDocument();
  const filePath = path.join(__dirname, 'transactions_report.pdf');
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text(`SmartPay Transactions Report`, { align: 'center' }).moveDown();
  user.history.forEach(entry => {
    doc.fontSize(12).text(`Type: ${entry.type}`);
    doc.text(`Amount: ₹${entry.amount}`);
    doc.text(`From: ${entry.from}`);
    doc.text(`To: ${entry.to}`);
    doc.text(`Time: ${entry.time}`);
    doc.text(`Location: ${entry.location || 'N/A'}`);
    doc.text(`Category: ${entry.category || 'N/A'}`);
    doc.moveDown();
  });
  doc.end();

  stream.on('finish', () => {
    res.download(filePath, 'SmartPay_Transactions_Report.pdf', err => {
      if (!err) fs.unlinkSync(filePath);
    });
  });
});

app.listen(5000, () => console.log('🚀 Server running on http://localhost:5000'));
