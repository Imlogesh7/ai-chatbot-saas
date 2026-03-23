import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { listChatbots } from '@/api/chatbots';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Plus, ArrowRight, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [chatbotCount, setChatbotCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listChatbots()
      .then((bots) => setChatbotCount(bots.length))
      .catch(() => setChatbotCount(0))
      .finally(() => setLoading(false));
  }, []);

  const displayName = user?.firstName || user?.email?.split('@')[0] || 'there';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {displayName}</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your workspace.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Chatbots</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold">{chatbotCount}</div>
            )}
            <Button variant="link" className="px-0 mt-2" onClick={() => navigate('/chatbots')}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold">Create a Chatbot</p>
            <CardDescription>Set up a new AI chatbot and start uploading knowledge.</CardDescription>
            <Button onClick={() => navigate('/chatbots', { state: { openCreate: true } })}>
              <Plus className="mr-2 h-4 w-4" />
              New Chatbot
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
