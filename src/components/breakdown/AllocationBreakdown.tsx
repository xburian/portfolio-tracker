import React from 'react';
import { ValuationDetail } from '@/types/portfolio';
import { TaxTimeTestCard } from './TaxTimeTestCard';
import { DonutAllocation } from '../dashboard/DonutAllocation';

interface AllocationBreakdownProps {
  valuations: ValuationDetail[];
}

export const AllocationBreakdown: React.FC<AllocationBreakdownProps> = ({ valuations }) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Visual Pie/Donut Allocation Panel */}
      <DonutAllocation valuations={valuations} variant="full" />

      {/* Tax-Free 3-Year Time Test Analysis & Rebalance Card */}
      <TaxTimeTestCard valuations={valuations} />
    </div>
  );
};
