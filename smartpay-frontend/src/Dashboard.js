import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = ({ user }) => {
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [category, setCategory] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [scoreInfo, setScoreInfo] = useState({ score: 0, reward: '' });
  const [message, setMessage] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [balance, setBalance] = useState(user.balance);
  const [monthlyStats, setMonthlyStats] = useState({ added: 0, spent: 0 });
  const [categoryLimits, setCategoryLimits] = useState({});
  const [categorySpending, setCategorySpending] = useState({});
  const fixedCategories = ['Food', 'Travel', 'Shopping', 'Bills', 'Others'];

  useEffect(() => {
    refreshUser();
    axios.get(`http://localhost:5000/api/rewards/${user.username}`)
      .then(res => setScoreInfo(res.data));
  }, [user.username]);

  const refreshUser = () => {
    axios.get(`http://localhost:5000/api/user/${user.username}`)
      .then(res => {
        const data = res.data;
        setNotifications(data.notifications || []);
        setBalance(data.balance);
        setMonthlyStats(data.monthlyStats || { added: 0, spent: 0 });

        const defaultLimits = {};
        fixedCategories.forEach(cat => {
          defaultLimits[cat] = data.spendinglimits?.[cat] ?? 0;
        });
        setCategoryLimits(defaultLimits);

        const spent = {};
        (data.history || []).forEach(tx => {
          if (tx.type === 'sent' && tx.category) {
            spent[tx.category] = (spent[tx.category] || 0) + tx.amount;
          }
        });
        setCategorySpending(spent);
      });
  };

  const initiateTransfer = () => {
    if (!receiverEmail || !amount || !category) {
      setMessage('⚠️ Please fill all fields including category.');
      return;
    }
    setShowPin(true);
    setMessage('');
  };

  const confirmTransfer = () => {
    if (!pin || pin.length !== 4) {
      setMessage('⚠️ Enter a valid 4-digit PIN.');
      return;
    }

    axios.post('http://localhost:5000/api/transfer', {
      senderUsername: user.username,
      receiverEmail,
      amount: Number(amount),
      pin,
      category,
      ip: '' // optional: can integrate real IP using a service
    })
      .then(() => {
        setMessage('✅ Transfer successful');
        setAmount('');
        setReceiverEmail('');
        setPin('');
        setCategory('');
        setShowPin(false);
        refreshUser();
      })
      .catch(err => {
        setMessage(`❌ ${err.response?.data || 'Transfer failed'}`);
        setShowPin(false);
      });
  };

  const handleClear = () => {
    axios.post('http://localhost:5000/api/clear', { username: user.username })
      .then(() => setNotifications([]));
  };

  const handleAddMoney = () => {
    if (!addAmount || Number(addAmount) <= 0) {
      setMessage('⚠️ Enter a valid amount to add.');
      return;
    }

    axios.post('http://localhost:5000/api/add-money', {
      username: user.username,
      amount: Number(addAmount)
    })
      .then(() => {
        setMessage('✅ Money added successfully');
        setAddAmount('');
        refreshUser();
      })
      .catch(err => setMessage(`❌ ${err.response?.data || 'Failed to add money'}`));
  };

  return (
    <div className="dashboard-container" style={{ padding: '20px' }}>
      <h2>Welcome, {user.username}</h2>
      <p>Balance: ₹{balance}</p>
      <p>💰 Added this month: ₹{monthlyStats.added} / ₹7000</p>
      <p>📤 Spent this month: ₹{monthlyStats.spent} / ₹7000</p>

      <div style={{ marginTop: '20px' }}>
        <h3>📊 Category Spending Limits</h3>
        <ul>
          {fixedCategories.map(cat => (
            <li key={cat}>
              <strong>{cat}:</strong> ₹{categorySpending[cat] || 0} / ₹{categoryLimits[cat] || 0}
            </li>
          ))}
        </ul>
      </div>

      <div className="main-section" style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        {/* Send Money */}
        <div className="transfer-box" style={{ flex: 1 }}>
          <h3>Send Money</h3>
          <input
            type="email"
            placeholder="Receiver Email"
            value={receiverEmail}
            onChange={(e) => setReceiverEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          >
            <option value="">Select Category</option>
            {fixedCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {!showPin ? (
            <button onClick={initiateTransfer} className="button">Send Money</button>
          ) : (
            <>
              <input
                type="password"
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength="4"
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              />
              <button onClick={confirmTransfer} className="button">Confirm Transfer</button>
            </>
          )}
        </div>

        {/* Add Money */}
        <div className="transfer-box" style={{ flex: 1 }}>
          <h3>Add Money to Wallet</h3>
          <input
            type="number"
            placeholder="Amount"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <button onClick={handleAddMoney} className="button">Add Money</button>
        </div>
      </div>

      {/* Score */}
      <div className="score-box" style={{ marginTop: '30px' }}>
        <h3>Financial Health Score: <strong>{scoreInfo.score}</strong></h3>
        <p className="reward-text">🎁 {scoreInfo.reward}</p>
      </div>

      {message && <p style={{ marginTop: '10px' }}>{message}</p>}

      <hr style={{ margin: '30px 0' }} />

      {/* Notifications */}
      <h3>Notifications</h3>
      {notifications.length === 0 && <p>No new notifications</p>}
      {notifications.map((note, i) => (
        <div key={i} className="notification">{note}</div>
      ))}
      {notifications.length > 0 && (
        <button onClick={handleClear} className="clear-button">Clear Notifications</button>
      )}
    </div>
  );
};

export default Dashboard;
