import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Hash, LogOut, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import CreateServerDialog from "./CreateServerDialog";
import UserProfileModal from "./UserProfileModal";
import { useNavigate } from "react-router-dom";

interface Server {
  id: string;
  name: string;
  icon_url: string | null;
}

interface ServerSidebarProps {
  userId: string;
  selectedServerId: string | null;
  onSelectServer: (serverId: string) => void;
}

export default function ServerSidebar({ userId, selectedServerId, onSelectServer }: ServerSidebarProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showDMs, setShowDMs] = useState(false);
  const [activeDMFriend, setActiveDMFriend] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchServers();
    fetchUserProfile();

    const channel = supabase
      .channel('servers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'servers',
        },
        () => {
          fetchServers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setServers(data || []);
      
      // Auto-select first server if none selected
      if (data && data.length > 0 && !selectedServerId) {
        onSelectServer(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="w-18 bg-sidebar flex flex-col items-center py-3 space-y-2 border-r border-sidebar-border">
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center space-y-2 px-2">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => onSelectServer(server.id)}
                className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:rounded-xl ${
                  selectedServerId === server.id
                    ? 'bg-primary rounded-xl'
                    : 'bg-secondary hover:bg-chat-server-hover'
                }`}
              >
                {server.icon_url ? (
                  <img src={server.icon_url} alt={server.name} className="w-full h-full rounded-inherit" />
                ) : (
                  <span className="text-foreground font-semibold text-lg">
                    {server.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="absolute left-0 w-1 h-0 bg-foreground rounded-r transition-all group-hover:h-5 
                  ${selectedServerId === server.id ? 'h-10' : ''}"></div>
              </button>
            ))}
          </div>
        </ScrollArea>
        
        <div className="border-t border-sidebar-border pt-2 w-full flex flex-col items-center space-y-2 px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreateOpen(true)}
            className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-primary transition-all"
          >
            <Plus className="h-6 w-6" />
          </Button>

          {/* User Profile Button */}
          <button
            onClick={() => setProfileOpen(true)}
            className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all relative group"
          >
            <Avatar className="w-full h-full">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 h-4 w-4 bg-status-online rounded-full border-2 border-sidebar" />
          </button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-destructive transition-all"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <CreateServerDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        userId={userId}
        onServerCreated={(serverId) => onSelectServer(serverId)}
      />

      <UserProfileModal
        profile={userProfile}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        isOwnProfile={true}
      />
    </>
  );
}
