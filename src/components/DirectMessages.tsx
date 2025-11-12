import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Check, X, MessageSquare } from "lucide-react";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  sender?: Friend;
  receiver?: Friend;
}

interface DirectMessagesProps {
  onOpenDM: (friendId: string) => void;
}

export default function DirectMessages({ onOpenDM }: DirectMessagesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentUser();
    loadFriends();
    loadFriendRequests();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

    if (friendships) {
      const friendIds = friendships.map(f => 
        f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);

      if (profiles) setFriends(profiles);
    }
  };

  const loadFriendRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Pending requests received
    const { data: pending } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');

    if (pending) {
      const senderIds = pending.map(r => r.sender_id);
      const { data: senders } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds);

      setPendingRequests(pending.map(req => ({
        ...req,
        sender: senders?.find(s => s.id === req.sender_id)
      })));
    }

    // Sent requests
    const { data: sent } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', user.id)
      .eq('status', 'pending');

    if (sent) {
      const receiverIds = sent.map(r => r.receiver_id);
      const { data: receivers } = await supabase
        .from('profiles')
        .select('*')
        .in('id', receiverIds);

      setSentRequests(sent.map(req => ({
        ...req,
        receiver: receivers?.find(r => r.id === req.receiver_id)
      })));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', currentUserId)
      .limit(10);

    setSearchResults(data || []);
    
    if (!data || data.length === 0) {
      toast({
        title: "No user found",
        description: "User doesn't exist or you can't add yourself.",
        variant: "destructive",
      });
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: currentUserId,
          receiver_id: receiverId,
        });

      if (error) throw error;

      toast({
        title: "Friend request sent!",
        description: "Wait for them to accept your request.",
      });

      loadFriendRequests();
      setSearchResults([]);
      setSearchQuery("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFriendRequest = async (requestId: string, accept: boolean) => {
    try {
      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) return;

      if (accept) {
        // Update request status
        await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        // Create friendship
        const [userId1, userId2] = [request.sender_id, request.receiver_id].sort();
        await supabase
          .from('friendships')
          .insert({
            user_id_1: userId1,
            user_id_2: userId2,
          });

        toast({
          title: "Friend request accepted!",
          description: "You are now friends.",
        });
      } else {
        await supabase
          .from('friend_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId);

        toast({
          title: "Friend request declined",
        });
      }

      loadFriends();
      loadFriendRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const statusColor = (status: string) => ({
    online: 'bg-status-online',
    idle: 'bg-status-idle',
    busy: 'bg-status-busy',
    offline: 'bg-status-offline',
    invisible: 'bg-status-offline'
  }[status] || 'bg-status-offline');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 glass rounded-lg p-2">
            {searchResults.map(user => (
              <div key={user.id} className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.username}</span>
                </div>
                <Button size="sm" onClick={() => sendFriendRequest(user.id)}>
                  Add Friend
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="friends" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="friends" className="flex-1">
            Friends {friends.length > 0 && <Badge className="ml-2">{friends.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex-1">
            Pending {pendingRequests.length > 0 && <Badge className="ml-2">{pendingRequests.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="flex-1">
          <ScrollArea className="h-full">
            {friends.map(friend => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onOpenDM(friend.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback>{friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ${statusColor(friend.status)} border-2 border-background`} />
                  </div>
                  <span className="font-medium">{friend.username}</span>
                </div>
                <Button size="sm" variant="ghost">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {friends.length === 0 && (
              <div className="text-center text-muted-foreground p-8">
                No friends yet. Search for users to add!
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pending" className="flex-1">
          <ScrollArea className="h-full">
            {pendingRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.sender?.avatar_url || undefined} />
                    <AvatarFallback>{request.sender?.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{request.sender?.username}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleFriendRequest(request.id, true)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleFriendRequest(request.id, false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {sentRequests.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-muted-foreground px-3 mb-2">Sent Requests</h3>
                {sentRequests.map(request => (
                  <div key={request.id} className="flex items-center justify-between p-3 opacity-60">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.receiver?.avatar_url || undefined} />
                        <AvatarFallback>{request.receiver?.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{request.receiver?.username}</span>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div className="text-center text-muted-foreground p-8">
                No pending friend requests
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
