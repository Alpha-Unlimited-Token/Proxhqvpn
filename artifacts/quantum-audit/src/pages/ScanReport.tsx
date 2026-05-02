// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useGetScanReport } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ShieldCheck, Cpu } from "lucide-react";

export default function ScanReport() {
  const { id } = useParams();
  const { data: report, isLoading, error } = useGetScanReport(Number(id));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-[800px] w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-10 border border-destructive/50 bg-destructive/10 rounded-lg text-center">
        <h3 className="font-bold text-lg">Failed to load report</h3>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Link href={`/scans/${id}`}>
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Scan</Button>
        </Link>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="w-4 h-4 mr-2" /> Download PDF
        </Button>
      </div>

      <Card className="bg-white text-black border-none rounded-none shadow-2xl p-8 md:p-12 print:shadow-none print:p-0">
        <CardContent className="space-y-12">
          {/* Cover Page */}
          <div className="text-center py-20 border-b-4 border-primary">
            <ShieldCheck className="w-20 h-20 text-primary mx-auto mb-6" />
            <h1 className="text-4xl font-bold font-serif mb-4">{report.reportTitle}</h1>
            <p className="text-xl text-gray-500 mb-8">Comprehensive Security & Post-Quantum Analysis</p>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left text-sm font-mono bg-gray-50 p-4 rounded">
              <div className="text-gray-500">Target Chain:</div>
              <div className="font-bold">{report.chain}</div>
              <div className="text-gray-500">Generated:</div>
              <div className="font-bold">{new Date(report.generatedAt).toLocaleDateString()}</div>
              <div className="text-gray-500">Risk Rating:</div>
              <div className="font-bold uppercase text-red-600">{report.riskRating}</div>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <h2 className="text-2xl font-bold font-serif mb-4 text-primary">Executive Summary</h2>
            <p className="text-gray-700 leading-relaxed">{report.executiveSummary}</p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 bg-gray-50 rounded border border-gray-200">
              <div className="text-3xl font-bold mb-1">{report.totalVulnerabilities}</div>
              <div className="text-sm font-mono text-gray-500 uppercase">Total Findings</div>
            </div>
            <div className="p-6 bg-gray-50 rounded border border-gray-200">
              <div className="text-3xl font-bold mb-1 text-orange-600">{report.quantumRiskScore}/100</div>
              <div className="text-sm font-mono text-gray-500 uppercase flex items-center gap-1">
                <Cpu className="w-4 h-4"/> Quantum Risk
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-10">
            {report.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-xl font-bold font-serif mb-4 pb-2 border-b border-gray-200 text-primary">
                  {section.title}
                </h3>
                <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content }} />
                
                {section.findings && section.findings.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {section.findings.map(finding => (
                      <div key={finding.id} className="p-4 border border-red-200 bg-red-50 rounded">
                        <h4 className="font-bold font-mono text-red-800 mb-2">[{finding.severity.toUpperCase()}] {finding.title}</h4>
                        <p className="text-sm text-gray-700 mb-3">{finding.description}</p>
                        <div className="bg-white p-3 text-sm border border-gray-200 rounded">
                          <span className="font-bold text-primary">Recommendation: </span>
                          {finding.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div>
            <h2 className="text-2xl font-bold font-serif mb-4 pb-2 border-b border-gray-200 text-primary">Strategic Recommendations</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="leading-relaxed">{rec}</li>
              ))}
            </ul>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}
