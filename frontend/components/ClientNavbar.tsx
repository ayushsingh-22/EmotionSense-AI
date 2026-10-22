"use client";

import dynamic from "next/dynamic";
import { NavbarSkeleton } from "@/components/NavbarSkeleton";

// Client-only navbar (it reads browser state). Next.js 15+ allows `ssr: false` only inside a Client Component, so the
// dynamic import lives here instead of in the (Server Component) root layout. Same skeleton while the chunk loads.
export const ClientNavbar = dynamic(() => import("@/components/navbar").then((mod) => ({ default: mod.Navbar })), {
  ssr: false,
  loading: () => <NavbarSkeleton />,
});
