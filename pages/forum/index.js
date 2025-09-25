// pages/forum/index.js
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function ForumHome() {
  const [cats, setCats] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('forum_categories')
        .select('*')
        .order('position', { ascending: true })
      setCats(data || [])
    }
    load()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Forum</h1>
      <ul>
        {cats.map(c => (
          <li key={c.id} style={{ marginBottom: 8 }}>
            <Link href={`/forum/${c.slug}`} style={{ color: '#2563eb' }}>
              {c.name}
            </Link>
            {c.description ? <div style={{ color:'#666' }}>{c.description}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
