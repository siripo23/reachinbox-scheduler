import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { scheduleCampaign } from '../lib/api';

export default function Compose() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const extractedEmails = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi) || [];
      const uniqueEmails = Array.from(new Set(extractedEmails));
      setEmails(uniqueEmails);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emails.length === 0) {
      alert('Please upload a CSV or text file containing valid email addresses.');
      return;
    }

    setLoading(true);
    try {
      await scheduleCampaign({
        userId: user.id,
        subject,
        body,
        startTime: startTime || new Date().toISOString(),
        delaySeconds,
        hourlyLimit,
        emails
      });
      navigate('/');
    } catch (error) {
      console.error(error);
      alert('Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Compose New Email Campaign</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Subject</label>
          <input 
            type="text" 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Body</label>
          <textarea 
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Upload Leads (CSV/TXT)</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer"
          />
          {emails.length > 0 && (
            <p className="mt-2 text-sm text-green-600 font-medium">
              ✅ Detected {emails.length} unique email addresses.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <input 
              type="datetime-local" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Delay between emails (sec)</label>
            <input 
              type="number" 
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              min="0"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hourly Limit</label>
            <input 
              type="number" 
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              min="1"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required 
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button 
            type="button" 
            onClick={() => navigate(-1)}
            className="mr-4 bg-white border border-gray-300 px-4 py-2 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 border border-transparent px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Scheduling...' : 'Schedule Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
