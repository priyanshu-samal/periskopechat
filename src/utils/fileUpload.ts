import { supabase } from './supabaseClient';

export type FileType = 'image' | 'video' | 'document' | 'audio';

export interface UploadedFile {
  url: string;
  type: FileType;
  name: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'];

export function getFileType(mimeType: string): FileType | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return 'document';
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
  return null;
}

export async function uploadFile(file: File, chatId: string): Promise<UploadedFile | null> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Validate file type
    const fileType = getFileType(file.type);
    if (!fileType) {
      throw new Error('Unsupported file type');
    }

    // Generate a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `chats/${chatId}/${fileName}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      type: fileType,
      name: file.name
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export function getFileIcon(type: FileType): string {
  switch (type) {
    case 'image':
      return '🖼️';
    case 'video':
      return '🎥';
    case 'document':
      return '📄';
    case 'audio':
      return '🎵';
    default:
      return '📎';
  }
} 