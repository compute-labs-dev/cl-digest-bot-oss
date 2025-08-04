import { ChatInterface } from '../../components/agent/ChatInterface';

export default function AgentPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🤖 AI Configuration Assistant
            </h1>
            <p className="text-lg text-gray-600">
              Configure your digest system through natural language conversation
            </p>
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">
              🚀 Quick Start Guide
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-blue-800 mb-2">Source Management</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>{`• "Add @username to Twitter sources"`}</li>
                  <li>{`• "Subscribe to TechCrunch RSS"`}</li>
                  <li>{`• "Remove @username from monitoring"`}</li>
                  <li>{`• "Show me current sources"`}</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-blue-800 mb-2">AI & Generation</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>{`• "Switch to Gemini model"`}</li>
                  <li>{`• "Generate a digest about AI news"`}</li>
                  <li>{`• "What's the system status?"`}</li>
                  <li>{`• "Show recent digests"`}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="bg-white rounded-lg shadow-lg" style={{ height: '600px' }}>
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  );
}