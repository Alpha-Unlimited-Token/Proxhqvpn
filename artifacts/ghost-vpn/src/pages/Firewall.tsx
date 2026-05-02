// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { 
  useGetFirewallStatus, useListFirewallRules, useToggleFirewall, 
  useListBlockedIps, useBlockIp, useUnblockIp, useGenerateIptablesRules,
  useCreateFirewallRule, useDeleteFirewallRule,
  getGetFirewallStatusQueryKey, getListFirewallRulesQueryKey, getListBlockedIpsQueryKey 
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ShieldAlert, Power, FileCode, Trash } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Firewall() {
  const { data: status } = useGetFirewallStatus({ query: { refetchInterval: 10000 } as any });
  const { data: rulesData } = useListFirewallRules({ query: { refetchInterval: 30000 } as any });
  const { data: blockedData } = useListBlockedIps({ query: { refetchInterval: 8000 } as any });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const toggleFirewall = useToggleFirewall();
  const generateRules = useGenerateIptablesRules();
  const blockIp = useBlockIp();
  const unblockIp = useUnblockIp();
  const createRule = useCreateFirewallRule();
  const deleteRule = useDeleteFirewallRule();

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportedRules, setExportedRules] = useState("");
  const [isBlockIpOpen, setIsBlockIpOpen] = useState(false);
  const [blockIpForm, setBlockIpForm] = useState({ ip: '', reason: '' });
  
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '', priority: 100, direction: 'inbound', action: 'drop', protocol: 'tcp', sourceIp: '', destPort: ''
  });
  const [isModeOpen, setIsModeOpen] = useState(false);

  const handleToggle = () => {
    toggleFirewall.mutate({ data: { enabled: !status?.enabled } }, {
      onSuccess: () => {
        toast({ title: "Firewall Status Changed", description: `Firewall is now ${!status?.enabled ? 'ACTIVE' : 'DISABLED'}.` });
        queryClient.invalidateQueries({ queryKey: getGetFirewallStatusQueryKey() });
      }
    });
  };

  const handleExport = () => {
    generateRules.mutate(undefined, {
      onSuccess: (data) => {
        setExportedRules(data.iptablesRules);
        setIsExportOpen(true);
      }
    });
  };

  const handleBlockIp = (e: React.FormEvent) => {
    e.preventDefault();
    blockIp.mutate({ data: blockIpForm }, {
      onSuccess: () => {
        toast({ title: "IP Blocked", description: `${blockIpForm.ip} added to blacklist.` });
        setIsBlockIpOpen(false);
        setBlockIpForm({ ip: '', reason: '' });
        queryClient.invalidateQueries({ queryKey: getListBlockedIpsQueryKey() });
      }
    });
  };

  const handleUnblockIp = (id: number, ip: string) => {
    unblockIp.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "IP Unblocked", description: `${ip} removed from blacklist.` });
        queryClient.invalidateQueries({ queryKey: getListBlockedIpsQueryKey() });
      }
    });
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate({ data: ruleForm as any }, {
      onSuccess: () => {
        toast({ title: "Rule Added", description: `Firewall rule ${ruleForm.name} deployed.` });
        setIsCreateRuleOpen(false);
        queryClient.invalidateQueries({ queryKey: getListFirewallRulesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col overflow-auto pb-8">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Firewall OS
        </h2>
        <div className="flex items-center gap-2">
          <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleExport} disabled={generateRules.isPending} className="border-primary text-primary hover:bg-primary/20">
                <FileCode className="w-4 h-4 mr-2" />
                EXPORT IPTABLES
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border border-primary/50 text-primary font-mono max-w-4xl">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-widest text-primary/70">Generated IP Tables</DialogTitle>
              </DialogHeader>
              <pre className="bg-black/50 p-4 border border-primary/20 rounded h-96 overflow-auto text-xs whitespace-pre-wrap">
                {exportedRules}
              </pre>
            </DialogContent>
          </Dialog>

          <Button 
            variant={status?.enabled ? "default" : "destructive"}
            className={status?.enabled ? "bg-primary text-black hover:bg-primary/80" : ""}
            onClick={handleToggle}
            disabled={toggleFirewall.isPending}
          >
            <Power className="w-4 h-4 mr-2" />
            {status?.enabled ? "DISABLE FW" : "ENABLE FW"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <div className="border border-primary/20 bg-black p-4 rounded flex flex-col gap-1">
              <span className="text-xs text-primary/50 uppercase">Status</span>
              <span className={`font-mono font-bold ${status?.enabled ? "text-primary" : "text-destructive"}`}>{status?.enabled ? "ACTIVE" : "INACTIVE"}</span>
          </div>
          <div className="border border-primary/20 bg-black p-4 rounded flex flex-col gap-1 cursor-pointer group" onClick={() => setIsModeOpen(!isModeOpen)}>
              <span className="text-xs text-primary/50 uppercase">Mode <span className="text-primary/30 group-hover:text-primary/60">(click to change)</span></span>
              <Select
                value={status?.mode ?? "stealth"}
                open={isModeOpen}
                onOpenChange={setIsModeOpen}
                onValueChange={(v) => {
                  toggleFirewall.mutate({ data: { enabled: status?.enabled ?? true, mode: v as any } }, {
                    onSuccess: () => {
                      toast({ title: "Mode Changed", description: `Firewall mode set to ${v.toUpperCase()}.` });
                      queryClient.invalidateQueries({ queryKey: getGetFirewallStatusQueryKey() });
                    }
                  });
                }}
              >
                <SelectTrigger className="border-none p-0 h-auto shadow-none font-mono font-bold uppercase text-sm text-primary bg-transparent focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-primary/50 text-primary text-xs font-mono">
                  <SelectItem value="stealth">STEALTH</SelectItem>
                  <SelectItem value="strict">STRICT</SelectItem>
                  <SelectItem value="standard">STANDARD</SelectItem>
                  <SelectItem value="learning">LEARNING</SelectItem>
                </SelectContent>
              </Select>
          </div>
          <div className="border border-primary/20 bg-black p-4 rounded flex flex-col gap-1">
              <span className="text-xs text-primary/50 uppercase">ISP Masquerade</span>
              <span className="font-mono font-bold">{status?.ispMasqueradeActive ? "ON" : "OFF"}</span>
          </div>
          <div className="border border-primary/20 bg-black p-4 rounded flex flex-col gap-1">
              <span className="text-xs text-primary/50 uppercase">DNS Masking</span>
              <span className="font-mono font-bold">{status?.dnsMasked ? "ON" : "OFF"}</span>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4 border border-primary/20 rounded bg-black p-4">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2">
            <h3 className="font-bold tracking-widest text-sm uppercase">Active Rules</h3>
            <Dialog open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-primary text-primary hover:bg-primary/20">ADD RULE</Button>
              </DialogTrigger>
              <DialogContent className="bg-black border border-primary/50 text-primary font-mono">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-widest text-primary/70">Create FW Rule</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateRule} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Name</Label>
                      <Input required className="border-primary/20 bg-black/50 text-primary h-8 text-xs" value={ruleForm.name} onChange={e => setRuleForm({...ruleForm, name: e.target.value})} placeholder="Block SSH" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Priority</Label>
                      <Input type="number" required className="border-primary/20 bg-black/50 text-primary h-8 text-xs" value={ruleForm.priority} onChange={e => setRuleForm({...ruleForm, priority: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Direction</Label>
                      <Select value={ruleForm.direction} onValueChange={v => setRuleForm({...ruleForm, direction: v})}>
                        <SelectTrigger className="border-primary/20 bg-black/50 text-primary h-8 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-black border-primary/50 text-primary text-xs">
                          <SelectItem value="inbound">INBOUND</SelectItem>
                          <SelectItem value="outbound">OUTBOUND</SelectItem>
                          <SelectItem value="both">BOTH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Action</Label>
                      <Select value={ruleForm.action} onValueChange={v => setRuleForm({...ruleForm, action: v})}>
                        <SelectTrigger className="border-primary/20 bg-black/50 text-primary h-8 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-black border-primary/50 text-primary text-xs">
                          <SelectItem value="allow">ALLOW</SelectItem>
                          <SelectItem value="drop">DROP</SelectItem>
                          <SelectItem value="reject">REJECT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={createRule.isPending} className="w-full bg-primary text-black hover:bg-primary/80 text-xs">APPLY RULE</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-primary/20 hover:bg-transparent">
                <TableHead className="text-primary/70 text-xs">PRI</TableHead>
                <TableHead className="text-primary/70 text-xs">NAME</TableHead>
                <TableHead className="text-primary/70 text-xs">ACTION</TableHead>
                <TableHead className="text-primary/70 text-xs">TARGET</TableHead>
                <TableHead className="text-primary/70 text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesData?.rules?.map((rule) => (
                <TableRow key={rule.id} className="border-primary/20 hover:bg-primary/5">
                  <TableCell className="font-mono text-xs">{rule.priority}</TableCell>
                  <TableCell className="font-mono text-xs">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-[10px] ${rule.action === 'allow' ? 'border-primary text-primary' : rule.action === 'drop' ? 'border-destructive text-destructive' : 'border-primary/50'}`}>
                      {rule.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{rule.destPort ? `PORT ${rule.destPort}` : 'ANY'}</TableCell>
                  <TableCell>
                     <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-destructive hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => deleteRule.mutate({ id: rule.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFirewallRulesQueryKey() })})}
                     >
                       <Trash className="h-3 w-3" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4 border border-primary/20 rounded bg-black p-4">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2">
            <h3 className="font-bold tracking-widest text-sm uppercase text-destructive flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Blacklist (Auto/Manual)
            </h3>
            <Dialog open={isBlockIpOpen} onOpenChange={setIsBlockIpOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-destructive text-destructive hover:bg-destructive hover:text-black">MANUAL BLOCK</Button>
              </DialogTrigger>
              <DialogContent className="bg-black border border-primary/50 text-primary font-mono">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-widest text-destructive">Enforce IP Block</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleBlockIp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs">IP Address</Label>
                    <Input required className="border-primary/20 bg-black/50 text-primary focus-visible:ring-primary/50" value={blockIpForm.ip} onChange={e => setBlockIpForm({...blockIpForm, ip: e.target.value})} placeholder="192.168.1.1" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Reason</Label>
                    <Input required className="border-primary/20 bg-black/50 text-primary focus-visible:ring-primary/50" value={blockIpForm.reason} onChange={e => setBlockIpForm({...blockIpForm, reason: e.target.value})} placeholder="Manual intervention" />
                  </div>
                  <Button type="submit" disabled={blockIp.isPending} className="w-full bg-destructive text-black hover:bg-destructive/80">ENFORCE DROP</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-primary/20 hover:bg-transparent">
                <TableHead className="text-primary/70 text-xs">IP</TableHead>
                <TableHead className="text-primary/70 text-xs">REASON</TableHead>
                <TableHead className="text-primary/70 text-xs">HITS</TableHead>
                <TableHead className="text-primary/70 text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedData?.blockedIps?.map((b) => (
                <TableRow key={b.id} className="border-primary/20 hover:bg-primary/5">
                  <TableCell className="font-mono text-xs text-destructive">{b.ip}</TableCell>
                  <TableCell className="font-mono text-[10px] truncate max-w-[150px]">{b.reason}</TableCell>
                  <TableCell className="font-mono text-xs">{b.hitCount}</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-primary/50 text-primary hover:bg-primary/20 h-6 px-2 text-[10px]"
                      onClick={() => handleUnblockIp(b.id, b.ip)}
                      disabled={unblockIp.isPending}
                    >
                      PARDON
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!blockedData?.blockedIps?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-primary/50 py-8 font-mono text-xs">
                    BLACKLIST EMPTY
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
