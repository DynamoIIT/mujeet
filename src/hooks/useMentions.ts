import { supabase } from "@/integrations/supabase/client";

export const useMentions = () => {
  const detectMentions = (content: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);
    return matches ? matches.map(m => m.substring(1)) : [];
  };

  const createMentions = async (
    messageId: string,
    channelId: string,
    content: string
  ) => {
    const usernames = detectMentions(content);
    if (usernames.length === 0) return;

    // Get user IDs from usernames
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', usernames);

    if (!profiles || profiles.length === 0) return;

    // Create mention records
    const mentions = profiles.map(profile => ({
      message_id: messageId,
      mentioned_user_id: profile.id,
      channel_id: channelId,
    }));

    await supabase.from('mentions').insert(mentions);

    // Update unread messages with mention flag
    for (const profile of profiles) {
      const { data: existing } = await supabase
        .from('unread_messages')
        .select('*')
        .eq('user_id', profile.id)
        .eq('channel_id', channelId)
        .single();

      if (existing) {
        await supabase
          .from('unread_messages')
          .update({ 
            has_mention: true,
            unread_count: existing.unread_count + 1 
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('unread_messages')
          .insert({
            user_id: profile.id,
            channel_id: channelId,
            has_mention: true,
            unread_count: 1,
          });
      }
    }
  };

  return { detectMentions, createMentions };
};
