// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Create socket connection outside component to prevent multiple connections
const socket = io('http://localhost:3001', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  const [step, setStep] = useState('login');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      // If user was chatting, try to reconnect
      if (step !== 'login' && email && gender) {
        socket.emit('register', { email, gender });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setStep('login');
      setMessages([]);
    });

    socket.on('error', (error) => {
      alert(error);
      setStep('login');
    });

    socket.on('waiting', () => {
      setStep('waiting');
    });

    socket.on('chatStart', () => {
      setStep('chatting');
      setMessages([]);
    });

    socket.on('message', (message) => {
      setMessages(prev => [...prev, { text: message, sender: 'partner' }]);
    });

    socket.on('partnerLeft', () => {
      setMessages(prev => [...prev, { text: 'Your partner has left the chat.', sender: 'system' }]);
      setStep('waiting');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
      socket.off('waiting');
      socket.off('chatStart');
      socket.off('message');
      socket.off('partnerLeft');
    };
  }, [step, email, gender]);

  const isValidCollegeEmail = (email) => {
    const validDomains = ['.edu', '.ac.in', '.edu.in'];
    return validDomains.some(domain => email.toLowerCase().endsWith(domain));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidCollegeEmail(email)) {
      alert('Please use a valid college email (.edu, .ac.in, or .edu.in)');
      return;
    }
    socket.emit('register', { email, gender });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      socket.emit('message', currentMessage);
      setMessages(prev => [...prev, { text: currentMessage, sender: 'me' }]);
      setCurrentMessage('');
    }
  };

  const handleNext = () => {
    socket.emit('next');
    setStep('waiting');
    setMessages([]);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <h2 className="text-xl mb-4">Connecting to server...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {step === 'login' && (
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-4">College Chat</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2">College Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-2">Gender:</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            >
              Start Chatting
            </button>
          </form>
        </div>
      )}

      {step === 'waiting' && (
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow text-center">
          <h2 className="text-xl mb-4">Looking for a chat partner...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      )}

      {step === 'chatting' && (
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow">
          <div className="h-[500px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-2 ${
                    message.sender === 'me'
                      ? 'text-right'
                      : message.sender === 'system'
                      ? 'text-center text-gray-500'
                      : 'text-left'
                  }`}
                >
                  <span
                    className={`inline-block rounded-lg px-4 py-2 ${
                      message.sender === 'me'
                        ? 'bg-blue-500 text-white'
                        : message.sender === 'system'
                        ? 'bg-gray-200'
                        : 'bg-gray-300'
                    }`}
                  >
                    {message.text}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Type a message..."
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Next
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;