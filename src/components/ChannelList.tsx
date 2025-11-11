import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Hash, Plus, ChevronDown, Volume2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import CreateChannelDialog from "./CreateChannelDialog";

interface Channel {
  id: string;
  name: string;
  type: string;
}

interface Server {
  id: string;
  name: string;
}

interface ChannelListProps {
  serverId: string | null;
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
}

export default function ChannelList({ serverId, selectedChannelId, onSelectChannel }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [server, setServer] = useState<Server | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!serverId) return;

    fetchServer();
    fetchChannels();

    const channel = supabase
      .channel('channels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId]);

  const fetchServer = async () => {
    if (!serverId) return;

    try {
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .eq('id', serverId)
        .single();

      if (error) throw error;

      setServer(data);

      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(user?.id === data.owner_id);
    } catch (error) {
      console.error('Error fetching server:', error);
    }
  };

  const fetchChannels = async () => {
    if (!serverId) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setChannels(data || []);
      
      // Auto-select first channel if none selected
      if (data && data.length > 0 && !selectedChannelId) {
        onSelectChannel(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  if (!serverId) {
    return (
      <div className="w-60 bg-card flex items-center justify-center border-r border-border">
        <p className="text-muted-foreground text-sm">Select a server</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-60 bg-card flex flex-col border-r border-border">
        <div className="h-12 px-4 flex items-center border-b border-border shadow-sm">
          <button className="flex items-center justify-between w-full hover:bg-secondary px-2 py-1 rounded transition-colors">
            <span className="font-semibold text-sm truncate">{server?.name || 'Server'}</span>
            <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <div className="flex items-center text-xs font-semibold text-muted-foreground uppercase">
                  <ChevronDown className="h-3 w-3 mr-0.5" />
                  <span>Text Channels</span>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreateOpen(true)}
                    className="h-4 w-4 p-0 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="space-y-0.5">
                {channels.filter(c => c.type === 'text').map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    className={`w-full flex items-center px-2 py-1.5 rounded hover:bg-secondary transition-colors group ${
                      selectedChannelId === channel.id ? 'bg-secondary text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <Hash className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <CreateChannelDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        serverId={serverId}
        onChannelCreated={(channelId) => onSelectChannel(channelId)}
      />
    </>
  );
}
