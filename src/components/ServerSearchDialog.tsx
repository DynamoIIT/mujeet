import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
}

interface ServerSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onServerJoined: (serverId: string) => void;
}

export default function ServerSearchDialog({ 
  open, 
  onOpenChange, 
  userId,
  onServerJoined 
}: ServerSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningServer, setJoiningServer] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .order('name');

      if (error) throw error;

      // Filter out servers user is already a member of
      const { data: memberData } = await supabase
        .from('server_members')
        .select('server_id')
        .eq('user_id', userId);

      const memberServerIds = new Set(memberData?.map(m => m.server_id) || []);
      const filteredResults = data?.filter(s => !memberServerIds.has(s.id) && s.owner_id !== userId) || [];

      setSearchResults(filteredResults);

      if (filteredResults.length === 0) {
        toast({
          title: "No servers found",
          description: "No servers match your search or you're already a member.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinServer = async (serverId: string) => {
    setJoiningServer(serverId);
    try {
      const { error } = await supabase
        .from('server_members')
        .insert({
          server_id: serverId,
          user_id: userId,
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You've joined the server.",
      });

      onServerJoined(serverId);
      onOpenChange(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setJoiningServer(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search Servers</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2">
          <Input
            placeholder="Search server name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading} size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {searchResults.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={server.icon_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {server.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{server.name}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleJoinServer(server.id)}
                  disabled={joiningServer === server.id}
                  size="sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Join
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {searchResults.length === 0 && searchQuery && !loading && (
          <p className="text-center text-muted-foreground py-8">
            No servers found. Try a different search term.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
