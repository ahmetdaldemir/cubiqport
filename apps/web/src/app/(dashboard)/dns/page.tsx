import { Header } from '@/components/layout/header';
import { PlusIcon, NetworkIcon } from 'lucide-react';
import type { DnsRecord } from '@cubiqport/shared';

export const metadata = { title: 'DNS Records' };

async function getDnsRecords(): Promise<DnsRecord[]> {
  return [];
}

export default async function DnsPage() {
  const records = await getDnsRecords();

  return (
    <div className="flex flex-col">
      <Header title="DNS Records" description="Manage DNS records via Cloudflare API" />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </p>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
            <PlusIcon className="h-4 w-4" />
            Add Record
          </button>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <NetworkIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No DNS records</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              DNS records are created automatically when you add a domain. You can also add custom records here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Type', 'Name', 'Content', 'TTL', 'Proxied'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id} className="transition hover:bg-secondary/30">
                    <td className="px-5 py-3.5">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono font-medium">
                        {r.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">{r.name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                      {r.content}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">
                      {r.ttl === 1 ? 'Auto' : `${r.ttl}s`}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {r.proxied ? (
                        <span className="text-orange-400">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button className="text-xs text-destructive hover:text-destructive/80 transition">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
