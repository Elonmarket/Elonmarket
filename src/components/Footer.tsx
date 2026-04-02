import { Target, MessageCircle, Github } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 md:h-16 overflow-hidden flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.02]">
              <img src="/elonmarket-logo.jpeg" alt="Elonmarket" className="h-full w-auto object-contain mix-blend-lighten" />
            </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs">
              Free-to-play Elon prediction market. Predict Elon's tweets, win SOL.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-medium mb-3 text-sm">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#feed" className="text-muted-foreground hover:text-foreground transition-colors">Feed</a></li>
              <li><a href="#predict" className="text-muted-foreground hover:text-foreground transition-colors">Markets</a></li>
              <li><a href="#leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">Leaderboard</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Get Tokens</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-medium mb-3 text-sm">Community</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://x.com/elonmarketfun" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">X (Twitter)</a></li>
              <li><a href="https://github.com/muskmarket/Elonmarket" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">GitHub</a></li>
              <li><a href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Docs</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground mb-4 md:mb-0">
            © 2026 ELONMARKET. Not affiliated with Elon Musk or X Corp.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/elonmarketfun" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/muskmarket/Elonmarket" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
