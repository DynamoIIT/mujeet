import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Hash, LogOut, User, MessageSquare, Settings, Search } from "lucide-react";
import DirectMessages from "./DirectMessages";
import DMChat from "./DMChat";
import StatusSelector from "./StatusSelector";
import NotificationBell from "./NotificationBell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import CreateServerDialog from "./CreateServerDialog";
import ServerSearchDialog from "./ServerSearchDialog";
import UserProfileModal from "./UserProfileModal";
import { ServerSettingsModal } from "./ServerSettingsModal";
import { useNavigate } from "react-router-dom";

interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  owner_id: string;
  unread_count?: number;
  has_mention?: boolean;
}

interface ServerSidebarProps {
  userId: string;
  selectedServerId: string | null;
  onSelectServer: (serverId: string) => void;
}

export default function ServerSidebar({ userId, selectedServerId, onSelectServer }: ServerSidebarProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showDMs, setShowDMs] = useState(false);
  const [activeDMFriend, setActiveDMFriend] = useState<string | null>(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [selectedServerForSettings, setSelectedServerForSettings] = useState<Server | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchServers();
    fetchUserProfile();
    loadUnreadCounts();

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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchServers = async () => {
    try {
      // Fetch servers where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('server_members')
        .select('server_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setServers([]);
        return;
      }

      const serverIds = memberData.map(m => m.server_id);

      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .in('id', serverIds)
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

  const loadUnreadCounts = async () => {
    const { data } = await supabase
      .from('unread_messages')
      .select('channel_id, unread_count, has_mention')
      .eq('user_id', userId);

    if (data) {
      // Update servers with unread counts
      setServers(prevServers => 
        prevServers.map(server => {
          const serverUnreads = data.filter(u => 
            // This would need to check if channel belongs to this server
            true // Placeholder - needs proper server-channel mapping
          );
          return {
            ...server,
            unread_count: serverUnreads.reduce((sum, u) => sum + u.unread_count, 0),
            has_mention: serverUnreads.some(u => u.has_mention)
          };
        })
      );
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
      {/* DM Interface - Full width on mobile */}
      {showDMs && !activeDMFriend && (
        <div className="fixed md:static inset-0 z-50 md:z-auto flex-1 flex flex-col bg-background md:ml-16">
          <DirectMessages 
            onOpenDM={(friendId) => setActiveDMFriend(friendId)}
            onBack={() => setShowDMs(false)}
          />
        </div>
      )}
      
      {showDMs && activeDMFriend && (
        <div className="fixed md:static inset-0 z-50 md:z-auto flex-1 flex flex-col bg-background md:ml-16">
          <DMChat 
            friendId={activeDMFriend}
            onBack={() => setActiveDMFriend(null)}
          />
        </div>
      )}

      <div className={`w-16 bg-sidebar flex flex-col items-center py-3 space-y-2 border-r border-sidebar-border ${showDMs ? 'hidden md:flex' : ''}`}>
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center space-y-2 px-2">
            {/* DM Button */}
            <button
              onClick={() => {
                setShowDMs(true);
                onSelectServer('');
              }}
              className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:rounded-xl ${
                showDMs
                  ? 'bg-primary rounded-xl'
                  : 'bg-secondary hover:bg-chat-server-hover'
              }`}
            >
              <MessageSquare className="h-6 w-6 text-foreground" />
              <div className={`absolute left-0 w-1 bg-foreground rounded-r transition-all group-hover:h-5 ${
                showDMs ? 'h-10' : 'h-0'
              }`} />
            </button>
            
            <div className="w-8 h-px bg-sidebar-border my-1" />
            
            {servers.map((server) => (
              <div key={server.id} className="relative group">
                <button
                  onClick={() => {
                    setShowDMs(false);
                    setActiveDMFriend(null);
                    onSelectServer(server.id);
                  }}
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
                  <div className={`absolute left-0 w-1 bg-foreground rounded-r transition-all group-hover:h-5 ${
                    selectedServerId === server.id ? 'h-10' : 'h-0'
                  }`} />
                  
                  {/* Unread Indicator */}
                  {server.unread_count && server.unread_count > 0 && (
                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-sidebar flex items-center justify-center ${
                      server.has_mention ? 'bg-destructive' : 'bg-muted-foreground'
                    }`}>
                      {server.has_mention && (
                        <span className="text-[8px] text-destructive-foreground font-bold">@</span>
                      )}
                    </div>
                  )}
                </button>
                {server.owner_id === userId && (
                  <button
                    onClick={() => {
                      setSelectedServerForSettings(server);
                      setShowServerSettings(true);
                    }}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary border-2 border-sidebar flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Server Settings"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="border-t border-sidebar-border pt-2 w-full flex flex-col items-center space-y-2 px-2">
          {/* Notification Bell */}
          <NotificationBell />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(true)}
            className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-secondary transition-all"
            title="Search Servers"
          >
            <Search className="h-6 w-6" />
          </Button>
          
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
            <StatusSelector 
              currentStatus={userProfile?.status || 'offline'} 
              onStatusChange={fetchUserProfile}
            />
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

      <ServerSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        userId={userId}
        onServerJoined={(serverId) => {
          fetchServers();
          onSelectServer(serverId);
        }}
      />

      <UserProfileModal
        profile={userProfile}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        isOwnProfile={true}
      />

      {selectedServerForSettings && (
        <ServerSettingsModal
          isOpen={showServerSettings}
          onClose={() => {
            setShowServerSettings(false);
            setSelectedServerForSettings(null);
          }}
          server={selectedServerForSettings}
          onUpdate={() => {
            fetchServers();
          }}
        />
      )}
    </>
  );
}
