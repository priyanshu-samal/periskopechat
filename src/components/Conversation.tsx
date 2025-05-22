'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Database } from '@/lib/database.types';
// Import icons based on Screenshot 28
import { LuRefreshCcw } from 'react-icons/lu';
import { HiOutlineQuestionMarkCircle } from 'react-icons/hi';
// import { IoPersonOutline } from "react-icons/io5";
import { SlOptionsVertical } from 'react-icons/sl';
import { AiOutlinePaperClip, AiOutlineSend, AiOutlineSmile, AiOutlineCheck } from 'react-icons/ai';
import { FiMic } from 'react-icons/fi';
import { BsCamera, BsThreeDots } from 'react-icons/bs';
import LabelManager from './LabelManager';
import MemberManager from './MemberManager';
import { uploadFile, getFileIcon, FileType } from '@/utils/fileUpload';

// Define more specific types
type Message = Database['public']['Tables']['messages']['Row'];
type User = Database['public']['Tables']['users']['Row'];
// Remove unused Chat type
// type Chat = Database['public']['Tables']['chats']['Row'];

// Define the structure of the chat data we fetch
interface FetchedChatData {
  name: string;
  is_group: boolean;
  chat_members: Array<{
    id: string;
    chat_id: string;
    user_id: string;
    role: 'member' | 'admin';
    joined_at: string;
    users: User[];
  }>;
}

// Update ChatMemberWithUser type to match the database structure (no joined_at)
type ChatMemberWithUser = {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'member' | 'admin';
  users: User[];
};

interface MessageWithSender extends Message {
  users: User | null;
}

interface ConversationProps {
  chatId: string | null;
}

