import client from './client';

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title?: string;
  chatbotId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'ASSISTANT';
    content: string;
    createdAt: string;
  };
  contextUsed: number;
}

export async function sendMessage(
  chatbotId: string,
  message: string,
  conversationId?: string,
): Promise<ChatResponse> {
  const res = await client.post<ChatResponse>('/chat/message', {
    chatbotId,
    message,
    conversationId,
  });
  return res.data;
}

export async function getConversations(chatbotId: string): Promise<Conversation[]> {
  const res = await client.get<Conversation[]>('/chat/conversations', {
    params: { chatbotId },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await client.get<Conversation>(`/chat/conversations/${id}`);
  return res.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await client.delete(`/chat/conversations/${id}`);
}
