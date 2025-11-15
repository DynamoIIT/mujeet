import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onServerCreated: (serverId: string) => void;
}

export default function CreateServerDialog({ open, onOpenChange, userId, onServerCreated }: CreateServerDialogProps) {
  const [serverName, setServerName] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let iconUrl = null;

      // Upload icon if provided
      if (iconFile) {
        const fileName = `server-icons/${userId}-${Date.now()}.${iconFile.name.split('.').pop()}`;
        const { data, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, iconFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(data.path);
        
        iconUrl = publicUrl;
      }

      // Create server
      const { data: server, error: serverError } = await supabase
        .from('servers')
        .insert({
          name: serverName,
          owner_id: userId,
          icon_url: iconUrl,
        })
        .select()
        .single();

      if (serverError) throw serverError;

      // Add owner as member
      const { error: memberError } = await supabase
        .from('server_members')
        .insert({
          server_id: server.id,
          user_id: userId,
        });

      if (memberError) throw memberError;

      // Create default general channel
      const { error: channelError } = await supabase
        .from('channels')
        .insert({
          server_id: server.id,
          name: 'general',
          type: 'text',
        });

      if (channelError) throw channelError;

      toast({
        title: "Server created!",
        description: `${serverName} has been created successfully.`,
      });

      onServerCreated(server.id);
      setServerName("");
      setIconFile(null);
      setIconPreview(null);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Server</DialogTitle>
          <DialogDescription>
            Give your server a name and icon to get started. You can always change it later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateServer} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Server Name</Label>
            <Input
              id="server-name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="My Awesome Server"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Server Icon (Optional)</Label>
            <div className="flex items-center gap-4">
              {iconPreview && (
                <div className="relative">
                  <img src={iconPreview} alt="Icon preview" className="w-16 h-16 rounded-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setIconFile(null);
                      setIconPreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  className="hidden"
                  disabled={isLoading}
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Upload Icon</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Server"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
