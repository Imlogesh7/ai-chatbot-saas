import client from './client';

export interface Chatbot {
  id: string;
  name: string;
  description?: string;
  publicToken: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export async function listChatbots(): Promise<Chatbot[]> {
  const res = await client.get<Chatbot[]>('/chatbots');
  return res.data;
}

export async function getChatbot(id: string): Promise<Chatbot> {
  const res = await client.get<Chatbot>(`/chatbots/${id}`);
  return res.data;
}

export async function createChatbot(data: { name: string; description?: string }): Promise<Chatbot> {
  const res = await client.post<Chatbot>('/chatbots', data);
  return res.data;
}

export async function deleteChatbot(id: string): Promise<void> {
  await client.delete(`/chatbots/${id}`);
}
