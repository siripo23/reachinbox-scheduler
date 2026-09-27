import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    googleLogout();
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <span className="text-xl font-bold text-blue-600 cursor-pointer" onClick={() => navigate('/')}>ReachInbox</span>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <a 
                  href={`https://slack.com/oauth/v2/authorize?client_id=${import.meta.env.VITE_SLACK_CLIENT_ID}&scope=chat:write,chat:write.public&state=${user.id}&redirect_uri=http://localhost:3001/api/auth/slack/callback`}
                  className="text-sm bg-[#4A154B] hover:bg-[#3b113c] text-white px-3 py-1.5 rounded flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521h-6.313A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.521-2.521h6.313zm10.122 2.52a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.521 2.52 2.528 2.528 0 0 1-2.521 2.522h-2.522V8.833zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.521A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.52 2.521v6.312zm0 10.122a2.528 2.528 0 0 1 2.522 2.523 2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.52-2.521v-2.523h2.52zm0-1.271a2.528 2.528 0 0 1-2.522-2.52 2.528 2.528 0 0 1 2.522-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.52h-6.312z" />
                  </svg>
                  Connect Slack
                </a>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase ml-2">
                  {user.name.charAt(0)}
                </div>
                <div className="flex flex-col text-sm mr-2">
                  <span className="font-medium text-gray-800">{user.name}</span>
                  <span className="text-gray-500 text-xs">{user.email}</span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1 cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
