import React, { useEffect, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './TransactionHistory.css';

const categoryBudgets = {
  Food: 1000,
  Travel: 1500,
  Shopping: 1500,
  Bills: 1500,
  Others: 1500
};

const TransactionHistory = ({ username }) => {
  const [history, setHistory] = useState([]);
  const [categorySpending, setCategorySpending] = useState({});
  const [tips, setTips] = useState([]);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/history/${username}`)
      .then(res => {
        setHistory(res.data);
        const spending = calculateCategorySpending(res.data);
        setCategorySpending(spending);
        const smartTips = generateCategoryTips(spending);
        setTips(smartTips);
      })
      .catch(() => {
        setHistory([]);
        setCategorySpending({});
        setTips([]);
      });
  }, [username]);

  const calculateCategorySpending = (data) => {
    const spending = {
      Food: 0,
      Travel: 0,
      Shopping: 0,
      Bills: 0,
      Others: 0
    };

    data.forEach(tx => {
      if (tx.type === 'sent') {
        const category = tx.category || 'Others';
        if (spending[category] !== undefined) {
          spending[category] += Number(tx.amount);
        } else {
          spending.Others += Number(tx.amount);
        }
      }
    });

    return spending;
  };

  const generateCategoryTips = (spending) => {
    const tips = [];

    Object.keys(categoryBudgets).forEach(category => {
      const spent = spending[category] || 0;
      const limit = categoryBudgets[category];
      const percentage = (spent / limit) * 100;

      if (spent === 0) {
        tips.push(`✅ You haven't spent anything on ${category}. Great control!`);
      } else if (percentage > 80) {
        tips.push(`⚠️ You're close to exceeding your ${category} budget. You've spent ₹${spent} of ₹${limit}.`);
      } else if (percentage > 50) {
        tips.push(`🟡 You're halfway through your ${category} budget. Keep an eye!`);
      } else {
        tips.push(`🟢 ${category}: ₹${spent} / ₹${limit}. You're on track.`);
      }
    });

    return tips;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Transaction Report - ${username}`, 14, 20);

    const tableData = history.slice().reverse().map((tx, index) => [
      index + 1,
      tx.type.toUpperCase(),
      `₹${tx.amount}`,
      tx.category || 'Others',
      tx.type === 'sent' ? tx.to : tx.from,
      tx.time,
      tx.location || 'N/A'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Type', 'Amount', 'Category', 'To/From', 'Time', 'Location']],
      body: tableData
    });

    doc.save(`${username}_Transaction_Report.pdf`);
  };

  return (
    <div className="history-container">
      <h2>📄 Transaction History</h2>
      <button className="export-btn" onClick={exportToPDF}>⬇️ Export as PDF</button>

      <div className="ai-tip">
        <h3>🧠 Smart Budget Tips</h3>
        <ul>
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>

      {history.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <ul className="history-list">
          {history.slice().reverse().map((tx, i) => (
            <li key={i} className={`history-item ${tx.type}`}>
              <strong>[{tx.type.toUpperCase()}]</strong> ₹{tx.amount}<br />
              {tx.type === 'sent' ? `To: ${tx.to}` : `From: ${tx.from}`}<br />
              Category: {tx.category || 'Others'}<br />
              Time: {tx.time}<br />
              <span className="location">📍 {tx.location || 'Location not available'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TransactionHistory;
