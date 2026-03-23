import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getChatbot, type Chatbot } from '@/api/chatbots';
import { listDocuments, uploadPdf, submitUrl, type Document } from '@/api/ingestion';
import { sendMessage, getConversations, getConversation, deleteConversation, type Conversation, type Message } from '@/api/chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Upload, Globe, Send, Plus, Trash2, Loader2, Code, FileText, Copy, Check } from 'lucide-react';

export default function ChatbotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bot, setBot] = useState<Chatbot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getChatbot(id)
      .then(setBot)
      .catch(() => navigate('/chatbots'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!bot) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="link" className="px-0 mb-2 text-muted-foreground" onClick={() => navigate('/chatbots')}>
          <ArrowLeft className="mr-1 h-3 w-3" /> Back to chatbots
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{bot.name}</h1>
        {bot.description && <p className="text-muted-foreground mt-1">{bot.description}</p>}
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents"><FileText className="mr-1.5 h-3.5 w-3.5" />Documents</TabsTrigger>
          <TabsTrigger value="chat"><Send className="mr-1.5 h-3.5 w-3.5" />Chat</TabsTrigger>
          <TabsTrigger value="embed"><Code className="mr-1.5 h-3.5 w-3.5" />Embed</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="mt-6"><DocumentsTab chatbotId={bot.id} /></TabsContent>
        <TabsContent value="chat" className="mt-6"><ChatTab chatbotId={bot.id} /></TabsContent>
        <TabsContent value="embed" className="mt-6"><EmbedTab publicToken={bot.publicToken} /></TabsContent>
      </Tabs>
    </div>
  );
}

function DocumentsTab({ chatbotId }: { chatbotId: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [submittingUrl, setSubmittingUrl] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    listDocuments(chatbotId).then(setDocs).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [chatbotId]);

  const handleFileUpload = async (file: File) => {
    setError('');
    setUploading(true);
    try { await uploadPdf(chatbotId, file); load(); }
    catch (err: any) { setError(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleUrlSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setError('');
    setSubmittingUrl(true);
    try { await submitUrl(chatbotId, urlInput.trim()); setUrlInput(''); load(); }
    catch (err: any) { const msg = err.response?.data?.message; setError(Array.isArray(msg) ? msg[0] : msg || 'Failed'); }
    finally { setSubmittingUrl(false); }
  };

  const statusVariant = (s: Document['status']): 'default' | 'destructive' | 'secondary' =>
    s === 'COMPLETED' ? 'default' : s === 'FAILED' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Upload PDF</CardTitle></CardHeader>
          <CardContent>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : 'Click to select PDF (max 20 MB)'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Add Website URL</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleUrlSubmit} className="space-y-3">
              <Input type="url" required placeholder="https://example.com/docs" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
              <Button type="submit" className="w-full" disabled={submittingUrl}>
                {submittingUrl ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Submit URL'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents {!loading && `(${docs.length})`}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No documents yet.</p>
          ) : (
            <div className="divide-y">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.type === 'PDF' ? doc.fileName : doc.sourceUrl}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.type} &middot; {new Date(doc.createdAt).toLocaleString()}</p>
                    {doc.error && <p className="text-xs text-destructive mt-0.5 truncate">{doc.error}</p>}
                  </div>
                  <Badge variant={statusVariant(doc.status)} className="ml-4">{doc.status.toLowerCase()}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChatTab({ chatbotId }: { chatbotId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    getConversations(chatbotId).then(setConversations).catch(() => {}).finally(() => setLoadingConv(false));
  };
  useEffect(loadConversations, [chatbotId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try { const conv = await getConversation(convId); setMessages(conv.messages); } catch { setMessages([]); }
  };

  const startNewChat = () => { setActiveConvId(null); setMessages([]); };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, role: 'USER', content: text, createdAt: new Date().toISOString() }]);
    setInput('');
    setSending(true);
    try {
      const res = await sendMessage(chatbotId, text, activeConvId ?? undefined);
      if (!activeConvId) { setActiveConvId(res.conversationId); loadConversations(); }
      setMessages((prev) => [...prev, { id: res.message.id, role: 'ASSISTANT', content: res.message.content, createdAt: res.message.createdAt }]);
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'ASSISTANT', content: 'Sorry, something went wrong.', createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-18rem)]">
      <Card className="w-56 shrink-0 flex flex-col">
        <CardContent className="p-3 border-b">
          <Button size="sm" className="w-full" onClick={startNewChat}><Plus className="mr-1 h-3 w-3" />New Chat</Button>
        </CardContent>
        <ScrollArea className="flex-1">
          {loadingConv ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No conversations</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-xs border-b group ${activeConvId === conv.id ? 'bg-primary/5 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                <span className="truncate flex-1">{conv.title || 'Untitled'}</span>
                <Button
                  variant="ghost" size="sm" mode="icon"
                  className="opacity-0 group-hover:opacity-100 h-5 w-5"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id).then(() => { setConversations((p) => p.filter((c) => c.id !== conv.id)); if (activeConvId === conv.id) startNewChat(); }); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-sm text-muted-foreground">Send a message to start chatting.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'USER' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <form onSubmit={handleSend} className="border-t p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message..." disabled={sending} className="flex-1" />
          <Button type="submit" disabled={sending || !input.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </Card>
    </div>
  );
}

function EmbedTab({ publicToken }: { publicToken: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${window.location.origin}/api/widget/script" data-token="${publicToken}" data-host="${window.location.origin}" defer><\/script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Code className="h-4 w-4" />Embed Widget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Add this script tag to any website to embed the chatbot as a floating widget.</p>
          <div className="relative group">
            <pre className="bg-muted rounded-lg p-4 text-sm font-mono text-foreground whitespace-pre-wrap break-all overflow-x-auto">{snippet}</pre>
            <Button
              variant="outline" size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
            >
              {copied ? <><Check className="mr-1 h-3 w-3" />Copied</> : <><Copy className="mr-1 h-3 w-3" />Copy</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y text-sm">
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Public token</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{publicToken}</code>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">data-color</span>
              <span>Hex color for widget theme (default: #2563eb)</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">data-host</span>
              <span>Backend URL (auto-detected if same origin)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
