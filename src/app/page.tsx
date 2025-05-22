'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { useRouter } from 'next/navigation';
import ChatList from '@/components/ChatList';
import Conversation from '@/components/Conversation';
import UserList from '@/components/UserList';
// Import only the icons we actually use
import { RiHome7Line, RiPencilRulerLine, RiBarChartLine, RiFileList3Line, RiFolderLine, RiSettings5Line } from 'react-icons/ri';
import { FiSearch, FiLogOut, FiUsers, FiMessageSquare } from 'react-icons/fi';
import { AiOutlineFilter } from 'react-icons/ai';
import { IoPersonOutline } from "react-icons/io5";
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuRefreshCcw } from 'react-icons/lu';
import { HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import { GoTrash } from "react-icons/go";
import { PiTagChevronDuotone } from "react-icons/pi";

export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'chats' | 'users'>('chats');
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUser(user.id);
        setLoading(false);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

     return () => {
      authListener?.subscription?.unsubscribe();
     };
  }, [router]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    } else {
      router.push('/login');
    }
  };

  const handleSelectUser = async (selectedUserId: string) => {
    if (!currentUser) return;

    console.log('Selected user ID:', selectedUserId);

    const { data: selectedUserChats, error: selectedUserChatsError } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', selectedUserId);

    if (selectedUserChatsError) {
      console.error('Error fetching chats for selected user:', selectedUserChatsError);
      return;
    }

    const selectedUserChatIds = selectedUserChats.map(chat => chat.chat_id);
    console.log('Selected user is in chats:', selectedUserChatIds);

    if (selectedUserChatIds.length === 0) {
        console.log('Selected user is not in any chats. No existing chat found.');
        // No existing chat found, create a new one
        console.log('No existing chat found, creating new one...');
        const { data: newChatData, error: createChatError } = await supabase
          .from('chats')
          .insert([{ name: 'Direct Message', is_group: false }])
          .select()
          .single();

        if (createChatError || !newChatData) {
          console.error('Error creating new chat:', createChatError);
          return;
        }

        const newChatId = newChatData.id;
        console.log('New chat created with ID:', newChatId);

        // Add both users to the new chat_members table
        const { error: addMembersError } = await supabase
          .from('chat_members')
          .insert([
            { chat_id: newChatId, user_id: currentUser, role: 'member' },
            { chat_id: newChatId, user_id: selectedUserId, role: 'member' }
          ]);

        if (addMembersError) {
          console.error('Error adding members to new chat:', addMembersError);
          // Optionally delete the created chat if adding members fails
          await supabase.from('chats').delete().eq('id', newChatId);
          return;
        }

        // Select the newly created chat
        console.log('Members added, selecting new chat ID:', newChatId);
        setSelectedChatId(newChatId);
        setCurrentView('chats'); // Switch back to chats view
      return;
    }

    // Check if a direct chat already exists between currentUser and selectedUserId
    const { data: existingChats, error: fetchError } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', currentUser)
      .in('chat_id', selectedUserChatIds);

    if (fetchError) {
      console.error('Error checking for existing chat:', fetchError);
      return;
    }

    console.log('Existing chats found:', existingChats);

    let chatId: string | null = null;

    if (existingChats && existingChats.length > 0) {
        // Found potential existing chats, now check if it's a direct 1-on-1 chat
        for (const chat of existingChats) {
             const { data: memberCountData, error: memberCountError } = await supabase
               .from('chat_members')
          .select('*')
               .eq('chat_id', chat.chat_id);

             if (memberCountError) {
                console.error('Error counting members in potential chat:', memberCountError);
                continue;
             }

        if (memberCountData && memberCountData.length === 2) {
                 // This is a direct 1-on-1 chat, select it
                 chatId = chat.chat_id;
                 break; // Found the chat, exit loop
             }
        }
    }

    if (chatId) {
      // Existing direct chat found, select it
      console.log('Existing chat found with ID:', chatId);
      setSelectedChatId(chatId);
      setCurrentView('chats'); // Switch back to chats view
    } else {
      // No existing direct chat found, create a new one
      console.log('No existing chat found, creating new one...');
      const { data: newChatData, error: createChatError } = await supabase
        .from('chats')
        .insert([{ name: 'Direct Message', is_group: false }])
        .select()
        .single();

      if (createChatError || !newChatData) {
        console.error('Error creating new chat:', createChatError);
        return;
      }

      const newChatId = newChatData.id;
      console.log('New chat created with ID:', newChatId);

      // Add both users to the new chat_members table
      const { error: addMembersError } = await supabase
        .from('chat_members')
        .insert([
          { chat_id: newChatId, user_id: currentUser, role: 'member' },
          { chat_id: newChatId, user_id: selectedUserId, role: 'member' }
        ]);

      if (addMembersError) {
        console.error('Error adding members to new chat:', addMembersError);
        // Optionally delete the created chat if adding members fails
        await supabase.from('chats').delete().eq('id', newChatId);
        return;
      }

      // Select the newly created chat
      console.log('Members added, selecting new chat ID:', newChatId);
      setSelectedChatId(newChatId);
      setCurrentView('chats'); // Switch back to chats view
    }
    console.log('handleSelectUser complete. Current selectedChatId:', selectedChatId);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <main className="flex flex-col h-screen">
      <header className="w-full flex items-center justify-between px-6 py-2 bg-white border-b border-gray-100 shadow-sm z-20">
        <div></div>
        <nav className="flex items-center space-x-4" aria-label="Top bar actions">
          <button className="flex items-center space-x-1 text-gray-600 hover:text-green-600 text-sm font-medium focus:outline-none"><LuRefreshCcw className="w-5 h-5"/><span>Refresh</span></button>
          <button className="flex items-center space-x-1 text-gray-600 hover:text-green-600 text-sm font-medium focus:outline-none"><HiOutlineQuestionMarkCircle className="w-5 h-5"/><span>Help</span></button>
          <div className="flex items-center space-x-1 text-gray-600 text-sm font-medium"><IoPersonOutline className="w-5 h-5"/><span>5 / 6 phones</span></div>
          <div className="flex items-center space-x-1 ml-2">
            <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-800 border border-white">H</div>
            <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800 border border-white">R</div>
            <div className="w-7 h-7 rounded-full bg-yellow-200 flex items-center justify-center text-xs font-bold text-yellow-800 border border-white">B</div>
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-800 border border-white">+3</div>
          </div>
          <button className="text-gray-600 hover:text-green-600 focus:outline-none"><FiSearch className="w-5 h-5"/></button>
        </nav>
      </header>
      <section className="flex flex-1 overflow-hidden">
        <aside className="flex flex-col items-center py-4 w-16 bg-white text-gray-600 flex-shrink-0 space-y-4 border-r border-gray-100 shadow-sm h-full" aria-label="Sidebar">
          <img  src="/logo.png" alt="App Logo" className="w-10 h-10 mb-2 rounded-full" />
          <nav className="flex flex-col items-center space-y-5 mt-10" aria-label="Sidebar navigation">
            <button className="hover:text-green-600 focus:outline-none"><RiHome7Line className="w-6 h-6"/></button>
            <button className={`focus:outline-none ${currentView === 'chats' ? 'text-green-600' : 'hover:text-green-600'}`} onClick={() => setCurrentView('chats')} title="View Chats"><FiMessageSquare className="w-6 h-6"/></button>
            <button className={`focus:outline-none ${currentView === 'users' ? 'text-green-600' : 'hover:text-green-600'}`} onClick={() => setCurrentView('users')} title="View Users"><FiUsers className="w-6 h-6"/></button>
            <button className="hover:text-green-600 focus:outline-none"><RiPencilRulerLine className="w-6 h-6"/></button>
            <button className="hover:text-green-600 focus:outline-none"><RiBarChartLine className="w-6 h-6"/></button>
            <button className="hover:text-green-600 focus:outline-none"><RiFileList3Line className="w-6 h-6"/></button>
            <button className="hover:text-green-600 focus:outline-none"><RiFolderLine className="w-6 h-6"/></button>
            <button className="hover:text-green-600 focus:outline-none"><GoTrash className="w-6 h-6"/></button>
            <button className="hover:text-green-600 focus:outline-none"><PiTagChevronDuotone className="w-6 h-6"/></button>
          </nav>
          <div className="mt-auto flex flex-col items-center space-y-5 mb-2 w-full">
            <button className="hover:text-green-600 focus:outline-none"><RiSettings5Line className="w-6 h-6"/></button>
            <button 
              onClick={handleSignOut} 
              className="flex items-center justify-center w-10 h-10 mt-4 rounded-full bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none mx-auto"
              title="Sign out"
            >
              <FiLogOut className="w-6 h-6"/>
            </button>
          </div>
        </aside>
        <section className="flex flex-1 h-full">
          <section className="flex flex-col w-80 bg-white flex-shrink-0 border-r border-gray-200 h-full">
            <header className="flex items-center justify-between p-4 border-b border-gray-200">
              <span className="text-lg font-semibold text-gray-800">{currentView === 'chats' ? 'Chats' : 'Users'}</span>
              {currentView === 'chats' && <BsThreeDotsVertical className="w-4 h-4 text-gray-500"/>}
            </header>
            {currentView === 'chats' && (
              <div className="flex items-center p-2 border-b border-gray-200">
                <button className="flex items-center space-x-2 text-green-600 text-sm px-2 py-1 rounded-md hover:bg-gray-50 focus:outline-none">
                  <AiOutlineFilter className="w-3 h-3"/>
                  <span>Custom filter</span>
                </button>
                <button className="flex items-center space-x-2 text-gray-600 text-sm px-2 py-1 rounded-md hover:bg-gray-50 focus:outline-none">
                  <span>Save</span>
                </button>
                <div className="flex items-center flex-grow mx-2 bg-gray-50 rounded-md px-2 py-1 space-x-2 text-gray-600 focus-within:text-gray-800 focus-within:bg-white focus-within:shadow-sm transition-all duration-200">
                  <FiSearch className="w-3 h-3"/>
                  <input 
                    type="text"
                    placeholder="Search"
                    className="flex-grow bg-transparent outline-none text-sm placeholder-gray-500"
                  />
                </div>
                <button className="flex items-center space-x-2 text-gray-600 text-sm px-2 py-1 rounded-md hover:bg-gray-50 focus:outline-none">
                  <span>Filtered</span>
                </button>
              </div>
            )}

            {currentView === 'chats' ? (
              <ChatList onSelectChat={setSelectedChatId} selectedChatId={selectedChatId} />
            ) : (
              <UserList onSelectUser={handleSelectUser} />
            )}
          </section>
          <section className="flex flex-col flex-1 h-full bg-white">
            <Conversation chatId={selectedChatId} />
          </section>
        </section>
      </section>
    </main>
  );
}
