'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Database } from '@/lib/database.types';
import { FiSearch } from 'react-icons/fi';
import { FiPlus } from 'react-icons/fi';


// Define types that precisely match the structure returned by your Supabase select query
// The main query selects from 'chat_members' and nests 'chats', and within 'chats',
// it nests 'chat_members', and within those, it nests 'users'.

// Type for the nested 'users' array within 'chat_members'
type NestedUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
} | null;

// Type for the nested 'chat_members' array within 'chats'
type NestedChatMember = Database['public']['Tables']['chat_members']['Row'] & {
  users: NestedUser[]; // This nested users property is an array
};

// Type for the nested 'chat_labels' array within 'chats'
type NestedChatLabel = Database['public']['Tables']['chat_labels']['Row'] & {
  labels: Database['public']['Tables']['labels']['Row'] | null;
};

// Type for the nested 'chats' object within the fetched 'chat_members' row
type NestedChat = Database['public']['Tables']['chats']['Row'] & {
  chat_members: NestedChatMember[];
  chat_labels: NestedChatLabel[];
};

// Type for the data returned directly from the outer 'chat_members' select query
type FetchedChatMemberRow = Database['public']['Tables']['chat_members']['Row'] & {
  chats: NestedChat | null; // Each top-level chat_member row contains a nested chat object
};

// The final Chat type that the component works with
type Chat = NestedChat;


interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  selectedChatId: string | null;
}

