import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StatusSelectorProps {
  currentStatus: string;
  onStatusChange?: () => void;
}

const statuses = [
  { value: 'online', label: 'Online', color: 'bg-status-online', icon: '🟢' },
  { value: 'idle', label: 'Idle', color: 'bg-status-idle', icon: '🟡' },
  { value: 'busy', label: 'Do Not Disturb', color: 'bg-status-busy', icon: '🔴' },
  { value: 'invisible', label: 'Invisible', color: 'bg-status-offline', icon: '⚫' },
];

export default function StatusSelector({ currentStatus, onStatusChange }: StatusSelectorProps) {
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `Your status is now ${statuses.find(s => s.value === newStatus)?.label}`,
      });

      onStatusChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const currentStatusData = statuses.find(s => s.value === currentStatus) || statuses[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <div className={`h-3 w-3 rounded-full ${currentStatusData.color}`} />
          <span className="text-sm">{currentStatusData.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass">
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.value}
            onClick={() => handleStatusChange(status.value)}
            className="gap-2"
          >
            <div className={`h-3 w-3 rounded-full ${status.color}`} />
            {status.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
