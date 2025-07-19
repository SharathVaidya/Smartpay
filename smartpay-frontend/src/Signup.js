// ✅ Signup.js — React component to register user and save to MongoDB via backend API

import axios from 'axios';
import { useState } from 'react';
import { Link } from 'react-router-dom';
 

const Signup = ({ onSignupComplete }) => {
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    pin: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/signup', form);
      setMessage('✅ Signup successful. You can now log in.');
      onSignupComplete();
    } catch (err) {
      setMessage('❌ Signup failed: ' + (err.response?.data || 'Server error'));
    }
  };

  return (
    <div className="signup-container">
      <h2>Signup</h2>
      <input type="text" name="username" placeholder="Username" onChange={handleChange} className="input" />
      <input type="password" name="password" placeholder="Password" onChange={handleChange} className="input" />
      <input type="email" name="email" placeholder="Email" onChange={handleChange} className="input" />
      <input type="text" name="pin" placeholder="4-digit PIN" maxLength="4" onChange={handleChange} className="input" />
      <button onClick={handleSignup} className="button">Sign Up</button>
      {message && <p className="info">{message}</p>}
    </div>
  );
};
<p className="bottom-link">
  Already have an account? <Link to="/">Login</Link>
</p>

export default Signup;