export default function ChatList({ onSelectChat, selectedChatId }: ChatListProps) {
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [availableLabels, setAvailableLabels] = useState<Database['public'] ['Tables']['labels']['Row'][]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // State to store current user's ID
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [allUsers, setAllUsers] = useState<Database['public']['Tables']['users']['Row'][]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'groups' | 'dms'>('all');

  useEffect(() => {
    const fetchUserDataAndChats = async () => {
      console.log('Fetching chats...');
      setLoading(true);

      // Fetch current user first
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('Error fetching user in ChatList:', userError);
        setError('Error fetching user.');
        setLoading(false);
        return;
      }

      if (!user) {
         console.log('User not available in ChatList, ChatPage should handle redirect.');
         setLoading(false);
         return;
      }

      setCurrentUserId(user.id); // Store current user ID

      console.log('User found in ChatList:', user.id);

      // Fetch chat members data and related chats and labels
      // Select all fields from chat_members rows for the current user
      // and nest the related chat object, selecting its fields and nested chat_members, users, chat_labels, and labels
      const { data, error: chatError } = await supabase
        .from('chat_members')
        .select(
          `
          *,
          chats (*,
            chat_members ( *, users (id, name, avatar_url, email, created_at) ),
            chat_labels ( *, labels (id, name, color) )
          )
          `
        )
        .eq('user_id', user.id); // Filter chat_members to get chats the current user is in

      if (chatError) {
        console.error('Error fetching chats:', chatError);
        setError(chatError.message);
        setAllChats([]);
      } else if (data) {
        console.log('Chats data fetched:', data);
        const userChats: Chat[] = [];
        const chatIds = new Set<string>(); // Specify type for Set
        const labels = new Set<Database['public'] ['Tables']['labels']['Row']>();
        const dmPartners = new Set<string>(); // To track unique DM partners

        // Iterate over the fetched chat_member rows (data is an array of FetchedChatMemberRow)
        // Filter out any null or undefined members or their nested chats
        const validFetchedMembers = (data as FetchedChatMemberRow[]).filter(member => member?.chats);

        validFetchedMembers.forEach((member) => { // member type is FetchedChatMemberRow with a non-null chats property
          const chat = member.chats; // chat is of type NestedChat

          if (chat) {
            if (chat.is_group) {
              // For group chats, add if not already in the list
              if (!chatIds.has(chat.id)) {
                const fullChat: Chat = {
                  ...chat,
                  chat_members: chat.chat_members || [],
                  chat_labels: chat.chat_labels || [],
                };
                userChats.push(fullChat);
                chatIds.add(fullChat.id);
              }
            } else {
              // For direct messages, identify the other participant
              const otherMember = (chat.chat_members ?? []).find(
                (m) => m.user_id !== currentUserId
              );
              if (otherMember && !dmPartners.has(otherMember.user_id)) {
                // If the other participant is found and not already added
                const fullChat: Chat = {
                  ...chat,
                  chat_members: chat.chat_members || [],
                  chat_labels: chat.chat_labels || [],
                };
                userChats.push(fullChat);
                chatIds.add(fullChat.id); // Still add chat ID to set for completeness
                dmPartners.add(otherMember.user_id); // Add other participant's ID to set
              }
            }

            // Collect unique labels
            (chat.chat_labels || []).forEach(cl => {
              if (cl?.labels) {
                labels.add(cl.labels);
              }
            });
          }
        });
        setAllChats(userChats);
        setFilteredChats(userChats);
        setAvailableLabels(Array.from(labels));
      }
      console.log('Finished fetching chats.');
      setLoading(false);
    };

    fetchUserDataAndChats();

    // Setup real-time subscriptions
    const subscription = supabase
      .channel('chat_list_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chats' },
        () => {
          // Re-fetch chats when a new chat is created (relevant if the user creates one)
          fetchUserDataAndChats();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_members' },
        (payload) => {
          // Re-fetch chats if the current user is added to a chat
          if (currentUserId && payload.new.user_id === currentUserId) {
             fetchUserDataAndChats();
          } else {
            // If a member is added to a chat the current user is already in,
            // we might need to update the member list display without full re-fetch.
            // For simplicity, a full re-fetch handles all scenarios for now.
             supabase.auth.getUser().then(({ data: { user } }) => {
                if (user && allChats.some(chat => chat.id === payload.new.chat_id)) {
                  fetchUserDataAndChats();
                }
             });
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_labels' },
        () => {
          // Re-fetch chats if labels change on any chat the user is in
          fetchUserDataAndChats();
        }
      )
       .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          // Re-fetch chats when a new message is inserted to potentially update last message snippet
           fetchUserDataAndChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      console.log('Unsubscribed from chat_list_changes.');
    };
  }, [currentUserId]); // Depend on currentUserId to refetch when user status is confirmed

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    let filtered = allChats.filter(chat => {
      return (
        // Search by chat name for group chats, or by participant name for direct messages
        (chat?.is_group ? chat.name?.toLowerCase().includes(lowerCaseSearchTerm) :
         // For direct messages, search names of the other participant(s)
         (Array.isArray(chat?.chat_members) ? chat.chat_members : []).some(member => {
           return member?.user_id !== currentUserId &&
             (Array.isArray(member?.users) ? member.users : (member?.users ? [member.users] : [])).some(user =>
               user?.name?.toLowerCase().includes(lowerCaseSearchTerm)
             );
         }))
        ||
        // Allow searching by any member's name in group chats as well
        (chat?.is_group && (Array.isArray(chat.chat_members) ? chat.chat_members : []).some(member => {
           return (Array.isArray(member?.users) ? member.users : (member?.users ? [member.users] : [])).some(user =>
             user?.name?.toLowerCase().includes(lowerCaseSearchTerm)
           );
         }))
      );
    });

    // Apply chat type filter
    if (chatTypeFilter === 'groups') {
      filtered = filtered.filter(chat => chat.is_group);
    } else if (chatTypeFilter === 'dms') {
      filtered = filtered.filter(chat => !chat.is_group);
    }

    if (selectedLabel) {
      filtered = filtered.filter(chat =>
        chat?.chat_labels?.some(cl => cl.labels?.id === selectedLabel) // Ensure chat_labels and cl.labels are not null
      );
    }

    setFilteredChats(filtered);
    // allChats is still needed here for filtering/searching, but removing from dependency array
    // relies on the assumption that allChats updates trigger this effect due to state change.
    // If filtering doesn't update on new chats, add allChats back to dependency array.
  }, [searchTerm, allChats, selectedLabel, currentUserId, chatTypeFilter]); // Explicitly include allChats here for filtering dependency

  useEffect(() => {
    // Fetch all users for group creation (excluding current user)
    const fetchUsers = async () => {
      if (!showGroupModal || !currentUserId) return;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId);
      if (!error && data) setAllUsers(data);
    };
    fetchUsers();
  }, [currentUserId, showGroupModal]);

  const getChatDisplayName = (chat: Chat): string => {
    if (chat?.is_group) {
      return chat.name || `Group (${chat.chat_members?.length || 0})`;
    } else {
      // For direct messages, find the other participant(s)
      const otherMembers = (chat?.chat_members ?? []).filter(member => member.user_id !== currentUserId);
      // Assuming a DM has only one other participant
      const otherMember = otherMembers[0];
      
      if (!otherMember) {
        return 'Direct Message';
      }

      // Handle both array and single user cases safely
      if (Array.isArray(otherMember.users)) {
        const user = otherMember.users[0];
        return user?.name || user?.email || 'Direct Message';
      } else if (otherMember.users) {
        // Handle single user case
        const user = otherMember.users as NestedUser;
        return user?.name || user?.email || 'Direct Message';
      }

      return 'Direct Message';
    }
  };

  const getParticipantNames = (chat: Chat): string => {
    if (chat?.is_group) {
      // For group chats, show names of other participants (excluding current user)
      return (chat?.chat_members ?? [])
        .filter(member => member.user_id !== currentUserId)
        .flatMap(member => member?.users || [])
        .filter(user => user?.name)
        .map(user => user?.name as string) // Map to user names (casting after filtering null)
        .join(', ');
    } else {
      // For direct messages, don't show participant names below the chat name
      return '';
    }
  };

  const handleUserCheckbox = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!groupName.trim()) {
      setFormError('Group name is required.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setFormError('Select at least one user.');
      return;
    }
    setCreating(true);
    // Create group chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert([{ name: groupName, is_group: true }])
      .select()
      .single();
    if (chatError || !chatData) {
      setFormError('Failed to create group chat.');
      setCreating(false);
      return;
    }
    // Add members (current user as admin + selected users as members)
    const members = [
      { chat_id: chatData.id, user_id: currentUserId!, role: 'admin' },
      ...selectedUserIds.map((id) => ({ chat_id: chatData.id, user_id: id, role: 'member' }))
    ];
    const { error: membersError } = await supabase
      .from('chat_members')
      .insert(members);
    if (membersError) {
      setFormError('Failed to add members.');
      setCreating(false);
      return;
    }
    // Reset and close
    setGroupName('');
    setSelectedUserIds([]);
    setShowGroupModal(false);
    setCreating(false);
  };

  if (loading) {
    return <nav className="flex flex-col items-center justify-center h-full text-gray-500">Loading chats...</nav>;
  }

  if (error) {
    return <nav className="flex flex-col items-center justify-center h-full text-red-500">Error loading chats: {error}</nav>;
  }

  return (
    <nav className="flex flex-col py-2 px-2 h-full overflow-y-auto" aria-label="Chat sidebar">
      {/* New Group Button */}
      <button
        className="flex items-center justify-center w-full mb-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold shadow transition-colors"
        onClick={() => setShowGroupModal(true)}
      >
        <FiPlus className="mr-2" /> New Group
      </button>
      {/* Chat Type Filter Buttons */}
      <div className="flex space-x-2 mb-3">
        <button
          className={`px-3 py-1 rounded text-sm font-medium ${chatTypeFilter === 'all' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          onClick={() => setChatTypeFilter('all')}
        >
          All
        </button>
        <button
          className={`px-3 py-1 rounded text-sm font-medium ${chatTypeFilter === 'groups' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          onClick={() => setChatTypeFilter('groups')}
        >
          Groups
        </button>
        <button
          className={`px-3 py-1 rounded text-sm font-medium ${chatTypeFilter === 'dms' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          onClick={() => setChatTypeFilter('dms')}
        >
          DMs
        </button>
      </div>
      {/* Search and Filter Area */}
      <div className="flex flex-col space-y-2 mb-4">
        <div className="flex items-center bg-gray-50 rounded-md px-3 py-2 space-x-2 text-gray-600 focus-within:bg-white focus-within:shadow-sm transition-all duration-200">
          <FiSearch className="w-3 h-3"/>
          <input
            type="text"
            placeholder="Search"
            aria-label="Search chats"
            className="flex-grow bg-transparent outline-none text-sm placeholder-gray-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Clear search"
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              onClick={() => setSearchTerm('')}
            >
              &#10005;
            </button>
          )}
        </div>

        {/* Label Filter */}
        {availableLabels.length > 0 && (
           <div className="flex items-center space-x-2 overflow-x-auto pb-2">
             <button
               aria-label="Show all labels"
               onClick={() => setSelectedLabel(null)}
               className={`flex items-center space-x-1 px-2 py-1 rounded text-sm ${
                 !selectedLabel
                   ? 'bg-green-100 text-green-700'
                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
               }`}
             >
               <span>All</span>
             </button>
             {availableLabels.map((label) => (
               <button
                 key={label.id}
                 aria-label={`Filter by label ${label.name}`}
                 onClick={() => setSelectedLabel(label.id)}
                 className={`flex items-center space-x-1 px-2 py-1 rounded text-sm ${
                   selectedLabel === label.id
                     ? 'bg-green-100 text-green-700'
                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                 }`}
               >
                 <div
                   className="w-2 h-2 rounded-full"
                   style={{ backgroundColor: label.color }}
                 />
                 <span>{label.name}</span>
               </button>
             ))}
           </div>
        )}
      </div>

      {/* Chat List */}
      <ul className="space-y-0.5" role="list">
        {filteredChats.length === 0 ? (
          <li className="text-center text-gray-400 py-8">No chats found</li>
        ) : (
          filteredChats.map((chat) => (
            <li key={chat.id}>
          <button
                onClick={() => chat.id && onSelectChat(chat.id)}
                disabled={!chat.id}
                className={`w-full p-2 rounded-xl text-left hover:bg-gray-50 transition-colors ${selectedChatId === chat.id ? 'bg-green-100' : ''} ${!chat.id ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                {/* Avatar Placeholder - Display initial of chat name or other participant */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg">
                  {getChatDisplayName(chat).charAt(0).toUpperCase() || 'A'}
                </div>
                <div>
                  {/* Display dynamic chat name (other participant for DM, group name for group) */}
                  <div className={`flex-grow min-w-0 ${selectedChatId === chat.id ? 'text-gray-900' : 'text-gray-700'}`}>
                    <p className="text-base font-semibold truncate">{getChatDisplayName(chat)}</p>
                    <p className="text-xs text-gray-400 truncate">{getParticipantNames(chat)}</p>
                  </div>
                </div>
              </div>
              {/* Labels */}
              <div className="flex space-x-0.5">
                {(chat.chat_labels || []).map((cl) => (
                  cl?.labels && (
                    <div
                      key={cl.labels.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: cl.labels.color }}
                      title={cl.labels.name}
                    />
                  )
                ))}
              </div>
            </div>
          </button>
            </li>
          ))
        )}
      </ul>
      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-black">Create Group Chat</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-black">Group Name</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 text-black"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-black">Add Members</label>
                <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {allUsers.length === 0 && <div className="text-gray-400 text-sm">No other users found.</div>}
                  {allUsers.map(user => (
                    <label key={user.id} className="flex items-center space-x-2 py-1 cursor-pointer text-black">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleUserCheckbox(user.id)}
                        disabled={creating}
                      />
                      <span className="text-sm text-black">{user.name || user.email}</span>
                    </label>
        ))}
      </div>
    </div>
              {formError && <div className="text-red-500 text-sm mb-2">{formError}</div>}
              <button
                type="submit"
                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded font-semibold disabled:opacity-60"
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      )}
    </nav>
  )
}