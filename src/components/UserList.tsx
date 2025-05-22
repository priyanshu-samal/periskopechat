'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Database } from '@/lib/database.types';

type User = Database['public']['Tables']['users']['Row'];

interface UserListProps {
  onSelectUser: (userId: string) => void;
}

export default function UserList({ onSelectUser }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);

      // Fetch current user just to get the ID
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error('Error fetching auth user:', authError);
        setError('Error fetching user data.');
        setLoading(false);
        return;
      }

      // Fetch all other users
      const { data: allUsersData, error: allUsersError } = await supabase
        .from('users')
        .select('*')
        .neq('id', authUser.id); // Exclude the current user

      if (allUsersError) {
        console.error('Error fetching all users:', allUsersError);
        setError(allUsersError.message);
        setUsers([]);
      } else {
        setUsers(allUsersData || []);
      }

      setLoading(false);
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <aside className="flex flex-col items-center justify-center h-full text-gray-500">Loading users...</aside>;
  }

  if (error) {
    return <aside className="flex flex-col items-center justify-center h-full text-red-500">Error loading users: {error}</aside>;
  }

  return (
    <aside className="flex flex-col py-2 px-2 h-full overflow-y-auto" aria-label="User list sidebar">
      <div className="text-lg font-semibold text-gray-800 px-3 mb-4">Users</div>
      <ul className="space-y-1" role="list">
        {users.map((user) => (
          <li key={user.id}>
          <button
            onClick={() => onSelectUser(user.id)}
            className="w-full p-3 rounded-lg text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium">
                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-gray-900">{user.name || user.email}</div>
              </div>
            </div>
          </button>
          </li>
        ))}
      </ul>
    </aside>
  );
} 