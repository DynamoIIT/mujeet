import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { useMentions } from "@/hooks/useMentions";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface DMChatProps {
  friendId: string;
  onBack: () => void;
}

export default function DMChat({ friendId, onBack }: DMChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [friend, setFriend] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { createMentions } = useMentions();

  useEffect(() => {
    loadCurrentUser();
    loadFriend();
    setupDMChannel();
  }, [friendId]);

  useEffect(() => {
    if (dmChannelId) {
      loadMessages();
      subscribeToMessages();
      subscribeToTyping();
    }
  }, [dmChannelId]);

  const subscribeToTyping = () => {
    if (!dmChannelId) return;

    const channel = supabase.channel(`typing:${dmChannelId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typingUsers = Object.values(state).flat();
        setIsTyping(typingUsers.some((u: any) => u.user_id !== currentUserId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleTyping = async () => {
    if (!dmChannelId) return;
    
    const channel = supabase.channel(`typing:${dmChannelId}`);
    await channel.track({ user_id: currentUserId, typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      await channel.untrack();
    }, 3000);
  };

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      
      // Load current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (profile) setCurrentUsername(profile.username);
    }
  };

  const loadFriend = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', friendId)
      .single();

    if (data) setFriend(data);
  };

  const setupDMChannel = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [userId1, userId2] = [user.id, friendId].sort();

    // Check if DM channel exists
    let { data: existing } = await supabase
      .from('dm_channels')
      .select('*')
      .eq('user_id_1', userId1)
      .eq('user_id_2', userId2)
      .single();

    if (existing) {
      setDmChannelId(existing.id);
    } else {
      // Create new DM channel
      const { data: newChannel, error } = await supabase
        .from('dm_channels')
        .insert({
          user_id_1: userId1,
          user_id_2: userId2,
        })
        .select()
        .single();

      if (newChannel) setDmChannelId(newChannel.id);
    }
  };

  const loadMessages = async () => {
    if (!dmChannelId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', dmChannelId)
      .order('created_at', { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const messagesWithProfiles = data
        .map(msg => ({
          ...msg,
          profiles: profiles?.find(p => p.id === msg.user_id)
        }))
        .filter(msg => msg.profiles) as Message[];

      setMessages(messagesWithProfiles);
    }
  };

  const subscribeToMessages = () => {
    if (!dmChannelId) return;

    const channel = supabase
      .channel(`dm:${dmChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${dmChannelId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          if (profile) {
            setMessages((prev) => [
              ...prev,
              { ...payload.new, profiles: profile } as Message,
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (content: string) => {
    if (!dmChannelId || !content.trim()) return;

    const { data: newMessage } = await supabase
      .from('messages')
      .insert({
        channel_id: dmChannelId,
        content: content.trim(),
        user_id: currentUserId,
      })
      .select()
      .single();

    // Create mentions if any
    if (newMessage) {
      await createMentions(newMessage.id, dmChannelId, content);
    }
  };

  const statusColor = (status: string) => ({
    online: 'bg-status-online',
    idle: 'bg-status-idle',
    busy: 'bg-status-busy',
    offline: 'bg-status-offline',
    invisible: 'bg-status-offline'
  }[status] || 'bg-status-offline');

  if (!friend) return null;

  return (
    <div className="flex flex-col h-full">
      {/* DM Header */}
      <div className="glass border-b border-border p-4 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          ←
        </button>
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={friend.avatar_url || undefined} />
            <AvatarFallback>{friend.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ${statusColor(friend.status)} border-2 border-background`} />
        </div>
        <div>
          <h2 className="font-semibold">{friend.username}</h2>
          <p className="text-xs text-muted-foreground capitalize">{friend.status}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div ref={scrollRef} className="space-y-4">
          {messages.map((message) => {
            const isMentioned = message.content.includes(`@${currentUsername}`);
            return (
              <div
                key={message.id}
                className={isMentioned ? 'bg-destructive/10 border-l-4 border-destructive rounded-lg -ml-2 pl-2' : ''}
              >
                <MessageBubble
                  message={message}
                  isOwnMessage={message.user_id === currentUserId}
                />
              </div>
            );
          })}
          {isTyping && <TypingIndicator username={friend.username} />}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <MessageInput 
        onSendMessage={handleSendMessage} 
        onTyping={handleTyping}
      />
    </div>
  );
}
