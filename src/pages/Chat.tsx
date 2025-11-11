import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ServerSidebar from "@/components/ServerSidebar";
import ChannelList from "@/components/ChannelList";
import ChatArea from "@/components/ChatArea";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        updateUserStatus(session.user.id, 'online');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        if (event === 'SIGNED_IN') {
          updateUserStatus(session.user.id, 'online');
        }
      }
    });

    // Update status to offline on unmount
    return () => {
      subscription.unsubscribe();
      if (user) {
        updateUserStatus(user.id, 'offline');
      }
    };
  }, [navigate]);

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ServerSidebar 
        userId={user.id} 
        selectedServerId={selectedServerId}
        onSelectServer={setSelectedServerId}
      />
      <ChannelList 
        serverId={selectedServerId}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
      />
      <ChatArea 
        channelId={selectedChannelId}
        userId={user.id}
      />
    </div>
  );
}
