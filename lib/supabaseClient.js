// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rfanfswklaqqvsyljjtx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmYW5mc3drbGFxcXZzeWxqanR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODY0ODMsImV4cCI6MjA3NDY2MjQ4M30.nvyW6VqgNQlHFNSxlaca1VmxJm2SIWoI8n725GeqpSY'

export const supabase = createClient(supabaseUrl, supabaseKey)
