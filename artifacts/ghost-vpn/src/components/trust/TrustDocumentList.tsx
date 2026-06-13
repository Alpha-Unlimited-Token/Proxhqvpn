// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { FileText, Download, ExternalLink } from "lucide-react";

interface TrustDocument {
  id: string;
  title: string;
  type: string;
  summary: string;
  publishedAt: string;
  publicDownloadUrl: string | null;
}

interface Props {
  documents: TrustDocument[];
}

const TYPE_LABELS: Record<string, string> = {
  security_overview: "Security",
  pentest_summary:   "Pentest",
  compliance_summary: "Compliance",
  privacy:           "Privacy",
  subprocessors:     "Sub-Processors",
  other:             "Document",
};

export default function TrustDocumentList({ documents }: Props) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-white/90">Trust Documents</span>
        </div>
        <p className="text-sm text-white/40">No published documents yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <FileText className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-white/90">Trust Documents</span>
        <span className="ml-auto text-xs text-white/30">{documents.length} published</span>
      </div>

      <div className="space-y-2.5">
        {documents.map(doc => (
          <div key={doc.id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3.5 flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white/90">{doc.title}</span>
                  <span className="text-[9px] uppercase tracking-widest text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                    {TYPE_LABELS[doc.type] ?? "Document"}
                  </span>
                </div>
                <p className="text-[12px] text-white/50 mt-0.5 leading-relaxed">{doc.summary}</p>
              </div>
              {doc.publicDownloadUrl && (
                <a
                  href={doc.publicDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <p className="text-[10px] text-white/25">
              Published {new Date(doc.publishedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
