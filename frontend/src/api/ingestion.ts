import client from './client';

export interface Document {
  id: string;
  type: 'PDF' | 'WEBSITE';
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName?: string;
  sourceUrl?: string;
  chatbotId: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export async function uploadPdf(chatbotId: string, file: File): Promise<Document> {
  const form = new FormData();
  form.append('file', file);
  form.append('chatbotId', chatbotId);
  const res = await client.post<Document>('/ingestion/pdf', form, {
    headers: { 'Content-Type': 'multipart/form-data', 'ngrok-skip-browser-warning': 'true' },
  });
  return res.data;
}

export async function submitUrl(chatbotId: string, url: string): Promise<Document> {
  const res = await client.post<Document>('/ingestion/website', { chatbotId, url });
  return res.data;
}

export async function listDocuments(chatbotId: string): Promise<Document[]> {
  const res = await client.get<Document[]>(`/ingestion/chatbot/${chatbotId}`);
  return res.data;
}
