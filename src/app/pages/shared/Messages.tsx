import { toast } from 'sonner';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Search, Send, Paperclip, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const demoConversations = [
  {
    id: 1,
    name: 'Michael Chen',
    role: 'Adviser',
    lastMessage: 'Great work on the authentication module!',
    timestamp: '10:30 AM',
    unread: 2,
  },
  {
    id: 2,
    name: 'Dr. Emily Rodriguez',
    role: 'Coordinator',
    lastMessage: 'Please submit your mid-term evaluation by Friday.',
    timestamp: 'Yesterday',
    unread: 0,
  },
  {
    id: 3,
    name: 'Sarah Johnson',
    role: 'Student',
    lastMessage: 'Thank you for the feedback!',
    timestamp: '2 days ago',
    unread: 0,
  },
];

const demoMessages = [
  {
    id: 1,
    sender: 'Michael Chen',
    message: 'Hi Sarah, I reviewed your latest work on the authentication module.',
    timestamp: '10:15 AM',
    isSender: false,
  },
  {
    id: 2,
    sender: 'Me',
    message: 'Thank you! I spent a lot of time on the security aspects.',
    timestamp: '10:20 AM',
    isSender: true,
  },
  {
    id: 3,
    sender: 'Michael Chen',
    message: 'It shows! The implementation is solid. Just a few minor suggestions in the code review.',
    timestamp: '10:25 AM',
    isSender: false,
  },
  {
    id: 4,
    sender: 'Michael Chen',
    message: 'Great work on the authentication module! Keep it up!',
    timestamp: '10:30 AM',
    isSender: false,
  },
];

export function Messages({savedConversations,savedMessages}:{savedConversations?:typeof demoConversations;savedMessages?:typeof demoMessages}={}) {
  const conversations=savedConversations??demoConversations;
  const currentMessages=savedMessages??demoMessages;
  const emptyConversation={id:0,name:'No conversations',role:'',lastMessage:'',timestamp:'',unread:0};
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]||emptyConversation);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      if(savedConversations){toast.error('Messaging is not connected on this page yet. No message was sent.');return;}
      // Mock send message
      setMessageText('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Messages</h1>
          <p className="text-slate-600 mt-1">Communicate with advisers and students</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search messages..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {filteredConversations.map((conversation) => (
                <div data-interactive="true"
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedConversation.id === conversation.id
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-medium">
                        {conversation.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{conversation.name}</h4>
                        <p className="text-xs text-slate-500">{conversation.role}</p>
                      </div>
                    </div>
                    {conversation.unread > 0 && (
                      <Badge className="bg-indigo-600">{conversation.unread}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1 ml-13">
                    {conversation.lastMessage}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 ml-13">{conversation.timestamp}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2 flex flex-col h-[600px]">
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-medium">
                {selectedConversation.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <CardTitle className="text-base">{selectedConversation.name}</CardTitle>
                <p className="text-xs text-slate-500">{selectedConversation.role}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isSender ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.isSender
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {!message.isSender && (
                    <p className="text-xs font-medium mb-1 opacity-70">{message.sender}</p>
                  )}
                  <p className="text-sm">{message.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.isSender ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
          <CardContent className="border-t border-slate-200 p-4">
            <form onSubmit={handleSendMessage} className="space-y-3">
              <Textarea
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" className="gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attach
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
