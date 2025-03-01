"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import RedirectButton from "./RedirectButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PickupHeader() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check auth state
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };

    fetchUser();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Login function
  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google", // You can change to "github", "facebook", etc.
    });
    if (error) console.error("Login error:", error);
  };

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <header className="flex justify-between items-center p-4 bg-gradient-to-r from-teal-500 to-yellow-100 text-white">
      <h1 className="text-xl font-bold">P-ickup</h1>
      <nav>
        <RedirectButton label="Questionnaire" route="/questionnaire" />
        <RedirectButton label="Results" route="/results" />

        {user ? (
          <Button onClick={handleLogout} className="bg-red-500">
            Logout
          </Button>
        ) : (
          <Button onClick={handleLogin} className="bg-green-500">
            Login
          </Button>
        )}
      </nav>
    </header>
  );
}
