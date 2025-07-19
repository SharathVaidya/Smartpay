import React, { useState } from 'react';
import Signup from './Signup';
import Login from './Login';
import Dashboard from './Dashboard';
import TransactionHistory from './TransactionHistory';

function App() {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  return (
    <div className="App">
      <h1 className="main-heading">SmartPay</h1>
      {!user ? (
        showSignup ? (
          <Signup onSignupComplete={() => setShowSignup(false)} />
        ) : (
          <>
            <Login onLogin={setUser} />
            <p
  style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px', cursor: 'pointer' }}
  onClick={() => setShowSignup(true)}
>
  Don’t have an account? Sign up
</p>

          </>
        )
      ) : (
        <>
          <Dashboard user={user} />
          <TransactionHistory username={user.username} />
        </>
      )}
    </div>
  );
}

export default App;
