import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Zap, Trophy, Wallet, Shield, Clock, Monitor, Terminal, Database, Cpu, Layout, Info, Rocket, CheckCircle2, ListChecks, TrendingUp, BarChart3, Binary, Lock, Users, ChevronRight, Menu, X, Search, Github, Twitter, ExternalLink, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const SECTIONS = [
  { id: "mission", label: "Project Mission", icon: Rocket },
  { id: "features", label: "Core Features", icon: Zap },
  { id: "workflow", label: "Game Flow", icon: ListChecks, sub: [
    { id: "registration", label: "Registration" },
    { id: "eligibility", label: "Token Eligibility" },
    { id: "window", label: "Prediction Window" },
    { id: "options", label: "Prediction Options" },
  ]},
  { id: "tech", label: "Technical Engine", icon: Cpu, sub: [
    { id: "monitoring", label: "Elon Post Monitoring" },
    { id: "streaming", label: "Live Streaming" },
    { id: "resolution", label: "Winner Resolution" },
  ]},
  { id: "rewards", label: "Reward System", icon: Trophy, sub: [
    { id: "distribution", label: "SOL Distribution" },
    { id: "funding", label: "Vault Funding" },
    { id: "no-winner", label: "No-Winner Rounds" },
  ]},
  { id: "data", label: "Research & Data", icon: BarChart3 },
  { id: "architecture", label: "Architecture", icon: Binary },
  { id: "security", label: "Security & Fairness", icon: Shield },
  { id: "summary", label: "Rules Summary", icon: Layout },
  { id: "roadmap", label: "Future Roadmap", icon: TrendingUp },
];

