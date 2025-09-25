// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yggwshfvclejhqcqdfqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZ3dzaGZ2Y2xlamhxY3FkZnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzcxMTIsImV4cCI6MjA3Mzk1MzExMn0.pWZlHdC6Seyj8vlLlLHGpDazAaZQwSB1EPif08APjTU'

export const supabase = createClient(supabaseUrl, supabaseKey)
