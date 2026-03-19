import { Target, Twitter, MessageCircle, Github } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 md:h-16 overflow-hidden flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.02]">
              <img src="/elonmarket-logo.png" alt="Elonmarket" className="h-full w-auto object-contain" />
            </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs">
              Free-to-play prediction market. Predict Elon's tweets, win SOL.
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
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Twitter/X</a></li>
              <li><a href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Docs</a></li> 
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground mb-4 md:mb-0">
            © 2026 ELONMARKET. Not affiliated with Elon Musk or X Corp.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
            
          </div>
        </div>
      </div>
    </footer>
  );
};
