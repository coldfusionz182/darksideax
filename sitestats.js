import { SUPABASE_ANON_KEY } from './keys.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadSiteStats() {
    try {
        // 1. Total Threads
        const { count: threadCount } = await supabase
            .from('threads')
            .select('*', { count: 'exact', head: true });

        // 2. Total Posts (Replies)
        const { count: postCount } = await supabase
            .from('thread_replies')
            .select('*', { count: 'exact', head: true });

        // 3. Total Members
        const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // 4. Newest Member
        const { data: newestUser } = await supabase
            .from('users')
            .select('username')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Update DOM
        if (document.getElementById('stats-threads')) 
            document.getElementById('stats-threads').textContent = (threadCount || 0).toLocaleString();
        
        if (document.getElementById('stats-posts')) 
            document.getElementById('stats-posts').textContent = (postCount || 0).toLocaleString();
        
        if (document.getElementById('stats-members')) 
            document.getElementById('stats-members').textContent = (userCount || 0).toLocaleString();
        
        if (document.getElementById('stats-newest-user') && newestUser) 
            document.getElementById('stats-newest-user').textContent = newestUser.username;

    } catch (error) {
        console.error('Error loading site stats:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadSiteStats);
