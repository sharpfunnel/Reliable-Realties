import { PageHeader } from "@/components/admin/PageHeader";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { getErrors } from "@/lib/admin/queries";

export default async function AdminErrorsPage() {
  const errors = await getErrors(100);

  return (
    <>
      <PageHeader title="Errors" description="Last 100 client-side errors" />

      <Table>
        <Thead>
          <Tr>
            <Th>Time</Th>
            <Th>Type</Th>
            <Th>Message</Th>
            <Th>Path</Th>
          </Tr>
        </Thead>
        <tbody>
          {errors.length === 0 ? (
            <EmptyState />
          ) : (
            errors.map((err) => (
              <Tr key={err.id}>
                <Td className="whitespace-nowrap">{err.createdAt.toLocaleString()}</Td>
                <Td className="capitalize">{err.type.replace("_", " ")}</Td>
                <Td className="max-w-[480px] truncate" title={err.message}>
                  {err.message}
                </Td>
                <Td>{err.path ?? "—"}</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
