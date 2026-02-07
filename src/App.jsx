import React, { useEffect, useState } from 'react';
import Auth from './services/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Toaster } from 'react-hot-toast';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize auth
    Auth.init();
    
    // Subscribe to changes
    const unsubscribe = Auth.subscribe((state) => {
      setIsAuthenticated(state.all);
    });
    
    setIsLoading(false);
    
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-black text-white selection:bg-green-500 selection:text-black">
      <Toaster position="top-center" toastOptions={{
          style: {
            background: '#18181b',
            color: '#fff',
            border: '1px solid #27272a',
          },
        }} />
      {isAuthenticated ? <Dashboard /> : <Login />}
    </div>
  );
}

export default App;