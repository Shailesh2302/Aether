import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Upload, Search, MessageSquare, Video, Scissors } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI-Powered Content Platform</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Your Content,{" "}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Intelligently Managed
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Upload, search, and interact with your files using natural language. 
              Powered by advanced AI for seamless content management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
            <p className="text-muted-foreground">Everything you need to manage your content</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border bg-card">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Upload</h3>
              <p className="text-muted-foreground">
                Drag and drop files with automatic processing and thumbnail generation.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border bg-card">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Semantic Search</h3>
              <p className="text-muted-foreground">
                Find content instantly using natural language queries across all your files.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border bg-card">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Chat</h3>
              <p className="text-muted-foreground">
                Interact with your files through conversational AI that understands your content.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border bg-card">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Video Player</h3>
              <p className="text-muted-foreground">
                Stream videos with advanced controls and timestamp navigation.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border bg-card">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Scissors className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Clip Generation</h3>
              <p className="text-muted-foreground">
                Create and save clips from videos at specific timestamps.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border bg-card">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Organization</h3>
              <p className="text-muted-foreground">
                Automatic categorization and tagging of your content.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of users who have transformed their content management with AI.
            </p>
            <Button asChild size="lg">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}