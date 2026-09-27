import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Compose from './pages/Compose';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/compose" element={<Compose />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;