export default function Conversation({ chatId }: ConversationProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatName, setChatName] = useState<string>('Loading...');
  const [chatMembers, setChatMembers] = useState<ChatMemberWithUser[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatData, setChatData] = useState<FetchedChatData | null>(null);

  useEffect(() => {
    const fetchMessagesAndChat = async () => {
      if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
        setMessages([]);
        setChatName('Unknown Chat');
        setChatMembers([]);
        setChatData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(
          `
          *,
          users (id, name, avatar_url, email, created_at)
          `
        )
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setError(messagesError.message);
        setMessages([]);
      } else {
        setMessages(messagesData as MessageWithSender[]);
      }

      // Fetch chat data with proper typing
      const { data: chatDataResult, error: chatError } = await supabase
        .from('chats')
        .select(
          `
          name,
          is_group,
          chat_members (
            id,
            chat_id,
            user_id,
            role,
            users (id, name, avatar_url, email, created_at)
          )
          `
        )
        .eq('id', chatId)
        .single();

      if (chatError) {
        console.error('Error fetching chat data:', chatError);
        setChatData(null);
        setChatMembers([]);
      } else if (chatDataResult) {
        const typedChatData = chatDataResult as FetchedChatData;
        setChatData(typedChatData);
        const membersWithUsers: ChatMemberWithUser[] = typedChatData.chat_members.map(member => ({
          
          id: member.id,
          chat_id: member.chat_id,
          user_id: member.user_id,
          role: member.role,
          users: member.users
        }));
        setChatMembers(membersWithUsers);
      }

      setLoading(false);
    };

    fetchMessagesAndChat();

    // Fetch current user
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
            if (error) {
                console.error('Error fetching user:', error);
            } else {
                setCurrentUser(data);
            }
        }
    };
    fetchUser();

    // Real-time subscription for messages
    const messagesSubscription = supabase
      .channel(`chat_${chatId}_messages`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          console.log('Realtime message insert:', payload);
          const newMessage = payload.new as Message;
          // Fetch sender name for the new message and add it to the messages state
          supabase.from('users').select('id, name, avatar_url, email, created_at').eq('id', newMessage.sender_id).single()
            .then(({ data: senderData, error: senderError }) => {
              if (senderError) {
                console.error('Error fetching sender for new message:', senderError);
                 // If sender fetch fails, add the message with null user data
                 setMessages((prevMessages) => [...prevMessages, { ...newMessage, users: null }]);
              } else {
                 console.log('Sender data for new message:', senderData);
                 // Remove any optimistic message with the same content, sender, and close timestamp
                 setMessages((prevMessages) => {
                   const filtered = prevMessages.filter(
                     (msg) =>
                       !(
                         msg.sender_id === newMessage.sender_id &&
                         msg.content === newMessage.content &&
                         Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000 // 5s window
                       )
                   );
                   return [...filtered, { ...newMessage, users: senderData as User }];
                 });
              }
            });
        }
      )
      .subscribe();

    // Real-time subscription for chat members
    const membersSubscription = supabase
      .channel(`chat_${chatId}_members`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          console.log('Realtime chat_members change:', payload);
          // Refetch chat data to update members list
          fetchMessagesAndChat();
        }
      )
      .subscribe();

    return () => {
       supabase.removeChannel(messagesSubscription);
       supabase.removeChannel(membersSubscription);
       console.log(`Unsubscribed from chat_${chatId}_messages and chat_${chatId}_members`);
    };

  }, [chatId]);

  useEffect(() => {
    // Debug logs to help diagnose the issue
    console.log('chatData:', chatData);
    console.log('currentUser:', currentUser);
    if (chatData) {
      console.log('chat_members:', chatData.chat_members);
    }

    if (!chatData) {
      setChatName(chatId ? `Chat: ${chatId}` : 'Unknown Chat');
      return;
    }

    if (chatData.is_group) {
      setChatName(chatData.name || `Group: ${chatId}` || 'Unnamed Group');
    } else if (currentUser) {
      const otherMember = chatData.chat_members.find(
        (member) => member.user_id !== currentUser.id
      );
      const otherUser = Array.isArray(otherMember?.users)
        ? otherMember?.users[0]
        : otherMember?.users;

      if (otherUser) {
        setChatName(otherUser.name || otherUser.email || `User: ${otherMember?.user_id}` || 'Unknown User');
      } else {
        setChatName(`User: ${otherMember?.user_id}` || 'Unknown User');
      }
    } else {
      setChatName(chatId ? `Chat: ${chatId}` : 'Unknown User');
    }
  }, [chatData, currentUser, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Log chatMembers state whenever it changes
  useEffect(() => {
    console.log('chatMembers state updated:', chatMembers);
  }, [chatMembers]);

  useEffect(() => {
    if (!loading && chatId) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    }
  }, [chatId, loading]);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !chatId || !currentUser) return;

    // Optimistically add the new message to the state
    const optimisticMessage: MessageWithSender = {
        id: Math.random().toString(), // Temporary ID for optimistic update
        chat_id: chatId,
        sender_id: currentUser.id,
        content: newMessage,
        created_at: new Date().toISOString(),
        is_read: false, // Assuming initially not read
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        users: currentUser, // Include current user data for display
    };
    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
    setNewMessage(''); // Clear input immediately

    // Insert the message into the database
    const messageToSend = {
      chat_id: chatId,
      sender_id: currentUser.id,
      content: optimisticMessage.content, // Use content from optimistic message
    };

    const { error } = await supabase.from('messages').insert([messageToSend]);

    if (error) {
      console.error('Error sending message:', error);
      // Optionally, revert the optimistic update if the insertion fails
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== optimisticMessage.id));
      setError('Failed to send message.');
    } else {
       // Realtime subscription will handle adding the message with the correct ID from the DB
       // The optimistic message with temporary ID will eventually be replaced by the real one
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!chatId || !currentUser) return;
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const uploadedFile = await uploadFile(file, chatId);
      if (!uploadedFile) throw new Error('Upload failed');

      // Create message with attachment
      const messageToSend = {
        chat_id: chatId,
        sender_id: currentUser.id,
        content: '', // Optional caption could be added here
        attachment_url: uploadedFile.url,
        attachment_type: uploadedFile.type,
        attachment_name: uploadedFile.name
      };

      const { error } = await supabase.from('messages').insert([messageToSend]);
      if (error) throw error;

    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Add this after chatMembers and currentUser are defined
  const isCurrentUserAdmin = chatData?.is_group && chatMembers.some(
    (member) => member.user_id === currentUser?.id && member.role === 'admin'
  );

  const handleDeleteGroup = async () => {
    if (!chatId) return;
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;

    // Delete related messages, chat_members, chat_labels first
    await supabase.from('messages').delete().eq('chat_id', chatId);
    await supabase.from('chat_members').delete().eq('chat_id', chatId);
    await supabase.from('chat_labels').delete().eq('chat_id', chatId);

    // Now delete the chat itself
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (error) {
      alert('Failed to delete group: ' + error.message);
      return;
    }

    // Optionally, redirect user to chat list or home
    window.location.reload();
  };

  if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
    return (
      <div className="flex flex-col flex-auto h-full p-6 items-center justify-center text-gray-500">
         Select a valid chat to start messaging
      </div>
    );
  }

  if (loading) {
    return (
       <div className="flex flex-col flex-auto h-full p-6 items-center justify-center text-gray-500">
          Loading messages...
       </div>
    );
  }

  if (error) {
     return (
       <main className="flex flex-col flex-auto h-full p-6 items-center justify-center text-gray-500">
          Error loading messages: {error}
       </main>
     );
  }

  return (
    <main className="flex flex-col flex-auto h-full bg-white overflow-hidden">
      {/* Conversation Header - Dynamic Content and Thinner Padding */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
         {/* Chat Name and Participants */}
         <div className="flex flex-col">
            <span className="text-base font-bold text-gray-900 leading-tight">{chatName}</span>
            {/* Display member count for group chats, remove for DMs */}
            {chatMembers.length > 2 && (
               <span className="text-xs text-gray-400 mt-0.5">{chatMembers.length} members</span>
            )}
         </div>
         {/* Right Icons */}
         <div className="flex items-center space-x-3 text-gray-400 text-xs">
            <button className="flex items-center space-x-1 hover:text-green-600 focus:outline-none"><LuRefreshCcw className="w-4 h-4"/><span>Refresh</span></button>
            <button className="flex items-center space-x-1 hover:text-green-600 focus:outline-none"><HiOutlineQuestionMarkCircle className="w-4 h-4"/><span>Help</span></button>
            {/* Phones Info - Keep as placeholder for now if needed */}
            {/* <div className="flex items-center space-x-1">
               <IoPersonOutline className="w-4 h-4"/>
               <span>5 / 6 phones</span>
            </div> */}
             {/* Label and Member Management */}
             {chatId && (
               <>
                 {/* Render LabelManager and MemberManager based on whether it's a group chat */}
                 {/* Assuming chatData includes an is_group property */}
                 {/* For now, always render, but their internal logic should handle DM vs Group */}
                 <LabelManager chatId={chatId} />
                 <MemberManager chatId={chatId} />
               </>
             )}
             {/* More Options */}
            <button className="hover:text-green-600 focus:outline-none"><SlOptionsVertical className="w-4 h-4"/></button>
            {/* Delete Group Button for Admins */}
            {chatData?.is_group && isCurrentUserAdmin && (
              <button
                className="ml-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold text-xs"
                onClick={handleDeleteGroup}
              >
                Delete Group
              </button>
            )}
         </div>
      </header>

      {/* Message List Area - Matching Screenshot 28 */}
      <section className="flex flex-col flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-white relative">
        <div className="flex flex-col h-full w-full">
          <div className="flex flex-col gap-y-1 w-full">
             {/* Date Separator Placeholder */}
             {/* You would dynamically add date separators based on message timestamps */}
             {messages.map((message, index) => {
                const previousMessage = index > 0 ? messages[index - 1] : null;
                const messageDate = new Date(message.created_at).toDateString();
                const previousMessageDate = previousMessage ? new Date(previousMessage.created_at).toDateString() : null;
                const showDateSeparator = !previousMessage || messageDate !== previousMessageDate;

                return (
                   <>
                      {showDateSeparator && (
                         <div key={`date-${message.id}`} className="w-full flex justify-center my-2">
                            <span className="bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full shadow-sm">{messageDate === new Date().toDateString() ? 'Today' : messageDate}</span>
                         </div>
                      )}
                      <div
                         key={message.id}
                      className={`flex w-full ${message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                      >
                      <div className={`flex items-end ${message.sender_id === currentUser?.id ? 'flex-row-reverse' : 'flex-row'} max-w-[75%]`}>
                            {/* Avatar - Matching Screenshot 28 (Placeholder) */}
                            {/* You would replace this with actual user avatars */}
                        <div className={`flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-white text-xs font-bold ${message.sender_id === currentUser?.id ? 'bg-green-500 ml-2' : 'bg-gray-300 mr-2'}`}>
                          {message.users?.name ? message.users.name.charAt(0).toUpperCase() : (message.sender_id === currentUser?.id && currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A')}
                            </div>
                           {/* Message Bubble Content */}
                        <div className={`relative text-sm px-4 py-2 shadow-lg border border-gray-100 min-h-[48px] ${message.sender_id === currentUser?.id ? 'bg-green-100 text-gray-900 rounded-2xl rounded-br-md' : 'bg-white text-gray-800 rounded-2xl rounded-bl-md'}`}>
                             {/* Attachment Preview */}
                             {message.attachment_url && message.attachment_type && (
                               <div className="mb-2">
                                 {message.attachment_type === 'image' ? (
                                   <img
                                     src={message.attachment_url || ''}
                                     alt={message.attachment_name || 'Image attachment'}
                                     className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                     onClick={() => message.attachment_url && window.open(message.attachment_url, '_blank')}
                                   />
                                 ) : (
                                   <a
                                     href={message.attachment_url || undefined}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                   >
                                     <span className="text-xl">{getFileIcon(message.attachment_type as FileType)}</span>
                                     <span className="text-sm truncate max-w-[200px]">{message.attachment_name}</span>
                                   </a>
                                 )}
                               </div>
                             )}
                             {/* Message Text */}
                             {message.content && <div>{message.content}</div>}
                              {/* Timestamp and Read Status - Matching Screenshot 28 */}
                              <div className={`flex justify-end items-center mt-1 ${message.sender_id === currentUser?.id ? 'text-green-700' : 'text-gray-400'} text-[11px]`}>
                                 <span className="mr-1">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {/* Read Status Icon (Placeholder) */}
                                  {message.sender_id === currentUser?.id && <AiOutlineCheck className="w-3 h-3"/>}
                                  {message.sender_id === currentUser?.id && <AiOutlineCheck className="w-3 h-3 -ml-1"/>}
                              </div>
                           </div>
                         </div>
                       </div>
                   </>
                );
             })}
             {/* Always keep this as the last child for scroll-to-bottom */}
             <div ref={messagesEndRef} />
          </div>
        </div>
      </section>

      {/* Message Input Area */}
      <form className="flex items-center px-4 py-3 border-t border-gray-100 bg-white" onSubmit={handleSendMessage}>
         {/* Hidden file input */}
         <input
           type="file"
           ref={fileInputRef}
           onChange={handleFileSelect}
           className="hidden"
           accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
         />
         {/* Left Icons */}
         <div className="flex items-center space-x-3 text-gray-400">
            <button 
              type="button"
              onClick={triggerFileInput}
              className="hover:text-gray-600 focus:outline-none"
              disabled={uploading}
            >
              <AiOutlinePaperClip className="w-5 h-5"/>
            </button>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hover:text-gray-600 focus:outline-none"
              disabled={uploading}
            >
              <BsCamera className="w-5 h-5"/>
            </button>
            <button className="hover:text-gray-600 focus:outline-none"><AiOutlineSmile className="w-5 h-5"/></button>
            <button className="hover:text-gray-600 focus:outline-none"><BsThreeDots className="w-5 h-5"/></button>
         </div>
         {/* Input Field */}
         <div className="flex-grow mx-3">
            <input
              type="text"
              placeholder={uploading ? "Uploading..." : "Message..."}
             className="w-full border border-gray-200 rounded-full px-4 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 shadow-sm text-black"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                 if (e.key === 'Enter') {
                    handleSendMessage(e);
                 }
              }}
              disabled={uploading}
            />
            {uploadError && (
              <div className="text-red-500 text-xs mt-1">{uploadError}</div>
            )}
         </div>
         {/* Right Icon (Send or Mic) */}
         <div className="text-gray-400">
            {newMessage.trim() === '' ? (
               <button 
                 type="button"
                 className="hover:text-gray-600 focus:outline-none"
                 disabled={uploading}
               >
                  <FiMic className="w-5 h-5"/>
               </button>
            ) : (
               <button
                  type="submit"
                  className="flex items-center justify-center bg-green-500 hover:bg-green-600 rounded-full text-white w-9 h-9 focus:outline-none"
                  disabled={uploading}
               >
                  <AiOutlineSend className="w-5 h-5"/>
               </button>
            )}
         </div>
      </form>
    </main>
  );
}