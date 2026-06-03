import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Upload,
  Search,
  MessageSquare,
  Video,
  Scissors,
  FileText,
  Brain,
  Clock,
  Check,
  Zap,
  Shield,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Smart Upload",
    description:
      "Drag and drop video, audio, or image files. We handle storage, transcription, and indexing automatically.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description:
      "Find content using natural language. Search across transcripts, topics, and visual context.",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant",
    description:
      "Ask questions about your content. Get answers grounded in your actual files with source citations.",
  },
  {
    icon: Video,
    title: "Built-in Player",
    description:
      "Stream videos with timestamp navigation. Click any moment and jump straight to it.",
  },
  {
    icon: Scissors,
    title: "Smart Clips",
    description:
      "Auto-detected important moments become clips with a single click.",
  },
  {
    icon: Brain,
    title: "Video Intelligence",
    description:
      "Extract highlights, topics, and themes from any video — no manual tagging required.",
  },
];

const stats = [
  { label: "Video formats", value: "MP4, WebM, MOV, AVI" },
  { label: "Audio formats", value: "MP3, WAV, OGG, M4A" },
  { label: "Documents", value: "PDF, DOCX, XLSX, PPTX" },
  { label: "AI providers", value: "OpenAI · Anthropic · Local" },
];

const architecture = [
  {
    icon: Layers,
    title: "Next.js 14 Frontend",
    description: "App Router, React Server Components, edge-ready.",
  },
  {
    icon: Brain,
    title: "FastAPI AI Service",
    description: "Python service for transcripts, embeddings, and RAG.",
  },
  {
    icon: Zap,
    title: "Rust Video Worker",
    description: "High-performance FFmpeg pipeline for clips and metadata.",
  },
  {
    icon: Shield,
    title: "Postgres + Qdrant",
    description: "Relational data with vector search for semantic retrieval.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.4]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>AI-powered content platform</span>
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Your content,{" "}
              <span className="text-primary">intelligently searchable</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              Upload videos, audio, and documents. Aether transcribes, indexes,
              and makes everything searchable with natural language. Ask
              questions, get timestamped answers, and generate clips
              automatically.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center md:text-left">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-1 text-sm font-medium">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything you need to work with content
            </h2>
            <p className="mt-3 text-muted-foreground">
              A focused toolkit for searching, understanding, and reusing the
              media you care about.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/40"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              From upload to insight in three steps
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload your files",
                description:
                  "Drag in videos, audio, or documents. We accept all common formats.",
                icon: Upload,
              },
              {
                step: "02",
                title: "Get automatic intelligence",
                description:
                  "Transcripts, summaries, moments, and topics are generated in the background.",
                icon: Sparkles,
              },
              {
                step: "03",
                title: "Search and ask",
                description:
                  "Use natural language to find anything, or chat with an AI that knows your library.",
                icon: MessageSquare,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="relative rounded-lg border bg-card p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Built on a modern, type-safe stack
            </h2>
            <p className="mt-3 text-muted-foreground">
              Four services, one workflow. All orchestrated through a clean
              monorepo.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {architecture.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.title} className="rounded-lg border bg-card p-5">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold">{a.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {a.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center md:p-12">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Ready to put your content to work?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Create an account, upload your first file, and let Aether do the
              rest.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Create free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" />
                Free to start
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" />
                Bring your own AI keys
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" />
                Self-hostable
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3 w-3" />
            </div>
            <span>Aether</span>
            <span className="text-xs">·</span>
            <span className="text-xs">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
