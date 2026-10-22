import React, { useState,useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Search, Send, Paperclip, Plus } from 'lucide-react';
import {useCoordinatorIdentity} from '../../components/shared/CoordinatorPortal';
import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import {backendRpc} from '../../lib/backendGateway';
import {coordinatorCommand} from '../../lib/coordinatorGateway';
import {toast} from 'sonner';

export function CoordinatorMessages() {
  const identity=useCoordinatorIdentity();
  const {directory,enrollments}=useCoordinatorModuleData();
  const conversations=enrollments.flatMap(e=>(directory?.memberships||[]).filter(m=>m.active&&m.profileId!==identity.profile.id&&m.programId===e.programId&&(m.role==='coordinator'||m.profileId===e.studentId||m.profileId===e.adviserId)).map(m=>({id:e.id+':'+m.profileId,enrollmentId:e.id,recipientId:m.profileId,name:m.name,role:m.role,lastMessage:'',timestamp:'',unread:0})));
  const [selectedId,setSelectedId]=useState('');
  const selectedConversation=conversations.find(c=>c.id===selectedId)||{id:'',name:'Select a conversation',role:'',enrollmentId:'',recipientId:''};
  const setSelectedConversation=(c:typeof conversations[number])=>setSelectedId(c.id);
  const [currentMessages,setMessages]=useState<{id:string;sender:string;message:string;timestamp:string;isSender:boolean}[]>([]);
  const [busy,setBusy]=useState(false),[reload,setReload]=useState(0),[error,setError]=useState('');
  const [messageText,setMessageText]=useState(''),[searchTerm,setSearchTerm]=useState('');
  useEffect(()=>{let alive=true;setMessages([]);setError('');if(!selectedConversation.id)return;
    setBusy(true);backendRpc<{items:{id:string;sender_id:string;recipient_id:string;body:string;created_at:string}[]}>('intrack_list_messages',{enrollment_id:selectedConversation.enrollmentId,actor_role:'coordinator',page_size:100}).then(data=>{if(alive)setMessages(data.items.filter(m=>m.sender_id===selectedConversation.recipientId||m.recipient_id===selectedConversation.recipientId).reverse().map(m=>({id:m.id,sender:m.sender_id===identity.profile.id?identity.profile.displayName:selectedConversation.name,message:m.body,timestamp:new Date(m.created_at).toLocaleString(),isSender:m.sender_id===identity.profile.id})));}).catch(()=>{if(alive)setError('Unable to load messages.');}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;};
  },[selectedId,reload,identity.profile.id]);
  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage=async(e:React.FormEvent)=>{e.preventDefault();if(busy||!selectedConversation.id||!messageText.trim())return;setBusy(true);try{await coordinatorCommand(identity.profile.id,'intrack_send_message',{enrollment_id:selectedConversation.enrollmentId,actor_role:'coordinator',recipient_id:selectedConversation.recipientId,body:messageText.trim()});setMessageText('');setReload(v=>v+1);}catch(error){toast.error(error instanceof Error?error.message:'Message not sent.');}finally{setBusy(false);}};

  return (
    <div className="space-y-6">
      {error&&<p role="alert">{error} <button className="underline" onClick={()=>setReload(v=>v+1)}>Retry</button></p>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Messages</h1>
          <p className="text-slate-600 mt-1">Communicate with advisers and students</p>
        </div>
        <Button onClick={()=>document.querySelector<HTMLInputElement>('input[placeholder="Search messages..."]')?.focus()} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
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
              {!filteredConversations.length&&<p className="p-4 text-sm text-slate-500">No saved enrollment contacts.</p>}
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
            {busy&&<p role="status">Loading…</p>}
            {!busy&&!currentMessages.length&&<p className="text-sm text-slate-500">No messages to display. Conversations show up to 100 recent messages.</p>}
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
                <Button type="button" disabled title="Message attachments are not connected yet" variant="outline" size="sm" className="gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attach
                </Button>
                <Button disabled={busy||!selectedConversation.id||!messageText.trim()} type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
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
