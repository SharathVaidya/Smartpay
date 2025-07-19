require('dotenv').config();
const mongoose = require('mongoose');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Transaction = require('./models/Transaction');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('DB Error:', err));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.EMAIL_PASS
  }
});

const sendMonthlyReport = async (user) => {
  const transactions = await Transaction.find({ username: user.username });

  if (!transactions.length) return;

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Monthly Report for ${user.username}`, 15, 20);

  const tableData = transactions.map((tx, i) => [
    i + 1,
    tx.type.toUpperCase(),
    `₹${tx.amount}`,
    tx.type === 'sent' ? tx.to : tx.from,
    tx.time,
    tx.location || 'N/A'
  ]);

  doc.autoTable({
    startY: 30,
    head: [['#', 'Type', 'Amount', 'To/From', 'Time', 'Location']],
    body: tableData
  });

  const filePath = path.join(__dirname, `${user.username}_Monthly_Report.pdf`);
  doc.save(filePath);

  // Send Email
  await transporter.sendMail({
    from: `"SmartPay Reports" <${process.env.EMAIL_ID}>`,
    to: user.email,
    subject: `Monthly Report for ${user.username}`,
    text: `Hi ${user.username},\n\nPlease find attached your monthly SmartPay report.`,
    attachments: [{
      filename: `${user.username}_Monthly_Report.pdf`,
      path: filePath
    }]
  });

  fs.unlinkSync(filePath); // Clean up
  console.log(`Report sent to ${user.email}`);
};

// Schedule: every 1st day of month at 9 AM
cron.schedule('0 9 1 * *', async () => {
  console.log("📬 Sending monthly reports...");
  const users = await User.find({});
  for (const user of users) {
    await sendMonthlyReport(user);
  }
});
