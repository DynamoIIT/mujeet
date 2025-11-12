import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: 'friend_request' | 'mention' | 'message';
  content: string;
  created_at: string;
  read: boolean;
  sender?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadNotifications();
    
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
        },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load friend requests
    const { data: requests } = await supabase
      .from('friend_requests')
      .select('id, sender_id, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');

    if (requests) {
      const senderIds = requests.map(r => r.sender_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds);

      const notifs: Notification[] = requests.map(req => ({
        id: req.id,
        type: 'friend_request',
        content: 'sent you a friend request',
        created_at: req.created_at,
        read: false,
        sender: profiles?.find(p => p.id === req.sender_id)
      }));

      setNotifications(notifs);
      setUnreadCount(notifs.length);
    }
  };

  const markAsRead = () => {
    setUnreadCount(0);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-chat-server-hover transition-all"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 glass" align="end">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No new notifications
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className="p-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{notif.sender?.username}</span>{' '}
                        {notif.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
