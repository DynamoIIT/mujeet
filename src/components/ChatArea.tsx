import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash } from "lucide-react";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import { useMentions } from "@/hooks/useMentions";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  has_mention?: boolean;
}

interface Channel {
  id: string;
  name: string;
}

interface ChatAreaProps {
  channelId: string | null;
  userId: string;
}

export default function ChatArea({ channelId, userId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { createMentions } = useMentions();

  useEffect(() => {
    loadCurrentUsername();
  }, [userId]);

  const loadCurrentUsername = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (data) setCurrentUsername(data.username);
  };

  useEffect(() => {
    if (!channelId) return;

    fetchChannel();
    fetchMessages();

    const messageChannel = supabase
      .channel(`messages-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (data && !error) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', data.user_id)
              .single();

            if (profile) {
              setMessages((prev) => [...prev, { ...data, profiles: profile }]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [channelId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchChannel = async () => {
    if (!channelId) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (error) throw error;
      setChannel(data);
    } catch (error) {
      console.error('Error fetching channel:', error);
    }
  };

  const fetchMessages = async () => {
    if (!channelId) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (messagesData) {
        const messagesWithProfiles = await Promise.all(
          messagesData.map(async (message) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', message.user_id)
              .single();

            return {
              ...message,
              profiles: profile || { username: 'Unknown', avatar_url: null },
            };
          })
        );

        setMessages(messagesWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!channelId || !content.trim()) return;

    try {
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Create mentions if any
      if (newMessage) {
        await createMentions(newMessage.id, channelId, content);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (!channelId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-bg">
        <div className="text-center">
          <Hash className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-chat-bg">
      <div className="h-12 px-4 flex items-center border-b border-border shadow-sm bg-card">
        <Hash className="h-5 w-5 text-muted-foreground mr-2" />
        <span className="font-semibold">{channel?.name || 'Channel'}</span>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            const isMentioned = message.content.includes(`@${currentUsername}`);
            return (
              <div
                key={message.id}
                className={isMentioned ? 'bg-destructive/10 border-l-4 border-destructive rounded-lg -ml-2 pl-2' : ''}
              >
                <MessageBubble
                  message={message}
                  isOwnMessage={message.user_id === userId}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
}
