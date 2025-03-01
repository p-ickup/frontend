"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import SimpleRedirectButton from "./SimpleRedirectButton";
import Image from "next/image";

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
    <header className="flex justify-between items-center p-2 bg-gradient-to-r from-teal-500 to-yellow-100 text-white">
      
      <h1 className="text-xl font-bold">
        <SimpleRedirectButton label="P-ickup" route="/home" />
      </h1>
      <nav className="flex space-x-4">
        <SimpleRedirectButton label="Questionnaire" route="/questionnaire" />
        <SimpleRedirectButton label="Results" route="/results" />
      </nav>
      
      <div>
        {user ? (
            // TODO: If the user is logged in, show the profile image and handle logout
            <div onClick={handleLogout} className="cursor-pointer">
                <Image
                src="/images/profileIcon.webp" // Path to your PNG file
                alt="Profile Image"
                width={100} // Resize as needed
                height={100} // Resize as needed
                className="object-contain" // Maintains aspect ratio
                />
            </div>
            ) : (
            // If the user is not logged in, show the login image and handle login
            <div onClick={handleLogin} className="cursor-pointer">
                <Image
                src="/images/profileIcon.webp" // Path to your PNG file
                alt="Login Image"
                width={100} // Resize as needed
                height={100} // Resize as needed
                className="object-contain" // Maintains aspect ratio
                />
            </div>
        )}
      </div>
        
    </header>
  );
}
