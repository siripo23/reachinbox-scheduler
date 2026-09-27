import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin } from '../lib/api';
import { jwtDecode } from 'jwt-decode';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const res = await apiLogin(decoded.email, decoded.name);
      login(res.user);
      navigate('/');
    } catch (error) {
      console.error(error);
      alert('Login failed');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Sign in to ReachInbox</h2>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => alert('Login Failed')}
        />
      </div>
    </div>
  );
}
