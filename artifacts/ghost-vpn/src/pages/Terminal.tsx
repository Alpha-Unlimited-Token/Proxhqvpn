import { useState, useRef, useEffect } from "react";
import { useExecTerminalCommand } from "@workspace/api-client-react";
import { Terminal as TerminalIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Terminal() {
  const [history, setHistory] = useState<{ cmd: string; out: string; isError: boolean }[]>([]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const execCmd = useExecTerminalCommand();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, cmdHistory.length - 1);
      setHistoryIndex(newIndex);
      if (cmdHistory.length > 0) setInput(cmdHistory[cmdHistory.length - 1 - newIndex] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? "" : (cmdHistory[cmdHistory.length - 1 - newIndex] ?? ""));
      return;
    }
    if (e.key === "Enter" && input.trim()) {
      const cmd = input.trim();
      setCmdHistory((h) => [...h.filter((c) => c !== cmd), cmd].slice(-100));
      setHistoryIndex(-1);
      setInput("");
      setHistory(h => [...h, { cmd, out: "executing...", isError: false }]);
      
      execCmd.mutate({ data: { command: cmd, shell: "bash" } }, {
        onSuccess: (res) => {
          setHistory(h => {
            const newH = [...h];
            newH[newH.length - 1] = { 
              cmd, 
              out: res.stdout || res.stderr || "[NO OUTPUT]", 
              isError: res.exitCode !== 0 
            };
            return newH;
          });
        },
        onError: (err: any) => {
          setHistory(h => {
            const newH = [...h];
            newH[newH.length - 1] = { 
              cmd, 
              out: err.message || "Command failed", 
              isError: true 
            };
            return newH;
          });
        }
      });
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <TerminalIcon className="w-6 h-6" />
          Root Terminal
        </h2>
      </div>

      <div className="flex-1 bg-black border border-primary/20 rounded flex flex-col overflow-hidden font-mono text-sm">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="text-primary/50 mb-4">
            GhostNet OS v2.1.4 (x86_64) <br/>
            Type commands to execute on the management node.
          </div>
          
          {history.map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2 text-primary/70">
                <span className="text-destructive">root@ghostnet:~#</span>
                <span>{item.cmd}</span>
              </div>
              <div className={`whitespace-pre-wrap ${item.isError ? 'text-destructive' : 'text-primary'}`}>
                {item.out}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        
        <div className="p-2 border-t border-primary/20 bg-black/50 flex items-center gap-2">
           <span className="text-destructive ml-2 shrink-0">root@ghostnet:~#</span>
           <Input 
             className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-primary font-mono rounded-none h-8 px-2"
             value={input}
             onChange={e => setInput(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder="Type a command..."
             autoFocus
           />
        </div>
      </div>
    </div>
  );
}