const Docs = () => {
  const [activeSection, setActiveSection] = useState("mission");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Simple scroll spy
  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = SECTIONS.flatMap(s => [s, ...(s.sub || [])]).map(s => document.getElementById(s.id));
      const scrollPosition = window.scrollY + 100;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const el = sectionElements[i];
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(el.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: "smooth",
      });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background selection:bg-neon-cyan/30">
      {/* Top Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 group">
               <span className="font-display font-bold text-lg tracking-tight">Elonmarket <span className="text-muted-foreground font-normal">Docs</span></span>
            </Link>
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            <Badge variant="outline" className="hidden md:flex bg-muted/30 border-border/50 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5">
              v1.2.0-PRO
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 bg-muted/30 border border-border/50 px-3 py-1.5 rounded-lg text-xs text-muted-foreground w-64">
              <Search className="w-3.5 h-3.5" />
              <span>Search documentation...</span>
              <span className="ml-auto text-[10px] opacity-50 font-mono">⌘K</span>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            <Link to="/">
              <Button variant="neon" size="sm" className="hidden md:flex h-9 gap-2">
                Launch App <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 flex">
        {/* Left Sidebar Navigation */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 pt-20 bg-background border-r border-border/50 transform transition-transform duration-300 md:translate-x-0 md:static md:block ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <ScrollArea className="h-[calc(100vh-80px)] px-4 py-6">
            <div className="space-y-6">
              {SECTIONS.map((section) => (
                <div key={section.id} className="space-y-1">
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeSection === section.id 
                        ? "bg-neon-cyan/10 text-neon-cyan" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <section.icon className={`w-4 h-4 ${activeSection === section.id ? "text-neon-cyan" : "text-muted-foreground/60"}`} />
                    {section.label}
                  </button>
                  {section.sub && (
                    <div className="ml-9 border-l border-border/50 space-y-1">
                      {section.sub.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => scrollToSection(sub.id)}
                          className={`block w-full text-left px-3 py-1.5 text-xs transition-colors relative ${
                            activeSection === sub.id 
                              ? "text-neon-cyan font-bold" 
                              : "text-muted-foreground/70 hover:text-foreground"
                          }`}
                        >
                          {activeSection === sub.id && (
                            <div className="absolute left-[-1px] top-1.5 bottom-1.5 w-[2px] bg-neon-cyan" />
                          )}
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-border/50 space-y-4">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-3">Community</p>
              <a href="#" className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Github className="w-3.5 h-3.5" /> GitHub Repository
              </a>
              <a href="#" className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="w-3.5 h-3.5" /> Join Twitter Community
              </a>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 md:pl-10 pt-28 pb-20">
          <div className="max-w-3xl">
            {/* Mission Section */}
            <section id="mission" className="mb-20 scroll-mt-28">
              <Badge className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 mb-4 px-3">OVERVIEW</Badge>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 tracking-tight">Project Mission</h1>
              <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                🚀 <span className="text-foreground font-bold">Elonmarket</span> is a decentralized, free-to-play prediction marketplace where users predict what Elon Musk will post first next on X.
              </p>
              <div className="prose prose-invert prose-p:text-muted-foreground prose-strong:text-foreground max-w-none">
                <p>
                  Our goal is to build the world's first frictionless prediction ecosystem focused on real-world behavioral patterns. Elonmarket eliminates the typical barriers of entry into prediction markets by automating the entire lifecycle—from account creation to reward distribution.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-10 not-prose">
                  <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
                    <p className="font-bold text-sm">No Connection</p>
                    <p className="text-xs text-muted-foreground">No wallet signature required to play.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
                    <p className="font-bold text-sm">Automated SOL</p>
                    <p className="text-xs text-muted-foreground">Rewards sent direct to your wallet.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
                    <p className="font-bold text-sm">$EMARKET Gated</p>
                    <p className="text-xs text-muted-foreground">Exclusive to $EMARKET token holders.</p>
                  </div>
                </div>
              </div>
            </section>

            <Separator className="my-12 opacity-30" />

            {/* Core Features */}
            <section id="features" className="mb-20 scroll-mt-28">
              <h2 className="text-3xl font-display font-bold mb-8">Core Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Predict Elon’s X post", desc: "Stake your reputation on Elon's next move.", icon: Zap },
                  { title: "Win SOL automatically", desc: "No manual claims. Instant distribution.", icon: Trophy },
                  { title: "No wallet connection", desc: "Participation based on registration, not signatures.", icon: Lock },
                  { title: "Real-time streaming", desc: "Watch posts appear as they happen via WebSocket.", icon: Activity },
                  { title: "Automated reward engine", desc: "Proprietary resolution engine for 100% accuracy.", icon: Cpu },
                  { title: "Global leaderboard", desc: "Competing with the world's best predictors.", icon: BarChart3 },
                ].map((f, i) => (
                  <div key={i} className="flex gap-4 p-5 rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                      <f.icon className="w-5 h-5 text-neon-cyan" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm mb-1">{f.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Workflow Section */}
            <section id="workflow" className="mb-20 scroll-mt-28">
              <h2 className="text-3xl font-display font-bold mb-4">Game Flow</h2>
              <p className="text-muted-foreground mb-10">The standard lifecycle of a user on Elonmarket.</p>

              <div id="registration" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-neon-cyan rounded-full" />
                  1. User Registration
                </h3>
                <div className="prose prose-invert max-w-none">
                  <p>Users register by submitting a unique <strong>Username</strong> and a <strong>Solana Wallet Address</strong>. Your username + wallet address acts as your unique persistent identity within the system.</p>
                  <ul>
                    <li>No email required</li>
                    <li>No password management</li>
                    <li>No wallet signature verification</li>
                  </ul>
                </div>
              </div>

              <div id="eligibility" className="mb-12 scroll-mt-28 p-6 rounded-2xl bg-neon-purple/5 border border-neon-purple/20">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-neon-purple">
                  <Lock className="w-5 h-5" />
                  2. Token Eligibility ($EMARKET)
                </h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">To ensure high-quality participation and project sustainability, users must hold a minimum threshold of <strong>$EMARKET tokens</strong>.</p>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">threshold_check()</span>
                    <span className="text-neon-green font-bold">PASSED</span>
                  </div>
                  <p className="text-xs font-mono text-white/80">Requirement: <span className="text-neon-cyan">20,000 $EMARKET</span></p>
                </div>
              </div>

              <div id="window" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-neon-cyan rounded-full" />
                  3. Prediction Window
                </h3>
                <p className="text-muted-foreground mb-4">Each round is open for a fixed duration. Predictions must be submitted before the countdown ends. Typical windows are aligned with peak Elon activity hours.</p>
              </div>

              <div id="options" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-neon-cyan rounded-full" />
                  4. Prediction Options
                </h3>
                <p className="text-muted-foreground mb-6">Users select exactly one option per round. Options are curated based on trending topics and historical data.</p>
                <div className="flex flex-wrap gap-2">
                  {["Grok", "Tesla", "Starlink", "SpaceX", "X", "Gork"].map(opt => (
                    <Badge key={opt} variant="outline" className="px-3 py-1 bg-muted/20 border-border/50">{opt}</Badge>
                  ))}
                </div>
              </div>
            </section>

            {/* Tech Section */}
            <section id="tech" className="mb-20 scroll-mt-28">
              <h2 className="text-3xl font-display font-bold mb-8">Technical Engine</h2>
              
              <div id="monitoring" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4">Real-Time Post Monitoring</h3>
                <div className="bg-black/80 rounded-2xl p-6 font-mono text-sm border border-border shadow-2xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <Terminal className="w-4 h-4 text-neon-green" />
                    <span className="text-white/60 text-xs">monitoring_service.js</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-neon-cyan opacity-80">$ pm2 status</p>
                    <div className="grid grid-cols-3 gap-2 py-2">
                      <div className="text-[10px] text-white/40 uppercase">App Name</div>
                      <div className="text-[10px] text-white/40 uppercase text-center">Status</div>
                      <div className="text-[10px] text-white/40 uppercase text-right">Uptime</div>
                      <div className="text-xs">elon-stream</div>
                      <div className="text-xs text-neon-green text-center">online</div>
                      <div className="text-xs text-right">142h</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-neon-cyan opacity-80">$ tail -f logs/stream.log</p>
                    <p className="text-[11px] text-white/50">[14:22:05] Socket connection established</p>
                    <p className="text-[11px] text-white/50">[14:25:31] New post detected: ID_88293...</p>
                    <p className="text-[11px] text-neon-green font-bold">[14:25:32] Match found: "Starlink"</p>
                  </div>
                </div>
              </div>

              <div id="streaming" className="mb-12 scroll-mt-28 prose prose-invert max-w-none">
                <h3 className="text-xl font-bold not-prose mb-4">Live Post Streaming</h3>
                <p>Our infrastructure uses a custom headless Chromium engine to scrape and verify Elon's posts. Verified posts are instantly pushed to the frontend via <strong>WebSockets</strong>, ensuring zero latency for users.</p>
              </div>

              <div id="resolution" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4">Winner Resolution</h3>
                <Card variant="glass" className="bg-muted/10">
                   <CardContent className="p-6 space-y-4 text-sm text-muted-foreground">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-neon-green shrink-0 mt-0.5" />
                        <p><span className="text-foreground font-bold">Exact Match:</span> Keywords must match exactly as predefined in the round options.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-neon-green shrink-0 mt-0.5" />
                        <p><span className="text-foreground font-bold">Time Logic:</span> Posts must originate after the prediction start time but before the round end.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-neon-green shrink-0 mt-0.5" />
                        <p><span className="text-foreground font-bold">Priority:</span> If multiple keywords appear, the first one mentioned in the post wins.</p>
                      </div>
                   </CardContent>
                </Card>
              </div>
            </section>

            {/* Rewards Section */}
            <section id="rewards" className="mb-20 scroll-mt-28">
              <h2 className="text-3xl font-display font-bold mb-8">Reward System</h2>
              
              <div id="distribution" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4">Automated SOL Distribution</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Elonmarket uses an <strong>Automated Payout Engine</strong>. Once a winner is resolved, the system calculates the payout and broadcasts the transactions to the Solana network.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Payout Amount</p>
                    <p className="text-2xl font-bold text-neon-green">10% – 20%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">of current Vault Balance</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Interval</p>
                    <p className="text-2xl font-bold text-foreground">Immediate</p>
                    <p className="text-[10px] text-muted-foreground mt-1">upon round finalization</p>
                  </div>
                </div>
              </div>

              <div id="funding" className="mb-12 scroll-mt-28">
                <h3 className="text-xl font-bold mb-4">Vault Funding (Creator Rewards)</h3>
                <p className="text-muted-foreground mb-6">
                  The reward pool is funded entirely by <strong>Creator Rewards</strong> generated from pump.fun. A scheduled bot transfers these funds to the vault every 10 minutes.
                </p>
                <div className="flex items-center gap-6 p-4 rounded-2xl bg-muted/20 border border-border/50 border-dashed">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border mb-1">
                      <Rocket className="w-5 h-5 text-neon-cyan" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Pump.fun</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-30" />
                  <div className="flex-1 text-center">
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden mb-1">
                      <div className="h-full bg-neon-cyan w-3/4 animate-pulse" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Every 10 Minutes</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-30" />
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border mb-1">
                      <Wallet className="w-5 h-5 text-neon-green" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Vault</span>
                  </div>
                </div>
              </div>

              <div id="no-winner" className="scroll-mt-28">
                <h3 className="text-xl font-bold mb-4">No-Winner Rounds</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If a round ends with no matching post or no users voted for the winning option, the round is finalized with <strong>Zero Payout</strong>. Funds remain in the vault to ensure the sustainability of the project.
                </p>
              </div>
            </section>

            {/* Research & Data */}
            <section id="data" className="mb-20 scroll-mt-28">
              <h2 className="text-3xl font-display font-bold mb-8">Research & Data</h2>
              <div className="space-y-8">
                <p className="text-muted-foreground leading-relaxed">
                  Elonmarket isn't based on guessing—it's based on behavioral science. We've analyzed thousands of Elon's posts to design our prediction windows and options.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Topic Distribution</h4>
                      <div className="space-y-3">
                         {[
                           { l: "Tesla / EV", v: "25-29%" },
                           { l: "AI / Grok", v: "15-20%" },
                           { l: "SpaceX", v: "15-25%" },
                           { l: "X Platform", v: "12-20%" }
                         ].map(item => (
                           <div key={item.l} className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                 <span className="text-muted-foreground uppercase">{item.l}</span>
                                 <span>{item.v}</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                 <div className="h-full bg-neon-cyan" style={{ width: item.v.split('-')[1] }} />
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                   <div className="bg-muted/10 rounded-2xl p-6 border border-border/50">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 text-center">Peak Activity</h4>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">11 AM – 3 PM UTC</span>
                            <Badge className="bg-neon-purple/20 text-neon-purple border-neon-purple/30">VERY HIGH</Badge>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">5 PM – 8 PM UTC</span>
                            <Badge className="bg-neon-cyan/10 text-neon-cyan">HIGH</Badge>
                         </div>
                         <div className="flex justify-between items-center opacity-50">
                            <span className="text-xs text-muted-foreground">1 AM – 4 AM UTC</span>
                            <Badge variant="outline">MEDIUM</Badge>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </section>

            {/* Architecture Section */}
            <section id="architecture" className="mb-20 scroll-mt-28">
               <h2 className="text-3xl font-display font-bold mb-8">System Architecture</h2>
               <div className="relative border border-border/50 rounded-2xl bg-muted/5 p-8 overflow-hidden">
                  <div className="relative z-10 grid grid-cols-1 gap-6">
                    {[
                      { step: "Frontend Interface", tech: "React / Tailwind / Lucide" },
                      { step: "Real-time Streamer", tech: "Node.js / Puppeteer / WebSockets" },
                      { step: "Validation Engine", tech: "Supabase Edge Functions" },
                      { step: "Blockchain Layer", tech: "Solana / @solana/web3.js" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-6 group">
                        <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center font-bold text-neon-cyan shadow-sm group-hover:border-neon-cyan/50 transition-colors">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm mb-0.5">{item.step}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.tech}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute left-[27px] top-20 bottom-20 w-[1px] bg-gradient-to-b from-neon-cyan to-transparent opacity-20" />
               </div>
            </section>

            {/* Security Section */}
            <section id="security" className="mb-20 scroll-mt-28">
               <h2 className="text-3xl font-display font-bold mb-8">Security & Fairness</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card variant="glass">
                    <CardHeader>
                       <CardTitle className="text-base font-bold flex items-center gap-2">
                         <Shield className="w-4 h-4 text-neon-cyan" />
                         Integrity Filters
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs text-muted-foreground">
                      <p>• Duplicate wallet prevention system</p>
                      <p>• Anti-bot vote cooldown period</p>
                      <p>• Timestamp verification via Solana RPC</p>
                      <p>• Multi-stage post authenticity validation</p>
                    </CardContent>
                  </Card>
                  <Card variant="glass">
                    <CardHeader>
                       <CardTitle className="text-base font-bold flex items-center gap-2">
                         <Lock className="w-4 h-4 text-neon-cyan" />
                         Vault Auditing
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs text-muted-foreground">
                      <p>• All payouts visible on Solana Explorer</p>
                      <p>• Immutable record of winning posts</p>
                      <p>• Transparent vault funding ledger</p>
                      <p>• Service-role gated backend execution</p>
                    </CardContent>
                  </Card>
               </div>
            </section>

            {/* Rules Summary */}
            <section id="summary" className="mb-20 scroll-mt-28">
               <h2 className="text-3xl font-display font-bold mb-8">Rules Summary</h2>
               <div className="rounded-2xl border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 text-left">
                        <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Feature</th>
                        <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                       <tr><td className="px-6 py-4 font-bold">Eligibility</td><td className="px-6 py-4 text-muted-foreground">Username + $EMARKET Token Holding</td></tr>
                       <tr><td className="px-6 py-4 font-bold">Voting</td><td className="px-6 py-4 text-muted-foreground">Max 1 vote per round per user</td></tr>
                       <tr><td className="px-6 py-4 font-bold">Payouts</td><td className="px-6 py-4 text-muted-foreground">10% - 20% of vault per round</td></tr>
                       <tr><td className="px-6 py-4 font-bold">Claiming</td><td className="px-6 py-4 text-muted-foreground">Not required (Fully Automated)</td></tr>
                    </tbody>
                  </table>
               </div>
            </section>

            {/* Roadmap Section */}
            <section id="roadmap" className="mb-20 scroll-mt-28">
               <h2 className="text-3xl font-display font-bold mb-8">Future Roadmap</h2>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    "Mobile App", "Advanced Analytics", "Seasonal Rankings", 
                    "DAO Governance", "Multi-Language UI", "Global Expansion"
                  ].map(item => (
                    <div key={item} className="p-4 rounded-xl bg-muted/20 border border-border/50 text-center font-bold text-xs">
                       {item}
                    </div>
                  ))}
               </div>
            </section>

            {/* Final Footer */}
            <footer className="pt-20 border-t border-border/50 text-center text-muted-foreground">
               <p className="text-sm mb-6 max-w-xl mx-auto">
                 Elonmarket is an independent prediction platform and is not affiliated with X Corp or Elon Musk. Used for entertainment and community engagement only.
               </p>
               <div className="flex justify-center gap-6 opacity-40">
                  <Github className="w-5 h-5" />
                  <Twitter className="w-5 h-5" />
                  <ExternalLink className="w-5 h-5" />
               </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
