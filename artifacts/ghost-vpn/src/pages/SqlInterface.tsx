import { useState } from "react";
import { useExecuteSqlQuery } from "@workspace/api-client-react";
import { Database, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SqlInterface() {
  const [query, setQuery] = useState("SELECT * FROM nodes LIMIT 10;");
  const execSql = useExecuteSqlQuery();
  const [result, setResult] = useState<any>(null);

  const handleRun = () => {
    execSql.mutate({ data: { query } }, {
      onSuccess: (res) => {
        setResult(res);
      },
      onError: (err: any) => {
        setResult({ error: err.message || "Query execution failed" });
      }
    });
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Database className="w-6 h-6" />
          SQL Interface
        </h2>
        <Button 
          onClick={handleRun} 
          disabled={execSql.isPending}
          className="bg-primary text-black hover:bg-primary/80"
        >
          <Play className="w-4 h-4 mr-2" />
          EXECUTE
        </Button>
      </div>

      <div className="h-48 border border-primary/20 rounded bg-black flex flex-col shrink-0">
        <textarea 
          className="flex-1 bg-transparent p-4 text-primary font-mono text-sm resize-none focus:outline-none"
          value={query}
          onChange={e => setQuery(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="flex-1 border border-primary/20 rounded bg-black overflow-hidden flex flex-col">
        {result?.error ? (
          <div className="p-4 text-destructive font-mono text-sm whitespace-pre-wrap">
            {result.error}
          </div>
        ) : result?.columns ? (
          <>
            <div className="p-2 border-b border-primary/20 bg-primary/5 text-xs font-mono flex items-center justify-between text-primary/70">
              <span>{result.rowCount} ROWS</span>
              <span>{result.executionTimeMs} MS</span>
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-primary/20 hover:bg-transparent">
                    {result.columns.map((col: string) => (
                      <TableHead key={col} className="text-primary/70 text-xs font-mono">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row: any, i: number) => (
                    <TableRow key={i} className="border-primary/20 hover:bg-primary/5">
                      {result.columns.map((col: string) => (
                        <TableCell key={col} className="font-mono text-xs whitespace-nowrap">
                          {String(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {result.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={result.columns.length} className="text-center py-8 text-primary/50">
                        NO ROWS RETURNED
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-primary/30 font-mono text-sm">
            [ENTER QUERY TO EXECUTE]
          </div>
        )}
      </div>
    </div>
  );
}
