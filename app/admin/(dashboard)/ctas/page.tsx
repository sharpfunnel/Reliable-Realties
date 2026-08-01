import { PageHeader } from "@/components/admin/PageHeader";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { getCtaStats } from "@/lib/admin/queries";

export default async function AdminCtasPage() {
  const ctas = await getCtaStats(30);

  return (
    <>
      <PageHeader title="CTAs" description="Per-CTA engagement, last 30 days" />

      <Table>
        <Thead>
          <Tr>
            <Th>CTA ID</Th>
            <Th className="text-right">Viewed</Th>
            <Th className="text-right">Hovered</Th>
            <Th className="text-right">Clicked</Th>
            <Th className="text-right">CTR</Th>
          </Tr>
        </Thead>
        <tbody>
          {ctas.length === 0 ? (
            <EmptyState />
          ) : (
            ctas.map((cta) => (
              <Tr key={cta.ctaId}>
                <Td className="font-medium text-slate-800">{cta.ctaId}</Td>
                <Td className="text-right">{cta.viewed}</Td>
                <Td className="text-right">{cta.hovered}</Td>
                <Td className="text-right">{cta.clicked}</Td>
                <Td className="text-right">{cta.ctr.toFixed(1)}%</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
