import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Crown } from "lucide-react";
import ProfileSettingsModal from "./ProfileSettingsModal";

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  status: string;
  accent_color: string;
  badges: string[] | null;
}

interface UserProfileModalProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwnProfile?: boolean;
}

export default function UserProfileModal({ profile, open, onOpenChange, isOwnProfile }: UserProfileModalProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!profile) return null;

  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})` }
    : { background: `linear-gradient(135deg, ${profile.accent_color}, ${adjustColor(profile.accent_color, -30)})` };

  const statusColor = {
    online: 'bg-status-online',
    away: 'bg-status-away',
    busy: 'bg-status-busy',
    offline: 'bg-status-offline'
  }[profile.status] || 'bg-status-offline';

  const lightingColor = (profile as any).lighting_color || profile.accent_color;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden glass-strong">
          {/* Banner */}
          <div 
            className="h-32 bg-cover bg-center relative"
            style={bannerStyle}
          >
            {isOwnProfile && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-4 right-4"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>

          {/* Profile Content */}
          <div className="px-6 pb-6 -mt-16">
            {/* Avatar with Glow */}
            <div className="relative inline-block">
              <div 
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{ 
                  background: `radial-gradient(circle, ${lightingColor}, transparent)`,
                  transform: 'scale(1.2)',
                  zIndex: 0
                }}
              />
              <Avatar className="h-28 w-28 border-8 border-card relative z-10">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-2 right-2 h-6 w-6 rounded-full ${statusColor} border-4 border-card z-10`} />
            </div>

            {/* Username and Badges */}
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{profile.username}</h2>
                {profile.badges && profile.badges.length > 0 && (
                  <div className="flex gap-1">
                    {profile.badges.includes('nitro') && (
                      <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500">
                        <Crown className="h-3 w-3 mr-1" />
                        Nitro
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="mt-4 p-4 bg-secondary rounded-lg">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">About Me</h3>
                <p className="text-sm">{profile.bio}</p>
              </div>
            )}

            {/* Member Since */}
            <div className="mt-4 p-4 bg-secondary rounded-lg">
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Member Since</h3>
              <p className="text-sm">ChatterBox User</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isOwnProfile && (
        <ProfileSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          profile={profile}
        />
      )}
    </>
  );
}

function adjustColor(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
