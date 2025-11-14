import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: {
    id: string;
    name: string;
    icon_url: string | null;
    banner_url: string | null;
  };
  onUpdate: () => void;
}

export function ServerSettingsModal({ isOpen, onClose, server, onUpdate }: ServerSettingsModalProps) {
  const [serverName, setServerName] = useState(server.name);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(server.icon_url);
  const [bannerPreview, setBannerPreview] = useState<string | null>(server.banner_url);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      let iconUrl = server.icon_url;
      let bannerUrl = server.banner_url;

      if (iconFile) {
        iconUrl = await uploadFile(iconFile, "avatars", `server-icons/${server.id}-${Date.now()}`);
      }

      if (bannerFile) {
        bannerUrl = await uploadFile(bannerFile, "banners", `server-banners/${server.id}-${Date.now()}`);
      }

      const { error } = await supabase
        .from("servers")
        .update({
          name: serverName,
          icon_url: iconUrl,
          banner_url: bannerUrl,
        })
        .eq("id", server.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Server settings updated successfully.",
      });
      onUpdate();
      onClose();
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Server Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Server Name</Label>
            <Input
              id="server-name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Server Icon</Label>
            <div className="flex items-center gap-4">
              {iconPreview && (
                <div className="relative">
                  <img src={iconPreview} alt="Icon preview" className="w-16 h-16 rounded-full object-cover" />
                  <button
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

          <div className="space-y-2">
            <Label>Server Banner</Label>
            <div className="space-y-2">
              {bannerPreview && (
                <div className="relative">
                  <img src={bannerPreview} alt="Banner preview" className="w-full h-32 rounded-md object-cover" />
                  <button
                    onClick={() => {
                      setBannerFile(null);
                      setBannerPreview(null);
                    }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="hidden"
                  disabled={isLoading}
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Upload Banner</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
