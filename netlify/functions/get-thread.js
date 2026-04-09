import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler = async (event) => {
  try {
    const id = event.queryStringParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing id' })
      };
    }

    const { data, error } = await supabase
      .from('threads')
      .select('id, title, tag, author, content, created_at')
      .eq('id', id)
      .maybeSingle(); // single row [web:209][web:215]

    if (error) {
      console.error('get-thread error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Failed to load thread' })
      };
    }

    if (!data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Thread not found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, thread: data })
    };
  } catch (err) {
    console.error('get-thread handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Server error' })
    };
  }
};