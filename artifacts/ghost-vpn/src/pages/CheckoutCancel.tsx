import { Link } from "wouter";
import { XCircle, ArrowLeft, Zap } from "lucide-react";

export default function CheckoutCancel() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center font-mono">
      <div className="text-center space-y-5 max-w-sm px-4">
        <div className="w-14 h-14 border border-primary/20 flex items-center justify-center mx-auto">
          <XCircle className="w-7 h-7 text-primary/40" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-widest uppercase text-primary">Checkout Cancelled</h1>
          <p className="text-[10px] text-primary/40 mt-1">No charge was made. You can try again whenever you're ready.</p>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <Link href="/account"
            className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 px-4 py-2 transition-colors">
            <Zap className="w-3 h-3" /> TRY AGAIN
          </Link>
          <Link href="/dashboard"
            className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-primary/50 hover:text-primary border border-primary/20 px-4 py-2 transition-colors">
            <ArrowLeft className="w-3 h-3" /> BACK TO DASHBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}
