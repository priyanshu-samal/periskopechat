'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Database } from '@/lib/database.types';
import { PiTagChevronDuotone } from "react-icons/pi";

type Label = Database['public']['Tables']['labels']['Row'];
type ChatLabel = Database['public']['Tables']['chat_labels']['Row'];

interface LabelManagerProps {
  chatId: string;
}

export default function LabelManager({ chatId }: LabelManagerProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [chatLabels, setChatLabels] = useState<ChatLabel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#4CAF50'); // Default green color
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkedRole, setCheckedRole] = useState<boolean>(false);

  useEffect(() => {
    fetchLabels();
    fetchChatLabels();
    checkAdminRole();
  }, [chatId]);

  const checkAdminRole = async () => {
    setCheckedRole(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      setCheckedRole(true);
      return;
    }
    const { data, error } = await supabase
      .from('chat_members')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .single();
    if (error || !data) {
      setIsAdmin(false);
    } else {
      setIsAdmin(data.role === 'admin');
    }
    setCheckedRole(true);
  };

  const fetchLabels = async () => {
    // Fetch labels - removed filter by created_by as it doesn't exist
    const { data, error } = await supabase
      .from('labels')
      .select('*');

    if (error) {
      console.error('Error fetching labels:', error);
    } else {
      setLabels(data || []);
    }
  };

  const fetchChatLabels = async () => {
    const { data, error } = await supabase
      .from('chat_labels')
      .select('*, labels(*)')
      .eq('chat_id', chatId);

    if (error) {
      console.error('Error fetching chat labels:', error);
    } else {
      setChatLabels(data || []);
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('labels')
      .insert([
        {
          name: newLabelName,
          color: newLabelColor,
        }
      ]);

    if (error) {
      console.error('Error creating label:', error);
      setFeedback({ type: 'error', message: 'Failed to create label.' });
    } else {
      setNewLabelName('');
      setFeedback({ type: 'success', message: 'Label created!' });
      fetchLabels();
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAddLabelToChat = async (labelId: string) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('chat_labels')
      .insert([
        {
          chat_id: chatId,
          label_id: labelId
        }
      ]);

    if (error) {
      console.error('Error adding label to chat:', error);
      setFeedback({ type: 'error', message: 'Failed to add label to chat.' });
    } else {
      setFeedback({ type: 'success', message: 'Label added to chat!' });
      fetchChatLabels();
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleRemoveLabelFromChat = async (labelId: string) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('chat_labels')
      .delete()
      .eq('chat_id', chatId)
      .eq('label_id', labelId);

    if (error) {
      console.error('Error removing label from chat:', error);
      setFeedback({ type: 'error', message: 'Failed to remove label from chat.' });
    } else {
      setFeedback({ type: 'success', message: 'Label removed from chat!' });
      fetchChatLabels();
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-gray-600 hover:text-green-600 focus:outline-none"
      >
        <PiTagChevronDuotone className="w-5 h-5" />
        <span>Labels</span>
      </button>

      {isOpen && (
        <aside className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          {!checkedRole ? (
            <div className="text-gray-500 text-sm">Checking permissions...</div>
          ) : !isAdmin ? (
            <div className="text-red-500 text-sm">Only admins can manage labels for this chat.</div>
          ) : (
            <>
              <header className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Create New Label</h3>
            <form onSubmit={handleCreateLabel} className="space-y-2">
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name"
                className="w-full px-2 py-1 text-sm border rounded"
              />
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
                className="w-full h-8"
              />
              <button
                type="submit"
                className="w-full px-2 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
              >
                Create Label
              </button>
                  {feedback && (
                    <div className={`mt-2 text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{feedback.message}</div>
                  )}
            </form>
              </header>
              <section>
            <h3 className="text-sm font-semibold mb-2">Available Labels</h3>
                <ul className="space-y-2">
              {labels.map((label) => {
                const isApplied = chatLabels.some(cl => cl.label_id === label.id);
                return (
                      <li
                    key={label.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm">{label.name}</span>
                    </div>
                    <button
                      onClick={() => isApplied ? handleRemoveLabelFromChat(label.id) : handleAddLabelToChat(label.id)}
                      className={`text-sm px-2 py-1 rounded ${
                        isApplied
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {isApplied ? 'Remove' : 'Add'}
                    </button>
                      </li>
                );
              })}
                </ul>
              </section>
            </>
          )}
        </aside>
      )}
    </div>
  );
} 