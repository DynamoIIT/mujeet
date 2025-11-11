import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "./UserProfileModal";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

export default function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [fullProfile, setFullProfile] = useState<any>(null);

  const handleAvatarClick = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', message.user_id)
        .single();

      if (error) throw error;
      setFullProfile(data);
      setProfileOpen(true);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  return (
    <>
      <div className="flex items-start space-x-3 px-4 py-2 hover:bg-chat-message-hover rounded transition-colors group">
        <Avatar 
          className="h-10 w-10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleAvatarClick}
        >
          <AvatarImage src={message.profiles.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {message.profiles.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span 
              className="font-semibold text-sm text-foreground cursor-pointer hover:underline"
              onClick={handleAvatarClick}
            >
              {message.profiles.username}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground break-words">{message.content}</p>
        </div>
      </div>

      <UserProfileModal
        profile={fullProfile}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        isOwnProfile={isOwnMessage}
      />
    </>
  );
}
