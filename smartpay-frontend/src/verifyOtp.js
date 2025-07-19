const username = sessionStorage.getItem('username');

function verifyOtp() {
  const otp = document.getElementById('otpInput').value;

  fetch('http://localhost:5000/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, otp })
  })
  .then(res => {
    if (res.ok) {
      alert('OTP verified!');
      window.location.href = 'dashboard.html';
    } else {
      alert('❌ OTP Invalid or Expired');
    }
  });
}

// Countdown timer
let seconds = 30;
const timerText = document.getElementById('timerText');
const countdown = document.getElementById('countdown');
const resendBtn = document.getElementById('resendBtn');

const interval = setInterval(() => {
  seconds--;
  countdown.innerText = seconds;

  if (seconds <= 0) {
    resendBtn.disabled = false;
    timerText.style.display = "none";
    clearInterval(interval);
  }
}, 1000);

// Resend OTP
function resendOtp() {
  resendBtn.disabled = true;
  seconds = 30;
  countdown.innerText = seconds;
  timerText.style.display = "block";

  fetch('http://localhost:5000/api/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
  .then(res => res.text())
  .then(msg => alert(msg))
  .catch(err => console.error(err));
}
