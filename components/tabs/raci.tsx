"use client";

import { OrgHierarchyChart } from "@/components/charts/org-hierarchy-chart";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Snapshot } from "@/lib/data/types";

interface RaciTabProps {
  snapshot: Snapshot;
}

export function RaciTab({ snapshot }: RaciTabProps) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Operational hierarchy"
        description="Supervisor → team → role mix across six pods."
      >
        <OrgHierarchyChart snapshot={snapshot} />
      </SectionCard>

      <SectionCard
        title="Operations RACI"
        description="Inbound voice vs scheduling ownership under surge conditions."
      >
      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-foreground">MJM Operational Task</TableHead>
              <TableHead className="font-semibold text-foreground text-center">CSA</TableHead>
              <TableHead className="font-semibold text-foreground text-center">SDS</TableHead>
              <TableHead className="font-semibold text-foreground text-center">NDS</TableHead>
              <TableHead className="font-semibold text-foreground text-center">CSA Lead</TableHead>
              <TableHead className="font-semibold text-foreground text-center">Supervisor</TableHead>
              <TableHead className="font-semibold text-foreground text-center">General Manager / PM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Inbound Call Taking & Reservations</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Consulted
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">First-Line Agent Inquiries & Questions</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Raise)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Resolve)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">First-Line Agent Inquiries & ETAs</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Raise)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Consulted
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Same-Day Trip Routing & Re-allocations</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Involved (ETA Calls)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Resp + Acc
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Consulted</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Next-Day Route Optimization & Prep</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Involved (Reservations)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Resp + Acc
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Pending Reassignment Status Updates</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Initial & Transfer)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Resolve)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Provider OTP Data Audits & Validation</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Consulted</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Validation)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Incentives)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable (Revenue)
                </Badge>
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">E-Wallet Customer Outreach</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Consulted</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">PCI-DSS Credit Card Compliance (April 2026 Valley Metro Rule)</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Compliance)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Resolve)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Audit)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable (Attest)
                </Badge>
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Inbound Queue Surge Overflow Support</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Involved (Last Resort)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Accountable</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Critical Incident Escalations (Injury/etc.)</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Capture/Handoff)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Dispatch)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Consulted</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Triage)
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable (Final Report)
                </Badge>
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Escalated Passenger Call Resolution</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible (Initial & Transfer)
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Informed</TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Overtime & Cleanup Shift Authorization</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">Not Involved</TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Responsible
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                  Accountable
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
    </div>
  );
}
