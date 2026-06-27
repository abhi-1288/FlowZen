import { ActionButton, Card, SectionHeader } from "../../shared";

export function BudgetAllocateSection({
  onAllocate,
}: {
  onAllocate: () => void;
}) {
  return (
    <Card>
      <SectionHeader title="Project Budget Allocation" description="Set project budgets and submit for approval." accent="violet" />
      <div className="flex justify-end">
        <ActionButton variant="primary" onClick={onAllocate}>Allocate Budget</ActionButton>
      </div>
    </Card>
  );
}
