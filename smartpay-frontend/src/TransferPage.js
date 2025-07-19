import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './TransferPage.css'; // optional

function TransferPage({ username }) {
  const [amount, setAmount] = useState('');
  const [toUser, setToUser] = useState('');

  const handleTransfer = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/transfer', {
        from: username,
        to: toUser,
        amount: parseFloat(amount),
      });

      // Get message safely (can be string or object or array)
      const msg = res.data?.message;

      Swal.fire({
        icon: 'success',
        title: '✅ Transfer Successful',
        html: Array.isArray(msg)
          ? msg.map((m, i) => `<p key=${i}>${m}</p>`).join('')
          : typeof msg === 'object'
          ? `<pre>${JSON.stringify(msg, null, 2)}</pre>`
          : msg,
      });

      // Clear input
      setAmount('');
      setToUser('');
    } catch (err) {
      const errMsg = err.response?.data?.message;

      Swal.fire({
        icon: 'error',
        title: '❌ Transfer Failed',
        html: Array.isArray(errMsg)
          ? errMsg.map((m, i) => `<p key=${i}>${m}</p>`).join('')
          : typeof errMsg === 'object'
          ? `<pre>${JSON.stringify(errMsg, null, 2)}</pre>`
          : errMsg || 'Something went wrong!',
      });
    }
  };

  return (
    <div className="transfer-container">
      <h2>💸 Transfer Funds</h2>
      <input
        type="text"
        placeholder="To Username"
        value={toUser}
        onChange={(e) => setToUser(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={handleTransfer}>Send</button>
    </div>
  );
}

export default TransferPage;
