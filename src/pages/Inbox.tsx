import React, { useEffect, useState } from 'react';
import {
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  CheckCircle,
  Clock,
  CornerUpLeft,
  Paperclip,
  Plus,
  Send } from
'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { logAudit } from '../lib/auditLogger';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
interface Message {
  id: number;
  sender_name: string;
  sender_email: string;
  message: string;
  is_read: boolean;
  reply_text: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  attachments: any | null;
  sender_user_id: number | null;
  parent_message_id: number | null;
  is_closed: boolean;
}
export const Inbox = () => {
  const { user, hasPermission } = useAuth();
  const canReply = hasPermission(['admin', 'manager']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // 'open', 'closed', 'all'
  const [readFilter, setReadFilter] = useState('all'); // 'read', 'unread', 'all'
  // Reply state
  const [replyText, setReplyText] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeMessage, setComposeMessage] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.
      from('inbox_messages').
      select('id:message_id, sender_name, sender_email, message, is_read, reply_text, replied_by, replied_at, created_at, attachments, sender_user_id, parent_message_id, is_closed').
      order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setMessages(
        (data || []).map((message: any) => ({
          ...message,
          is_read: message.is_read === true || message.is_read === 1,
          is_closed: message.is_closed === true || message.is_closed === 1
        }))
      );
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchMessages();
  }, []);
  const handleSelectMessage = async (msg: Message) => {
    setSelectedMessage(msg);
    setReplyText(msg.reply_text || '');
    // Mark as read if unread
    if (!msg.is_read) {
      try {
        const { error } = await supabase.
        from('inbox_messages').
        update({
          is_read: 1
        }).
        eq('message_id', msg.id);
        if (error) throw error;
        setMessages(
          messages.map((m) =>
          m.id === msg.id ?
          {
            ...m,
            is_read: true
          } :
          m
          )
        );
      } catch (error) {
        // Prototype fallback
        setMessages(
          messages.map((m) =>
          m.id === msg.id ?
          {
            ...m,
            is_read: true
          } :
          m
          )
        );
      }
    }
  };
  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setIsSubmitting(true);
    try {
      const updateData = {
        reply_text: replyText,
        replied_by: user?.username || 'system',
        replied_at: new Date().toISOString(),
        is_closed: 1 // Auto-close on reply for this workflow
      };
      const { error } = await supabase.
      from('inbox_messages').
      update(updateData).
      eq('message_id', selectedMessage.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'update',
        entity: 'inbox_messages',
        entity_id: selectedMessage.id,
        metadata: {
          action: 'replied_and_closed'
        }
      });
      toast.success('Reply sent and message closed');
      // Update local state
      const updatedMsg = {
        ...selectedMessage,
        ...updateData
      };
      setMessages(
        messages.map((m) => m.id === selectedMessage.id ? updatedMsg : m)
      );
      setSelectedMessage(updatedMsg);
    } catch (error) {
      console.error('Error replying:', error);
      // Prototype fallback
      const updateData = {
        reply_text: replyText,
        replied_by: user?.username || 'system',
        replied_at: new Date().toISOString(),
        is_closed: true
      };
      const updatedMsg = {
        ...selectedMessage,
        ...updateData
      };
      setMessages(
        messages.map((m) => m.id === selectedMessage.id ? updatedMsg : m)
      );
      setSelectedMessage(updatedMsg);
      toast.success('Reply saved (Prototype mode)');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setComposeAttachments(
      files.map((file) => ({
        name: file.name,
        size: `${Math.max(1, Math.round(file.size / 1024))}kb`,
        type: file.type || 'file'
      }))
    );
  };
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !composeMessage.trim()) return;

    setIsSubmitting(true);
    try {
      const messageData = {
        sender_name: user.full_name || user.username,
        sender_email: user.email || null,
        message: composeMessage.trim(),
        is_read: 0,
        reply_text: null,
        replied_by: null,
        replied_at: null,
        created_at: new Date().toISOString(),
        attachments: composeAttachments.length > 0 ? composeAttachments : null,
        sender_user_id: Number(user.id),
        parent_message_id: null,
        is_closed: 0
      };

      const { data, error } = await supabase.
      from('inbox_messages').
      insert([messageData]).
      select('id:message_id, sender_name, sender_email, message, is_read, reply_text, replied_by, replied_at, created_at, attachments, sender_user_id, parent_message_id, is_closed').
      single();

      if (error) throw error;

      const newMessage = {
        ...data,
        is_read: data.is_read === true || data.is_read === 1,
        is_closed: data.is_closed === true || data.is_closed === 1
      } as Message;

      await logAudit({
        actor: user.username,
        action: 'create',
        entity: 'inbox_messages',
        entity_id: newMessage.id,
        metadata: {
          action: 'message_sent'
        }
      });

      setMessages([newMessage, ...messages]);
      setSelectedMessage(newMessage);
      setComposeMessage('');
      setComposeAttachments([]);
      setIsComposeOpen(false);
      toast.success('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };
  const toggleStatus = async (close: boolean) => {
    if (!selectedMessage) return;
    try {
      const { error } = await supabase.
      from('inbox_messages').
      update({
        is_closed: close ? 1 : 0
      }).
      eq('message_id', selectedMessage.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'update',
        entity: 'inbox_messages',
        entity_id: selectedMessage.id,
        metadata: {
          action: close ? 'closed' : 'reopened'
        }
      });
      toast.success(`Message ${close ? 'closed' : 'reopened'}`);
      const updatedMsg = {
        ...selectedMessage,
        is_closed: close
      };
      setMessages(
        messages.map((m) => m.id === selectedMessage.id ? updatedMsg : m)
      );
      setSelectedMessage(updatedMsg);
    } catch (error) {
      // Prototype fallback
      const updatedMsg = {
        ...selectedMessage,
        is_closed: close
      };
      setMessages(
        messages.map((m) => m.id === selectedMessage.id ? updatedMsg : m)
      );
      setSelectedMessage(updatedMsg);
      toast.success(`Status updated (Prototype mode)`);
    }
  };
  const filteredMessages = messages.filter((msg) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
    msg.sender_name.toLowerCase().includes(searchLower) ||
    msg.sender_email?.toLowerCase().includes(searchLower) ||
    msg.message.toLowerCase().includes(searchLower);
    const matchesStatus =
    statusFilter === 'all' ?
    true :
    statusFilter === 'open' ?
    !msg.is_closed :
    msg.is_closed;
    const matchesRead =
    readFilter === 'all' ?
    true :
    readFilter === 'read' ?
    msg.is_read :
    !msg.is_read;
    return matchesSearch && matchesStatus && matchesRead;
  });
  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inbox</h2>
          <p className="text-slate-500 mt-1">
            Manage access requests and messages
          </p>
        </div>
        <button
          onClick={() => setIsComposeOpen(true)}
          className="btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          New Message
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        {/* Message List Sidebar */}
        <div
          className={`w-full md:w-1/3 lg:w-2/5 border-r border-slate-200 flex flex-col ${selectedMessage ? 'hidden md:flex' : 'flex'}`}>
          
          <div className="p-4 border-b border-slate-200 space-y-3 flex-shrink-0">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search messages..." />
            
            <div className="flex gap-2">
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                {
                  label: 'Open',
                  value: 'open'
                },
                {
                  label: 'Closed',
                  value: 'closed'
                },
                {
                  label: 'All Status',
                  value: 'all'
                }]
                }
                className="text-xs py-1.5" />
              
              <FilterSelect
                value={readFilter}
                onChange={setReadFilter}
                options={[
                {
                  label: 'Unread',
                  value: 'unread'
                },
                {
                  label: 'Read',
                  value: 'read'
                },
                {
                  label: 'All',
                  value: 'all'
                }]
                }
                className="text-xs py-1.5" />
              
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ?
            <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
              </div> :
            filteredMessages.length === 0 ?
            <div className="flex flex-col items-center justify-center p-8 text-slate-500 text-center">
                <InboxIcon className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">
                  No messages found matching your filters.
                </p>
              </div> :

            <ul className="divide-y divide-slate-100">
                {filteredMessages.map((msg) =>
              <li
                key={msg.id}
                onClick={() => handleSelectMessage(msg)}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedMessage?.id === msg.id ? 'bg-brand-primary/5 border-l-4 border-brand-primary' : 'border-l-4 border-transparent'} ${!msg.is_read ? 'bg-slate-50/50' : ''}`}>
                
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center">
                        {!msg.is_read &&
                    <div className="w-2 h-2 rounded-full bg-brand-accent mr-2"></div>
                    }
                        <span
                      className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                      
                          {msg.sender_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true
                    })}
                      </span>
                    </div>
                    <p
                  className={`text-xs truncate ${!msg.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                  
                      {msg.message}
                    </p>
                    <div className="flex items-center mt-2 space-x-2">
                      {msg.is_closed ?
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Closed
                        </span> :

                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                          Open
                        </span>
                  }
                      {msg.attachments &&
                  <Paperclip className="w-3 h-3 text-slate-400" />
                  }
                      {msg.reply_text &&
                  <CornerUpLeft className="w-3 h-3 text-slate-400" />
                  }
                    </div>
                  </li>
              )}
              </ul>
            }
          </div>
        </div>

        {/* Message Detail View */}
        <div
          className={`w-full md:w-2/3 lg:w-3/5 flex flex-col bg-slate-50/30 ${!selectedMessage ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
          
          {!selectedMessage ?
          <div className="text-center text-slate-400">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select a message to read</p>
            </div> :

          <>
              {/* Detail Header */}
              <div className="p-6 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex justify-between items-start mb-4">
                  <div className="md:hidden mb-4">
                    <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-sm text-brand-primary flex items-center">
                    
                      &larr; Back to inbox
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-semibold text-lg">
                      {selectedMessage.sender_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {selectedMessage.sender_name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {selectedMessage.sender_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedMessage.is_closed ?
                  <StatusBadge status="closed" /> :

                  <StatusBadge
                    status="open"
                    className="bg-green-100 text-green-800 border-green-200" />

                  }
                  </div>
                </div>
                <div className="flex items-center text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  {format(new Date(selectedMessage.created_at), 'PPpp')}
                </div>
              </div>

              {/* Message Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedMessage.message}
                  </p>

                  {selectedMessage.attachments &&
                <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2 flex items-center">
                        <Paperclip className="w-3.5 h-3.5 mr-1" /> Attachments
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(selectedMessage.attachments) ?
                    selectedMessage.attachments.map(
                      (att: any, i: number) =>
                      <div
                        key={i}
                        className="flex items-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                        
                                <span className="truncate max-w-[150px]">
                                  {att.name || 'document'}
                                </span>
                                {att.size &&
                        <span className="text-slate-400 ml-2">
                                    {att.size}
                                  </span>
                        }
                              </div>

                    ) :

                    <div className="text-xs text-slate-500">
                            Attachments present (JSON)
                          </div>
                    }
                      </div>
                    </div>
                }
                </div>

                {/* Reply History */}
                {selectedMessage.reply_text &&
              <div className="ml-8 bg-brand-primary/5 p-5 rounded-xl border border-brand-primary/10 relative">
                    <div className="absolute -left-3 top-6 w-3 h-px bg-brand-primary/20"></div>
                    <div className="absolute -left-3 top-0 bottom-0 w-px bg-brand-primary/20"></div>

                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-medium mr-2">
                          {selectedMessage.replied_by?.
                      charAt(0).
                      toUpperCase() || 'S'}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {selectedMessage.replied_by || 'System'}
                        </span>
                      </div>
                      {selectedMessage.replied_at &&
                  <span className="text-xs text-slate-500">
                          {format(new Date(selectedMessage.replied_at), 'PPp')}
                        </span>
                  }
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm">
                      {selectedMessage.reply_text}
                    </p>
                  </div>
              }
              </div>

              {/* Reply Box */}
              {canEdit &&
            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                  {!selectedMessage.is_closed || selectedMessage.reply_text ?
              <div className="space-y-3">
                      <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                  rows={3} />
                
                      <div className="flex justify-between items-center">
                        <button
                    onClick={() =>
                    toggleStatus(!selectedMessage.is_closed)
                    }
                    className="text-sm text-slate-500 hover:text-slate-800 font-medium">
                    
                          {selectedMessage.is_closed ?
                    'Reopen Issue' :
                    'Close without reply'}
                        </button>
                        <button
                    onClick={handleReply}
                    disabled={isSubmitting || !replyText.trim()}
                    className="btn-primary py-1.5 px-4 text-sm flex items-center disabled:opacity-50">
                    
                          {isSubmitting ? 'Sending...' : 'Send Reply & Close'}
                        </button>
                      </div>
                    </div> :

              <div className="text-center py-2">
                      <button
                  onClick={() => toggleStatus(false)}
                  className="btn-secondary text-sm">
                  
                        Reopen to Reply
                      </button>
                    </div>
              }
                </div>
            }
            </>
          }
        </div>
      </div>

      {isComposeOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
            className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsComposeOpen(false)} />
          

            <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4 border-b border-slate-100 pb-3">
                New Message
              </h3>

              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      From
                    </label>
                    <input
                    type="text"
                    value={user?.full_name || user?.username || ''}
                    disabled
                    className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input-field mt-1" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                  required
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  rows={6}
                  className="input-field mt-1 resize-none"
                  placeholder="Write your request or message..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Attachments
                  </label>
                  <input
                  type="file"
                  multiple
                  onChange={handleAttachmentChange}
                  className="input-field mt-1" />
                  {composeAttachments.length > 0 &&
                <div className="mt-2 flex flex-wrap gap-2">
                      {composeAttachments.map((attachment, index) =>
                    <span
                      key={`${attachment.name}-${index}`}
                      className="inline-flex items-center px-2 py-1 rounded border border-slate-200 bg-slate-50 text-xs text-slate-600">
                          <Paperclip className="w-3 h-3 mr-1" />
                          {attachment.name}
                        </span>
                    )}
                    </div>
                }
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 sm:flex sm:flex-row-reverse">
                  <button
                  type="submit"
                  disabled={isSubmitting || !composeMessage.trim()}
                  className="w-full inline-flex justify-center items-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {isSubmitting ? 'Sending...' : <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </>}
                  </button>
                  <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }
    </div>);

};
