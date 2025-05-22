'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Database } from '@/lib/database.types';
import { LiaUsersCogSolid } from "react-icons/lia";

type User = Database['public']['Tables']['users']['Row'];
type ChatMember = Database['public']['Tables']['chat_members']['Row'];

interface MemberManagerProps {
  chatId: string;
}

export default function MemberManager({ chatId }: MemberManagerProps) {
  const [members, setMembers] = useState<(ChatMember & { users: User })[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMembers();
    fetchAllUsers();
  }, [chatId]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('chat_members')
      .select('*, users(*)')
      .eq('chat_id', chatId);

    if (error) {
      console.error('Error fetching members:', error);
    } else {
      setMembers(data || []);
    }
  };

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setAllUsers(data || []);
    }
  };

  const handleAddMember = async (userId: string) => {
    const { error } = await supabase
      .from('chat_members')
      .insert([
        {
          chat_id: chatId,
          user_id: userId,
          role: 'member'
        }
      ]);

    if (error) {
      console.error('Error adding member:', error);
    } else {
      fetchMembers();
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const { error } = await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
    } else {
      fetchMembers();
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'member') => {
    const { error } = await supabase
      .from('chat_members')
      .update({ role: newRole })
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error changing role:', error);
    } else {
      fetchMembers();
    }
  };

  const filteredUsers = allUsers.filter(user =>
    !members.some(member => member.user_id === user.id) &&
    user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-gray-600 hover:text-green-600 focus:outline-none"
      >
        <LiaUsersCogSolid className="w-5 h-5" />
        <span>Members</span>
      </button>

      {isOpen && (
        <aside className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          <header className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Current Members</h3>
          </header>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    {member.users?.name ? member.users.name.charAt(0).toUpperCase() : ''}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{member.users?.name || 'Unnamed User'}</div>
                    <div className="text-xs text-gray-500">{member.role}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member.user_id, e.target.value as 'admin' | 'member')}
                    className="text-xs border rounded px-1 py-0.5"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <header className="mt-4 mb-2">
            <h3 className="text-sm font-semibold mb-2">Add New Members</h3>
          </header>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            className="w-full px-2 py-1 text-sm border rounded mb-2"
          />
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {filteredUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-sm">{user.name || user.email}</div>
                </div>
                <button
                  onClick={() => handleAddMember(user.id)}
                  className="text-xs text-green-600 hover:text-green-700"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
} 