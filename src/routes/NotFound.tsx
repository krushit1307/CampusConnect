import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";

/**
 * Standard 404 Not Found page.
 * Features a branded illustration, friendly error message, and navigation options.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center">
      <Helmet>
        <title>404 - Page Not Found | CampusConnect</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* 404 SVG Illustration */}
      <div className="mb-8 flex h-64 w-64 items-center justify-center rounded-full bg-muted border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="128"
          height="128"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </div>

      <h1 className="mb-4 font-mono text-6xl font-bold uppercase tracking-tighter md:text-8xl">
        404
      </h1>
      
      <h2 className="mb-4 font-mono text-2xl font-bold uppercase tracking-tight md:text-3xl">
        Page Not Found
      </h2>
      
      <p className="mb-8 max-w-md text-lg text-muted-foreground">
        Oops! The page you're looking for has wandered off. It might have been 
        moved, deleted, or perhaps it never existed in the first place.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button
          asChild
          variant="outline"
          size="lg"
          className="border-2 border-black font-mono uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all dark:border-white dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]"
        >
          <Link to="/">
            <Home className="mr-2 h-5 w-5" />
            Return Home
          </Link>
        </Button>
        
        <Button
          asChild
          size="lg"
          className="font-mono uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Go to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
