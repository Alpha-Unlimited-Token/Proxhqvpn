// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useRunBlockchainScan } from "@workspace/api-client-react";
import { useForm } from "react-form";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function NewScan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const runScan = useRunBlockchainScan();
  
  const [name, setName] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [scanType, setScanType] = useState("smart_contract");
  const [code, setCode] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [includeQuantumAnalysis, setIncludeQuantumAnalysis] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    
    if (!code && !contractAddress) {
      toast({ title: "Code or Contract Address required", variant: "destructive" });
      return;
    }

    runScan.mutate({
      data: {
        name,
        chain: chain as any,
        scanType: scanType as any,
        code: code || undefined,
        contractAddress: contractAddress || undefined,
        includeQuantumAnalysis
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Scan started successfully" });
        setLocation(`/scans/${data.id}`);
      },
      onError: (error) => {
        toast({ 
          title: "Failed to start scan", 
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Audit Scan</h1>
        <p className="text-muted-foreground mt-2">Initialize a new blockchain security analysis job.</p>
      </div>

      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>Provide the code or contract details to audit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Scan Name</Label>
              <Input 
                id="name" 
                placeholder="e.g., Uniswap V3 Core Audit" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono bg-background/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blockchain Network</Label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="bitcoin">Bitcoin</SelectItem>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                    <SelectItem value="avalanche">Avalanche</SelectItem>
                    <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    <SelectItem value="bsc">BSC</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scan Type</Label>
                <Select value={scanType} onValueChange={setScanType}>
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart_contract">Smart Contract</SelectItem>
                    <SelectItem value="protocol">Protocol Level</SelectItem>
                    <SelectItem value="consensus">Consensus Mechanism</SelectItem>
                    <SelectItem value="cryptography">Cryptography Only</SelectItem>
                    <SelectItem value="all">Comprehensive (All)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Contract Address (Optional)</Label>
              <Input 
                id="address" 
                placeholder="0x..." 
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="font-mono bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Source Code (Required if no address)</Label>
              <Textarea 
                id="code" 
                placeholder="Paste Solidity, Rust, or other smart contract code here..." 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono min-h-[200px] bg-background/50"
              />
            </div>

            <div className="flex items-center space-x-3 p-4 border border-border rounded-lg bg-accent/30">
              <Switch 
                id="quantum" 
                checked={includeQuantumAnalysis}
                onCheckedChange={setIncludeQuantumAnalysis}
              />
              <div className="space-y-1">
                <Label htmlFor="quantum" className="font-bold text-primary">Enable Quantum Threat Analysis</Label>
                <p className="text-sm text-muted-foreground">
                  Simulate exposure to Shor's and Grover's algorithms and recommend post-quantum cryptography alternatives.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={runScan.isPending}>
              {runScan.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {runScan.isPending ? "Initializing..." : "Run Audit Scan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
