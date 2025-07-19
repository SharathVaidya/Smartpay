import axios from 'axios';
import { useState, useEffect } from 'react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: login, 2: otp
  const [error, setError] = useState('');
  const [tempUser, setTempUser] = useState(null);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(3);

  // Timer effect for resend countdown
  useEffect(() => {
    let timer;
    if (step === 2 && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    } else {
      setResendDisabled(false);
    }
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const handleLogin = () => {
    axios.post('http://localhost:5000/api/login', { username, password })
      .then(res => {
        setTempUser(res.data);
        return axios.post('http://localhost:5000/api/send-otp', { username });
      })
      .then(() => {
        setStep(2);
        setResendCountdown(30);
        setResendDisabled(true);
        setError('');
      })
      .catch(() => setError('Invalid credentials'));
  };

  const handleOtpVerify = () => {
    axios.post('http://localhost:5000/api/verify-otp', { username, otp })
      .then(() => onLogin(tempUser))
      .catch(err => {
        setOtpAttemptsLeft(prev => prev - 1);
        const msg = err.response?.data || 'Invalid or expired OTP';
        if (otpAttemptsLeft <= 1) {
          setError('Too many failed attempts. Please try again later.');
        } else {
          setError(`${msg} | Attempts left: ${otpAttemptsLeft - 1}`);
        }
      });
  };

  const handleResendOtp = () => {
    axios.post('http://localhost:5000/api/resend-otp', { username })
      .then(() => {
        setResendCountdown(30);
        setResendDisabled(true);
        setError('');
        setOtpAttemptsLeft(3); // reset attempts
      })
      .catch(err => {
        const msg = err.response?.data || 'Error resending OTP';
        setError(msg);
      });
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      {step === 1 ? (
        <>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            className="input"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="input"
          />
          <button onClick={handleLogin} className="button">
            Send OTP
          </button>
        </>
      ) : (
        <>
          <p>An OTP has been sent to your email</p>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value)}
            placeholder="Enter 6-digit OTP"
            className="input"
            maxLength="6"
          />
          <button
            onClick={handleOtpVerify}
            className="button"
            disabled={otpAttemptsLeft <= 0}
          >
            Verify OTP & Login
          </button>

          {/* ⏳ Timer + 🔁 Resend OTP */}
          <div style={{ marginTop: '10px' }}>
            {resendDisabled ? (
              <p>⏳ Resend OTP in {resendCountdown}s</p>
            ) : (
              <button onClick={handleResendOtp} className="button secondary">
                🔁 Resend OTP
              </button>
            )}
          </div>

          {/* Remaining Attempts */}
          {otpAttemptsLeft < 3 && otpAttemptsLeft > 0 && (
            <p>❗Attempts left: {otpAttemptsLeft}</p>
          )}
        </>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default Login;