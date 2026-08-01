import { PageHeader } from "@/components/admin/PageHeader";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { getFormStats } from "@/lib/admin/queries";

export default async function AdminFormsPage() {
  const forms = await getFormStats(30);

  return (
    <>
      <PageHeader title="Forms" description="Per-form funnel, last 30 days" />

      <Table>
        <Thead>
          <Tr>
            <Th>Form ID</Th>
            <Th className="text-right">Viewed</Th>
            <Th className="text-right">Started</Th>
            <Th className="text-right">Submitted</Th>
            <Th className="text-right">Abandoned</Th>
            <Th className="text-right">Errors</Th>
            <Th className="text-right">Completion</Th>
          </Tr>
        </Thead>
        <tbody>
          {forms.length === 0 ? (
            <EmptyState />
          ) : (
            forms.map((form) => (
              <Tr key={form.formId}>
                <Td className="font-medium text-slate-800">{form.formId}</Td>
                <Td className="text-right">{form.viewed}</Td>
                <Td className="text-right">{form.started}</Td>
                <Td className="text-right">{form.submitted}</Td>
                <Td className="text-right">{form.abandoned}</Td>
                <Td className="text-right">{form.validation_error}</Td>
                <Td className="text-right">{form.completionRate.toFixed(1)}%</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
