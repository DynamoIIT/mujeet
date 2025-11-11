import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  accent_color: string;
}

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
}

export default function ProfileSettingsModal({ open, onOpenChange, profile }: ProfileSettingsModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || "");
  const [accentColor, setAccentColor] = useState(profile.accent_color);
  const [lightingColor, setLightingColor] = useState((profile as any).lighting_color || profile.accent_color);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [bannerPreview, setBannerPreview] = useState<string | null>(profile.banner_url);
  const { toast } = useToast();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, bucket: string, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error(`Error uploading to ${bucket}:`, error);
      return null;
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      let newAvatarUrl = profile.avatar_url;
      let newBannerUrl = profile.banner_url;

      // Upload avatar if changed
      if (avatarFile) {
        const url = await uploadFile(avatarFile, 'avatars', profile.id);
        if (url) newAvatarUrl = url;
      }

      // Upload banner if changed
      if (bannerFile) {
        const url = await uploadFile(bannerFile, 'banners', profile.id);
        if (url) newBannerUrl = url;
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          bio: bio.trim() || null,
          accent_color: accentColor,
          lighting_color: lightingColor,
          avatar_url: newAvatarUrl,
          banner_url: newBannerUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your changes have been saved successfully.",
      });

      onOpenChange(false);
      window.location.reload(); // Refresh to show changes
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

  const bannerStyle = bannerPreview
    ? { backgroundImage: `url(${bannerPreview})` }
    : { background: `linear-gradient(135deg, ${accentColor}, ${adjustColor(accentColor, -30)})` };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Banner Upload */}
          <div>
            <Label>Profile Banner</Label>
            <div 
              className="mt-2 h-32 rounded-lg bg-cover bg-center relative group cursor-pointer"
              style={bannerStyle}
              onClick={() => document.getElementById('banner-upload')?.click()}
            >
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <Upload className="h-8 w-8 text-white" />
              </div>
            </div>
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              className="hidden"
            />
            {bannerPreview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBannerPreview(null);
                  setBannerFile(null);
                }}
                className="mt-2"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Banner
              </Button>
            )}
          </div>

          {/* Avatar Upload */}
          <div>
            <Label>Avatar</Label>
            <div className="mt-2 flex items-center gap-4">
              <div 
                className="relative group cursor-pointer"
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div className="text-sm text-muted-foreground">
                <p>Recommended: Square image, at least 256x256px</p>
                <p>Max size: 5MB</p>
              </div>
            </div>
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
            />
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={190}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {bio.length}/190 characters
            </p>
          </div>

          {/* Accent Color */}
          <div>
            <Label htmlFor="accent-color">Accent Color</Label>
            <div className="flex items-center gap-3 mt-2">
              <input
                id="accent-color"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-20 rounded cursor-pointer"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                maxLength={7}
                className="flex-1"
              />
            </div>
          </div>

          {/* Profile Lighting */}
          <div>
            <Label htmlFor="lighting-color">Profile Glow/Lighting</Label>
            <div className="flex items-center gap-3 mt-2">
              <input
                id="lighting-color"
                type="color"
                value={lightingColor}
                onChange={(e) => setLightingColor(e.target.value)}
                className="h-10 w-20 rounded cursor-pointer"
              />
              <Input
                value={lightingColor}
                onChange={(e) => setLightingColor(e.target.value)}
                maxLength={7}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Custom glow effect for your profile card
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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

function adjustColor(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
