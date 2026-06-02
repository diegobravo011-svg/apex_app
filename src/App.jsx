import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginScreen from './components/LoginScreen'
import Apex from './Apex'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Still checking session
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: '#F0EDE8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 32,
        fontWeight: 300,
        letterSpacing: -1,
        color: '#1A1917',
      }}>
        apex
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return <Apex user={session.user} onSignOut={handleSignOut} />
}
