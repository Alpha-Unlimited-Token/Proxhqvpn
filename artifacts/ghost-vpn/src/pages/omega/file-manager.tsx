import { useState } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, File, ArrowLeft, Download, Trash2, Upload, HardDrive, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FileEntry = { name: string; type: "file" | "dir"; size?: string; modified?: string; children?: FileEntry[] };

const DRIVES: Record<string, FileEntry[]> = {
  "C:\\": [
    { name: "Users", type: "dir", modified: "04/18/26 09:00", children: [
      { name: "Administrator", type: "dir", modified: "04/18/26 09:00", children: [
        { name: "Desktop", type: "dir", modified: "04/18/26 02:30", children: [
          { name: "passwords.txt", type: "file", size: "1 KB", modified: "04/17/26 23:14" },
          { name: "notes.docx", type: "file", size: "24 KB", modified: "04/18/26 01:55" },
          { name: "report_final.xlsx", type: "file", size: "148 KB", modified: "04/16/26 17:22" },
        ]},
        { name: "Documents", type: "dir", modified: "04/15/26 12:00", children: [
          { name: "resume.pdf", type: "file", size: "312 KB", modified: "03/12/26 10:44" },
          { name: "taxes_2025.xlsx", type: "file", size: "89 KB", modified: "04/02/26 08:30" },
        ]},
        { name: "Downloads", type: "dir", modified: "04/18/26 00:10", children: [
          { name: "setup.exe", type: "file", size: "42 MB", modified: "04/18/26 00:10" },
          { name: "crack.zip", type: "file", size: "3.2 MB", modified: "04/17/26 22:44" },
        ]},
      ]},
    ]},
    { name: "Windows", type: "dir", modified: "04/10/26 00:00", children: [
      { name: "System32", type: "dir", modified: "04/10/26 00:00", children: [
        { name: "cmd.exe", type: "file", size: "362 KB", modified: "01/01/26 00:00" },
        { name: "notepad.exe", type: "file", size: "201 KB", modified: "01/01/26 00:00" },
        { name: "regedit.exe", type: "file", size: "418 KB", modified: "01/01/26 00:00" },
      ]},
    ]},
    { name: "Program Files", type: "dir", modified: "04/01/26 00:00", children: [
      { name: "Google", type: "dir", modified: "03/15/26 00:00", children: [] },
      { name: "Mozilla Firefox", type: "dir", modified: "03/20/26 00:00", children: [] },
    ]},
    { name: "pagefile.sys", type: "file", size: "8 GB", modified: "04/18/26 03:00" },
  ],
  "D:\\": [
    { name: "Backups", type: "dir", modified: "04/01/26 00:00", children: [
      { name: "backup_2026_04.zip", type: "file", size: "2.1 GB", modified: "04/01/26 02:00" },
    ]},
    { name: "Media", type: "dir", modified: "03/01/26 00:00", children: [
      { name: "video_001.mp4", type: "file", size: "841 MB", modified: "03/01/26 10:00" },
    ]},
  ],
};

function getNode(path: string[]): FileEntry[] {
  if (path.length === 0) return [];
  const drive = path[0];
  let entries = DRIVES[drive] ?? [];
  for (let i = 1; i < path.length; i++) {
    const found = entries.find(e => e.name === path[i] && e.type === "dir");
    if (!found?.children) return [];
    entries = found.children;
  }
  return entries;
}

export default function FileManager() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const { data: hosts } = useListHosts();
  const { toast } = useToast();

  const currentEntries = path.length === 0 ? [] : getNode(path);
  const driveList = Object.keys(DRIVES);

  const handleDownload = (name: string) => toast({ title: `Downloading ${name}...`, description: "Transfer initiated" });
  const handleDelete = (name: string) => toast({ title: `Deleted ${name}`, variant: "destructive" });

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FolderOpen className="h-7 w-7 text-primary" /> File Manager
            </h1>
            <p className="text-muted-foreground mt-1">Browse and manage files on remote hosts.</p>
          </div>
          <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => { setSelectedHostId(parseInt(v)); setPath([]); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a host..." /></SelectTrigger>
            <SelectContent>
              {hosts?.map(h => (
                <SelectItem key={h.id} value={h.id.toString()}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${h.status==='online'?'bg-green-500':h.status==='offline'?'bg-red-500':'bg-gray-500'}`} />
                    {h.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to browse its file system.</CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/40">
            {/* Path bar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-black/20 font-mono text-xs text-muted-foreground overflow-x-auto">
              {path.length === 0 ? (
                <span className="text-primary">My Computer</span>
              ) : (
                <>
                  <button onClick={() => setPath([])} className="hover:text-primary transition-colors">My Computer</button>
                  {path.map((seg, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
                      <button onClick={() => setPath(path.slice(0, i + 1))} className="hover:text-primary transition-colors">{seg}</button>
                    </span>
                  ))}
                </>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setPath(p => p.slice(0, -1))} disabled={path.length === 0}>
                <ArrowLeft className="h-3.5 w-3.5" /> Up
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => toast({ title: "Upload", description: "Select a file to upload" })}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </div>

            <CardContent className="p-0">
              {/* Drive list */}
              {path.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                  {driveList.map(drive => (
                    <button key={drive} onClick={() => setPath([drive])}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group">
                      <HardDrive className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-mono text-sm font-medium">{drive}</span>
                      <span className="text-xs text-muted-foreground">Local Disk</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {currentEntries.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">Empty directory</div>
                  ) : (
                    currentEntries.map((entry) => (
                      <div key={entry.name}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 group cursor-pointer transition-colors"
                        onDoubleClick={() => entry.type === "dir" && setPath(p => [...p, entry.name])}
                        onClick={() => entry.type === "dir" && setPath(p => [...p, entry.name])}
                      >
                        {entry.type === "dir"
                          ? <FolderOpen className="h-4 w-4 text-yellow-400 shrink-0" />
                          : <File className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="flex-1 font-mono text-sm truncate">{entry.name}</span>
                        {entry.size && <span className="text-xs text-muted-foreground font-mono w-20 text-right">{entry.size}</span>}
                        {entry.modified && <span className="hidden sm:block text-xs text-muted-foreground font-mono w-36 text-right">{entry.modified}</span>}
                        {entry.type === "file" && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); handleDownload(entry.name); }}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={e => { e.stopPropagation(); handleDelete(entry.name); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    
  );
}
