'use client';
import { signIn } from 'next-auth/react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { login as apiLogin } from '../lib/api';

export default function Login() {
  const { data: session, status } = useSession();
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.email && session?.user?.name) {
      // Sync NextAuth session with our custom backend
      apiLogin(session.user.email, session.user.name).then(res => {
        login(res.user);
        router.push('/');
      }).catch(console.error);
    }
  }, [session, login, router]);

  if (status === 'loading') {
    return <div className="min-h-[80vh] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Sign in to ReachInbox</h2>
        <button 
          onClick={() => signIn('google')}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
