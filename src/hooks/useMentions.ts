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

    // Check if @everyone is mentioned
    if (usernames.includes('everyone')) {
      // Get all members of the channel's server
      const { data: channel } = await supabase
        .from('channels')
        .select('server_id')
        .eq('id', channelId)
        .single();

      if (channel) {
        const { data: members } = await supabase
          .from('server_members')
          .select('user_id')
          .eq('server_id', channel.server_id);

        if (members) {
          const mentions = members.map(member => ({
            message_id: messageId,
            mentioned_user_id: member.user_id,
            channel_id: channelId,
          }));

          await supabase.from('mentions').insert(mentions);

          // Update unread messages for all members
          for (const member of members) {
            const { data: existing } = await supabase
              .from('unread_messages')
              .select('*')
              .eq('user_id', member.user_id)
              .eq('channel_id', channelId)
              .maybeSingle();

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
                  user_id: member.user_id,
                  channel_id: channelId,
                  has_mention: true,
                  unread_count: 1,
                });
            }
          }
        }
      }
    }

    // Get user IDs from usernames (excluding 'everyone' as it's already handled)
    const specificUsernames = usernames.filter(u => u !== 'everyone');
    if (specificUsernames.length === 0) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', specificUsernames);

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
        .maybeSingle();

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
